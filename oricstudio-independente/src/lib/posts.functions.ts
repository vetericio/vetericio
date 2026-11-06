import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { postSchema } from "./post-schema";

// All writes to posts and media go through these functions (the browser has read-only access).
// They enforce roles, approval, the general pause and Instagram's limits before anything is queued.

type Ctx = { supabase: any; userId: string; claims: any };

async function roleOf(context:Ctx):Promise<"admin"|"editor"|null>{
  try {
    const {tenantForUser}=await import("./server/tenant-admin.server");
    const tenant=await tenantForUser(context,"viewer");
    return tenant.role==="viewer"?null:tenant.role;
  }catch{return null;}
}

async function requireEditor(context: Ctx) {
  const role = await roleOf(context);
  if (!role) throw new Error("Você não tem permissão para editar publicações.");
  return role;
}

function who(context: Ctx) {
  const email =
    context.claims && typeof context.claims.email === "string" ? context.claims.email : null;
  return { user_id: context.userId, user_email: email };
}

async function server(context:Ctx) {
  const {admin}=await (await import("./server/tenant-admin.server")).scopedAdminForUser(context,"editor");
  const {audit}=await import("./server/meta.server");
  return {admin,audit};
}

// ---------- Media ----------
const mediaSchema = z.object({
  instagram_account_id: z.string().uuid(),
  storage_path: z
    .string()
    .regex(/^uploads\/[0-9a-f-]{36}\/[0-9]{4}-[0-9]{2}\/[0-9a-f-]{36}\.(jpg|mp4|mov)$/),
  tipo: z.enum(["imagem", "video"]),
  mime: z.enum(["image/jpeg", "video/mp4", "video/quicktime"]),
  tamanho_bytes: z
    .number()
    .int()
    .positive()
    .max(300 * 1024 * 1024),
  largura: z.number().int().positive().max(10000).nullable(),
  altura: z.number().int().positive().max(10000).nullable(),
  duracao_s: z
    .number()
    .positive()
    .max(15 * 60)
    .nullable(),
  nome_original: z.string().max(255).nullable(),
});

export const registerMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => mediaSchema.parse(input))
  .handler(async ({ context, data }) => {
    await requireEditor(context);
    const { admin } = await server(context);
    if(data.storage_path.split("/")[1]!==data.instagram_account_id)
      throw new Error("Arquivo de uma conta Instagram diferente.");
    const {data:account}=await admin.from("instagram_accounts")
      .select("id").eq("id",data.instagram_account_id).maybeSingle();
    if(!account)throw new Error("Conta não pertence à clínica ativa.");
    const folder = data.storage_path.split("/").slice(0, 3).join("/");
    const file = data.storage_path.split("/")[3]!;
    const { data: listed } = await admin.storage.from("midia").list(folder, { search: file });
    if (!listed?.some((o) => o.name === file))
      throw new Error("O arquivo não foi encontrado no armazenamento.");
    const public_url = admin.storage.from("midia").getPublicUrl(data.storage_path).data.publicUrl;
    const { data: row, error } = await admin
      .from("media_assets")
      .insert({ ...data, public_url, created_by: context.userId })
      .select("*")
      .single();
    if (error) throw new Error("Não foi possível registrar a mídia.");
    return row;
  });

/** Copies a public https file (JPEG, MP4 or MOV, up to 100 MB) into the media bucket. */
export const importMediaFromUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        instagram_account_id: z.string().uuid(),
        url: z.string().url().max(2000).startsWith("https://"),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    await requireEditor(context);
    const { admin, audit } = await server(context);
    const {data:account}=await admin.from("instagram_accounts")
      .select("id").eq("id",data.instagram_account_id).maybeSingle();
    if(!account)throw new Error("Conta não pertence à clínica ativa.");
    const { importFromUrl } = await import("./server/media.server");
    const { row, host, bytes } = await importFromUrl(
      admin,
      data.instagram_account_id,
      data.url,
      context.userId,
    );
    await audit(admin, {
      ...who(context),
      acao: "midia_importada",
      alvo: row.id,
      detalhes: { host, bytes },
    });
    return row;
  });

// ---------- Posts ----------
export const savePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => postSchema.parse(input))
  .handler(async ({ context, data }) => {
    const role = await requireEditor(context);
    const { admin } = await server(context);
    const { savePostCore } = await import("./server/posts.server");
    return savePostCore(
      admin,
      { userId: context.userId, email: who(context).user_email, role },
      data,
    );
  });

const idSchema = z.object({ id: z.string().uuid() });

export const approvePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => idSchema.parse(input))
  .handler(async ({ context, data }) => {
    if ((await roleOf(context)) !== "admin")
      throw new Error("Somente administradores aprovam publicações.");
    const { admin, audit } = await server(context);
    const { data: row } = await admin
      .from("posts")
      .update({
        status: "agendado",
        aprovado_por: context.userId,
        aprovado_em: new Date().toISOString(),
      })
      .eq("id", data.id)
      .eq("status", "aguardando_aprovacao")
      .select("id, agendado_para")
      .maybeSingle();
    if (!row) throw new Error("A publicação não está aguardando aprovação.");
    await audit(admin, { ...who(context), acao: "post_aprovar", alvo: data.id });
    return { ok: true };
  });

export const cancelSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => idSchema.parse(input))
  .handler(async ({ context, data }) => {
    await requireEditor(context);
    const { admin, audit } = await server(context);
    const { data: row } = await admin
      .from("posts")
      .update({
        status: "rascunho",
        aprovado_por: null,
        aprovado_em: null,
        container_id: null,
        children_container_ids: [],
        etapa: null,
        locked_until: null,
        proxima_tentativa: null,
      })
      .eq("id", data.id)
      .in("status", ["agendado", "aguardando_aprovacao"])
      .is("publish_attempted_at", null)
      .select("id")
      .maybeSingle();
    if (!row)
      throw new Error(
        "Não foi possível cancelar: a publicação já está sendo publicada ou não está agendada.",
      );
    await audit(admin, { ...who(context), acao: "post_cancelar_agendamento", alvo: data.id });
    return { ok: true };
  });

export const reschedulePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), agendado_para: z.string().datetime() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await requireEditor(context);
    const horario = new Date(data.agendado_para);
    if (!Number.isFinite(horario.getTime()) || horario.getTime() <= Date.now())
      throw new Error("Escolha um horário futuro.");

    const { admin, audit } = await server(context);
    const { data: atual } = await admin
      .from("posts")
      .select("id, instagram_account_id")
      .eq("id", data.id)
      .in("status", ["agendado", "aguardando_aprovacao"])
      .is("publish_attempted_at", null)
      .maybeSingle();
    if (!atual) throw new Error("Não foi possível reagendar: a publicação já está sendo publicada.");

    // The queue works by minute. Keep a one-minute guard band so two posts from the
    // same account are never claimed by the publishing worker in the same cycle.
    const inicioJanela = new Date(horario.getTime() - 60_000).toISOString();
    const fimJanela = new Date(horario.getTime() + 60_000).toISOString();
    const { data: conflito, error: erroConflito } = await admin
      .from("posts")
      .select("id")
      .eq("instagram_account_id", atual.instagram_account_id)
      .neq("id", data.id)
      .in("status", ["agendado", "aguardando_aprovacao"])
      .gte("agendado_para", inicioJanela)
      .lte("agendado_para", fimJanela)
      .limit(1)
      .maybeSingle();
    if (erroConflito) throw new Error("Não foi possível verificar conflitos na agenda.");
    if (conflito)
      throw new Error("Já existe uma publicação desta conta nesse horário. Escolha outro horário.");

    const { data: row } = await admin
      .from("posts")
      .update({ agendado_para: data.agendado_para, proxima_tentativa: null })
      .eq("id", data.id)
      .in("status", ["agendado", "aguardando_aprovacao"])
      .is("publish_attempted_at", null)
      .select("*")
      .maybeSingle();
    if (!row) throw new Error("Não foi possível reagendar: a publicação já está sendo publicada.");
    await audit(admin, {
      ...who(context),
      acao: "post_reagendar",
      alvo: data.id,
      detalhes: { agendado_para: data.agendado_para },
    });
    return { ok: true, avisos: await (await import("./server/posts.server")).warnings(admin, row) };
  });

export const retryPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => idSchema.parse(input))
  .handler(async ({ context, data }) => {
    if ((await roleOf(context)) !== "admin")
      throw new Error("Somente administradores podem tentar novamente.");
    const { admin, audit } = await server(context);
    const { data: row } = await admin
      .from("posts")
      .select("status, publish_attempted_at, container_id")
      .eq("id", data.id)
      .maybeSingle();
    if (row?.status !== "falhou")
      throw new Error("Só publicações que falharam podem ser tentadas novamente.");
    // If a publish call was ever made, verify on Meta first instead of risking a duplicate.
    const uncertain = !!row.publish_attempted_at && !!row.container_id;
    await admin
      .from("posts")
      .update({
        status: uncertain ? "resultado_desconhecido" : "agendado",
        agendado_para: new Date().toISOString(),
        tentativas: 0,
        proxima_tentativa: null,
        locked_until: null,
        ultimo_erro: null,
        ...(uncertain ? {} : { container_id: null, children_container_ids: [], etapa: null }),
        aprovado_por: context.userId,
        aprovado_em: new Date().toISOString(),
      })
      .eq("id", data.id);
    await audit(admin, { ...who(context), acao: "post_tentar_novamente", alvo: data.id });
    return { ok: true };
  });

export const deletePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => idSchema.parse(input))
  .handler(async ({ context, data }) => {
    await requireEditor(context);
    const { admin, audit } = await server(context);
    const { data: row } = await admin
      .from("posts")
      .delete()
      .eq("id", data.id)
      .in("status", ["rascunho", "falhou"])
      .select("id")
      .maybeSingle();
    if (!row)
      throw new Error(
        "Só rascunhos e publicações que falharam podem ser excluídos daqui. Publicações já feitas nunca são apagadas por este sistema.",
      );
    await audit(admin, { ...who(context), acao: "post_excluir_rascunho", alvo: data.id });
    return { ok: true };
  });

export const revokeAssistantKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => idSchema.parse(input))
  .handler(async ({ context, data }) => {
    if ((await roleOf(context)) !== "admin")
      throw new Error("Somente administradores podem revogar chaves.");
    const { admin, audit } = await server(context);
    const { data: row } = await admin
      .from("assistant_keys")
      .update({ revogada_em: new Date().toISOString() })
      .eq("id", data.id)
      .is("revogada_em", null)
      .select("id, nome")
      .maybeSingle();
    if (!row) throw new Error("Chave não encontrada ou já revogada.");
    await audit(admin, { ...who(context), acao: "chave_assistente_revogada", alvo: row.nome });
    return { ok: true };
  });

export const renameMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), nome: z.string().trim().min(1).max(255) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await requireEditor(context);
    const { admin } = await server(context);
    const { error } = await admin
      .from("media_assets")
      .update({ nome_original: data.nome })
      .eq("id", data.id);
    if (error) throw new Error("Não foi possível renomear.");
    return { ok: true };
  });

export const deleteMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => idSchema.parse(input))
  .handler(async ({ context, data }) => {
    await requireEditor(context);
    const { admin, audit } = await server(context);
    const { data: emUso } = await admin
      .from("posts")
      .select("id")
      .or(`media_asset_ids.cs.{${data.id}},capa_asset_id.eq.${data.id}`)
      .limit(1);
    if (emUso?.length) throw new Error("Esta mídia está em uma publicação e não pode ser apagada.");
    const { data: row } = await admin
      .from("media_assets")
      .select("storage_path")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) throw new Error("Mídia não encontrada.");
    await admin.storage.from("midia").remove([row.storage_path]);
    await admin.from("media_assets").delete().eq("id", data.id);
    await audit(admin, { ...who(context), acao: "midia_apagada", alvo: data.id });
    return { ok: true };
  });
