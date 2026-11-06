// Saving, approving and queueing posts. Server only; used by the editor's server functions
// and by the assistant API. Enforces account, content, approval and pause rules in one place.
import { EDITAVEIS, validateContent, type PostInput } from "../post-schema";
import { audit } from "./meta.server";

type Admin = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];

/** "assistente" is the local agent authenticated by the assistant key (no user account). */
export type Actor = {
  userId: string | null;
  email: string | null;
  role: "admin" | "editor" | "assistente";
};

export async function savePostCore(admin: Admin, actor: Actor, data: PostInput) {
  const { data: settings } = await admin
    .from("app_settings")
    .select("modo_autonomia")
    .eq("id", true)
    .maybeSingle();
  // The assistant only schedules/publishes on its own outside the assisted mode.
  const autonomo = !!settings && settings.modo_autonomia !== "assistido";

  const { data: acc } = await admin
    .from("instagram_accounts")
    .select("id, gerenciada, status")
    .eq("id", data.instagram_account_id)
    .maybeSingle();
  if (!acc?.gerenciada) throw new Error("A conta escolhida não está marcada como gerenciada.");

  let existing: any = null;
  if (data.id) {
    const { data: row } = await admin.from("posts").select("*").eq("id", data.id).maybeSingle();
    if (!row) throw new Error("Publicação não encontrada.");
    if (!EDITAVEIS.includes(row.status) || row.etapa === "publicando")
      throw new Error("Esta publicação já está sendo processada e não pode ser editada.");
    existing = row;
  }

  const ids = [...data.media_asset_ids, ...(data.capa_asset_id ? [data.capa_asset_id] : [])];
  const { data: assets } = await admin
    .from("media_assets")
    .select("id, tipo, instagram_account_id")
    .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  if ((assets ?? []).some((a) => a.instagram_account_id !== data.instagram_account_id))
    throw new Error("Há mídias de outra conta nesta publicação.");
  if (data.acao !== "rascunho") {
    const problem = validateContent(data, assets ?? []);
    if (problem) throw new Error(problem);
  }

  let status = "rascunho";
  let agendado_para = data.agendado_para;
  let aprovado: { aprovado_por: string | null; aprovado_em: string | null } = {
    aprovado_por: null,
    aprovado_em: null,
  };
  if (data.acao === "agendar") {
    if (!agendado_para) throw new Error("Escolha a data e o horário.");
    if (new Date(agendado_para).getTime() < Date.now() - 60_000)
      throw new Error("O horário escolhido já passou.");
    if (actor.role === "admin" || (actor.role === "assistente" && autonomo)) {
      status = "agendado";
      aprovado = { aprovado_por: actor.userId, aprovado_em: new Date().toISOString() };
    } else status = "aguardando_aprovacao";
  }
  if (data.acao === "publicar_agora") {
    if (!(actor.role === "admin" || (actor.role === "assistente" && autonomo)))
      throw new Error(
        "Somente administradores (ou o assistente em modo automático) podem publicar imediatamente.",
      );
    const { data: s } = await admin
      .from("app_settings")
      .select("pausa_geral")
      .eq("id", true)
      .maybeSingle();
    if (s?.pausa_geral)
      throw new Error("A pausa geral está ativa. Retome as automações para publicar.");
    status = "agendado";
    agendado_para = new Date().toISOString();
    aprovado = { aprovado_por: actor.userId, aprovado_em: new Date().toISOString() };
  }

  // Automation rules: they hold the assistant's posts for approval; for people they are only warnings.
  let violacoes: string[] = [];
  if (data.acao !== "rascunho") {
    const { checkRules } = await import("./rules.server");
    violacoes = await checkRules(admin, {
      ...(existing ? { id: existing.id } : {}),
      instagram_account_id: data.instagram_account_id,
      tipo: data.tipo,
      legenda: data.legenda,
      campanha: data.campanha,
      agendado_para,
    });
    if (violacoes.length && actor.role === "assistente") {
      status = "aguardando_aprovacao";
      aprovado = { aprovado_por: null, aprovado_em: null };
      if (data.acao === "publicar_agora")
        agendado_para = data.agendado_para ?? new Date(Date.now() + 3600_000).toISOString();
    }
  }

  const values = {
    instagram_account_id: data.instagram_account_id,
    tipo: data.tipo,
    titulo: data.titulo || null,
    campanha: data.campanha || null,
    legenda: data.tipo === "story" ? null : data.legenda,
    alt_text: data.tipo === "imagem" || data.tipo === "carrossel" ? data.alt_text : null,
    media_asset_ids: data.media_asset_ids,
    capa_asset_id: data.tipo === "reels" ? data.capa_asset_id : null,
    share_to_feed: data.share_to_feed,
    agendado_para,
    status,
    ...aprovado,
    // Content changed: any container created for the old content is discarded.
    container_id: null,
    children_container_ids: [],
    etapa: null,
    tentativas: 0,
    proxima_tentativa: null,
    locked_until: null,
    ultimo_erro: null,
    publish_attempted_at: null,
  };

  const { data: saved, error } = existing
    ? await admin.from("posts").update(values).eq("id", existing.id).select("*").single()
    : await admin
        .from("posts")
        .insert({ ...values, created_by: actor.userId })
        .select("*")
        .single();
  if (error || !saved) throw new Error("Não foi possível salvar a publicação.");

  const { count } = await admin
    .from("post_versions")
    .select("id", { count: "exact", head: true })
    .eq("post_id", saved.id);
  await admin.from("post_versions").insert({
    post_id: saved.id,
    versao: (count ?? 0) + 1,
    legenda: saved.legenda,
    media_asset_ids: saved.media_asset_ids,
    created_by: actor.userId,
  });
  await audit(admin, {
    user_id: actor.userId,
    user_email: actor.email,
    acao: `post_${data.acao}`,
    alvo: saved.id,
    detalhes: { status, agendado_para },
  });

  const avisos = [
    ...violacoes.map((v) =>
      actor.role === "assistente"
        ? `Retido para aprovação: ${v}`
        : `Fora das regras de automação: ${v}`,
    ),
    ...(await warnings(admin, saved)),
  ];
  let resultado: string | null = null;
  if (data.acao === "publicar_agora" && status === "agendado") {
    const { runPublishQueue } = await import("./publisher.server");
    const r = await runPublishQueue(admin);
    resultado = r.resultados?.find((x) => x.id === saved.id)?.status ?? "na_fila";
  }
  return { id: saved.id, status, avisos, resultado };
}

export async function warnings(admin: any, post: any): Promise<string[]> {
  const out: string[] = [];
  if (post.agendado_para && post.status !== "rascunho") {
    const t = new Date(post.agendado_para).getTime();
    const { data: near } = await admin
      .from("posts")
      .select("id, titulo, agendado_para")
      .eq("instagram_account_id", post.instagram_account_id)
      .neq("id", post.id)
      .in("status", ["agendado", "processando", "aguardando_aprovacao", "publicado"])
      .gte("agendado_para", new Date(t - 30 * 60_000).toISOString())
      .lte("agendado_para", new Date(t + 30 * 60_000).toISOString());
    if (near?.length)
      out.push(
        `Há ${near.length} outra(s) publicação(ões) desta conta a menos de 30 minutos deste horário.`,
      );
  }
  if (post.legenda && post.legenda.trim().length > 20) {
    const { data: same } = await admin
      .from("posts")
      .select("id")
      .eq("instagram_account_id", post.instagram_account_id)
      .neq("id", post.id)
      .eq("legenda", post.legenda)
      .gte("created_at", new Date(Date.now() - 30 * 86_400_000).toISOString());
    if (same?.length)
      out.push(
        "Já existe publicação com esta mesma legenda nos últimos 30 dias (possível duplicidade).",
      );
  }
  return out;
}
