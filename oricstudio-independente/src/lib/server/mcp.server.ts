// MCP (Model Context Protocol) server for ChatGPT, Codex and compatible clients: JSON-RPC over Streamable HTTP,
// stateless, JSON responses only. The tools act as the "assistente" role, so the autonomy mode, the
// general pause and the automation rules apply exactly as for the local assistant. No tool publishes
// immediately, deletes anything, publishes a comment reply or changes settings.
import { z } from "zod";
import { postSchema } from "../post-schema";
import { resolveAccount } from "./assistant.server";
import { audit } from "./meta.server";
import type { Actor } from "./posts.server";

type Admin = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];
type Ctx = { admin: Admin; actor: Actor; email: string | null };

export const PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const SERVER_INFO = { name: "gestor-instagram", title: "Gestor Instagram para ChatGPT", version: "1.1.0" };

const INSTRUCTIONS = `Gestor das contas de Instagram cadastradas (veja listar_contas: cada conta traz a marca com tom de voz e contato; siga-os). Horários em Brasília (UTC-3).
Regras: agende só com legendas aprovadas pelo usuário ou vindas do plano editorial; nunca invente datas, preços ou locais; respostas a comentários são apenas sugestões (o usuário publica no painel); se a pausa geral estiver ativa, não agende e avise. Analise métricas de cada conta separadamente.
Mídias: o arquivo precisa estar na biblioteca. Caminho preferido para o ChatGPT/Codex: envie a mídia por enviar_midia_base64 (JPEG, MP4 ou MOV; sem navegador, URL pública ou acesso ao armazenamento). Depois use o id devolvido em agendar_publicacao. gerar_link_envio é apenas alternativa para clientes que conseguem fazer PUT em URL privada.`;

const conta = z.string().min(1).max(64).describe("@usuario ou id da conta");
const quando = z
  .string()
  .describe("Data e hora em Brasília, ex.: 2026-10-27T19:00 (ou ISO com fuso)");

/** "2026-10-27T19:00" without zone is Brasília time. */
export function parseQuando(v: string) {
  const s = /([zZ]|[+-]\d{2}:?\d{2})$/.test(v) ? v : `${v.length === 16 ? `${v}:00` : v}-03:00`;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new Error(`Data inválida: ${v}`);
  return d.toISOString();
}

function brasilia(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  });
}

type Tool = {
  name: string;
  title: string;
  description: string;
  input: z.ZodObject<z.ZodRawShape>;
  readOnly?: boolean;
  run: (ctx: Ctx, args: any) => Promise<unknown>;
};

async function settings(admin: Admin) {
  const { data } = await admin
    .from("app_settings")
    .select("pausa_geral, modo_autonomia")
    .eq("id", true)
    .maybeSingle();
  return data;
}

const TOOLS: Tool[] = [
  {
    name: "listar_contas",
    title: "Listar contas",
    description:
      "Contas de Instagram gerenciadas, com status da conexão, seguidores e tom de voz da marca.",
    input: z.object({}),
    readOnly: true,
    run: async ({ admin }) => {
      const { data: accs } = await admin
        .from("instagram_accounts")
        .select("id, username, nome, status, seguidores, gerenciada")
        .eq("gerenciada", true);
      const { data: brands } = await admin
        .from("brands")
        .select("instagram_account_id, nome_marca, tom_de_voz, contato_resposta");
      return (accs ?? []).map((a) => ({
        ...a,
        marca: (brands ?? []).find((b) => b.instagram_account_id === a.id) ?? null,
      }));
    },
  },
  {
    name: "status_sistema",
    title: "Status do sistema",
    description: "Modo de autonomia, pausa geral, próximas publicações e alertas abertos.",
    input: z.object({}),
    readOnly: true,
    run: async ({ admin }) => {
      const s = await settings(admin);
      const [{ data: prox }, { count: alertas }] = await Promise.all([
        admin
          .from("posts")
          .select("id, titulo, tipo, status, agendado_para, instagram_account_id")
          .in("status", [
            "agendado",
            "aguardando_aprovacao",
            "processando",
            "resultado_desconhecido",
          ])
          .order("agendado_para", { ascending: true })
          .limit(10),
        admin.from("alerts").select("id", { count: "exact", head: true }).eq("resolvido", false),
      ]);
      return {
        modo_autonomia: s?.modo_autonomia,
        pausa_geral: s?.pausa_geral,
        alertas_abertos: alertas ?? 0,
        proximas: (prox ?? []).map((p) => ({ ...p, quando_brasilia: brasilia(p.agendado_para) })),
      };
    },
  },
  {
    name: "ver_publicacoes",
    title: "Ver publicações",
    description:
      "Lista publicações por status (padrão: agendadas e aguardando aprovação). Use para evitar duplicatas.",
    input: z.object({
      conta: conta.optional(),
      status: z
        .array(
          z.enum([
            "rascunho",
            "aguardando_aprovacao",
            "agendado",
            "processando",
            "publicado",
            "falhou",
            "resultado_desconhecido",
          ]),
        )
        .optional(),
      limite: z.number().int().min(1).max(100).optional(),
    }),
    readOnly: true,
    run: async ({ admin }, a) => {
      let q = admin
        .from("posts")
        .select(
          "id, instagram_account_id, tipo, titulo, campanha, status, agendado_para, publicado_em, permalink, ultimo_erro, legenda",
        )
        .in("status", a.status ?? ["agendado", "aguardando_aprovacao"])
        .order("agendado_para", { ascending: false })
        .limit(a.limite ?? 30);
      if (a.conta) q = q.eq("instagram_account_id", (await resolveAccount(admin, a.conta)).id);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data ?? []).map((p) => ({ ...p, quando_brasilia: brasilia(p.agendado_para) }));
    },
  },
  {
    name: "listar_midias",
    title: "Listar mídias",
    description:
      "Arquivos da biblioteca (fotos e vídeos já enviados), com id para usar em agendar_publicacao. Busca pelo nome.",
    input: z.object({
      conta: conta.optional(),
      tipo: z.enum(["imagem", "video"]).optional(),
      busca: z.string().max(100).optional(),
      limite: z.number().int().min(1).max(100).optional(),
    }),
    readOnly: true,
    run: async ({ admin }, a) => {
      let q = admin
        .from("media_assets")
        .select(
          "id, instagram_account_id, tipo, nome_original, largura, altura, duracao_s, tamanho_bytes, public_url, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(a.limite ?? 40);
      if (a.conta) q = q.eq("instagram_account_id", (await resolveAccount(admin, a.conta)).id);
      if (a.tipo) q = q.eq("tipo", a.tipo);
      if (a.busca?.trim()) q = q.ilike("nome_original", `%${a.busca.trim()}%`);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return data;
    },
  },
  {
    name: "importar_midia_de_link",
    title: "Importar mídia de link",
    description:
      "Copia um arquivo de um link público https direto (JPEG, MP4 ou MOV, até 100 MB) para a biblioteca da conta. Imagens precisam já estar em JPEG na proporção certa (4:5 a 1,91:1 no feed).",
    input: z.object({
      conta,
      url: z.string().url().startsWith("https://"),
      nome: z.string().max(255).optional(),
    }),
    run: async ({ admin, actor }, a) => {
      const acc = await resolveAccount(admin, a.conta);
      const { importFromUrl } = await import("./media.server");
      const { row, host, bytes } = await importFromUrl(admin, acc.id, a.url, null, a.nome ?? null);
      await audit(admin, {
        user_id: null,
        user_email: actor.email,
        acao: "midia_importada",
        alvo: row.id,
        detalhes: { host, bytes },
      });
      return { id: row.id, tipo: row.tipo, nome: row.nome_original, public_url: row.public_url };
    },
  },
  {
    name: "gerar_link_envio",
    title: "Gerar link de envio",
    description:
      "Cria um link privado (PUT, válido por 2 horas) para enviar um arquivo JPEG, MP4 ou MOV de até 100 MB direto para a biblioteca, sem link público. Depois do PUT, chame confirmar_envio com o 'envio' devolvido. Não publica nem agenda.",
    input: z.object({
      conta,
      tipo: z.enum(["image/jpeg", "video/mp4", "video/quicktime"]),
      tamanho_bytes: z
        .number()
        .int()
        .min(1)
        .max(100 * 1024 * 1024),
    }),
    run: async ({ admin }, a) => {
      const acc = await resolveAccount(admin, a.conta);
      const { createUploadLink } = await import("./media.server");
      return createUploadLink(admin, acc.id, a.tipo, a.tamanho_bytes);
    },
  },
  {
    name: "enviar_midia_base64",
    title: "Enviar mídia pelo conector",
    description:
      "Caminho preferido do ChatGPT/Codex: envia JPEG, MP4 ou MOV em Base64 diretamente para a biblioteca, sem navegador, URL pública ou link temporário de armazenamento.",
    input: z.object({
      conta,
      tipo: z.enum(["image/jpeg", "video/mp4", "video/quicktime"]),
      conteudo_base64: z.string().min(4).max(Math.ceil((100 * 1024 * 1024 * 4) / 3) + 4),
      nome: z.string().max(255).optional(),
    }),
    run: async ({ admin, actor }, a) => {
      const acc = await resolveAccount(admin, a.conta);
      const { uploadBase64 } = await import("./media.server");
      const row = await uploadBase64(
        admin,
        acc.id,
        a.tipo,
        a.conteudo_base64,
        a.nome ?? null,
        null,
      );
      await audit(admin, {
        user_id: null,
        user_email: actor.email,
        acao: "midia_enviada_conector",
        alvo: row.id,
        detalhes: { bytes: row.tamanho_bytes, transporte: "base64" },
      });
      return {
        id: row.id,
        instagram_account_id: row.instagram_account_id,
        tipo: row.tipo,
        nome_original: row.nome_original,
        tamanho_bytes: row.tamanho_bytes,
        public_url: row.public_url,
        created_at: row.created_at,
      };
    },
  },
  {
    name: "confirmar_envio",
    title: "Confirmar envio",
    description:
      "Confere o arquivo enviado pelo link de gerar_link_envio (tipo real pelos primeiros bytes) e o coloca na biblioteca. Devolve o id para usar em agendar_publicacao. Arquivo inválido é descartado.",
    input: z.object({
      conta,
      envio: z.string().max(64).describe("valor 'envio' devolvido por gerar_link_envio"),
      nome: z.string().max(255).optional(),
    }),
    run: async ({ admin, actor }, a) => {
      const acc = await resolveAccount(admin, a.conta);
      const { confirmUpload } = await import("./media.server");
      const { row, bytes } = await confirmUpload(admin, acc.id, a.envio, a.nome ?? null, null);
      await audit(admin, {
        user_id: null,
        user_email: actor.email,
        acao: "midia_enviada_conector",
        alvo: row.id,
        detalhes: { bytes },
      });
      return {
        id: row.id,
        instagram_account_id: row.instagram_account_id,
        tipo: row.tipo,
        nome_original: row.nome_original,
        tamanho_bytes: row.tamanho_bytes,
        public_url: row.public_url,
        created_at: row.created_at,
      };
    },
  },
  {
    name: "agendar_publicacao",
    title: "Agendar publicação",
    description:
      "Cria rascunho ou agendamento (imagem, carrossel, reels, story) com mídias da biblioteca. Mostre a legenda ao usuário antes, salvo se vier do plano ou já aprovada. Fora das regras de automação, fica aguardando aprovação no painel. Não existe publicar na hora por aqui.",
    input: z.object({
      conta,
      tipo: z.enum(["imagem", "carrossel", "reels", "story"]),
      midias: z.array(z.string().uuid()).min(1).max(20).describe("ids da biblioteca, na ordem"),
      capa: z.string().uuid().optional().describe("id de imagem para capa do Reels"),
      legenda: z.string().max(2200).optional(),
      titulo: z.string().max(120).optional(),
      campanha: z.string().max(120).optional(),
      alt_text: z.string().max(1000).optional(),
      quando: quando.optional(),
      rascunho: z.boolean().optional().describe("true = só salvar como rascunho"),
      compartilhar_no_feed: z.boolean().optional(),
    }),
    run: async ({ admin, actor }, a) => {
      const acc = await resolveAccount(admin, a.conta);
      const rascunho = !!a.rascunho;
      if (!rascunho && !a.quando) throw new Error("Informe 'quando' (ou rascunho: true).");
      if (!rascunho && (await settings(admin))?.pausa_geral)
        throw new Error("A pausa geral está ativa: nada pode ser agendado. Avise o usuário.");
      const data = postSchema.parse({
        instagram_account_id: acc.id,
        tipo: a.tipo,
        titulo: a.titulo ?? null,
        campanha: a.campanha ?? null,
        legenda: a.legenda ?? null,
        alt_text: a.alt_text ?? null,
        media_asset_ids: a.midias,
        capa_asset_id: a.capa ?? null,
        share_to_feed: a.compartilhar_no_feed ?? true,
        agendado_para: a.quando ? parseQuando(a.quando) : null,
        acao: rascunho ? "rascunho" : "agendar",
      });
      const { savePostCore } = await import("./posts.server");
      const r = await savePostCore(admin, actor, data);
      return { ...r, quando_brasilia: brasilia(data.agendado_para) };
    },
  },
  {
    name: "reagendar_publicacao",
    title: "Reagendar publicação",
    description:
      "Muda o horário de uma publicação agendada ou aguardando aprovação (antes de começar a publicar).",
    input: z.object({ id: z.string().uuid(), quando }),
    run: async ({ admin, actor }, a) => {
      const when = parseQuando(a.quando);
      if (new Date(when).getTime() < Date.now() - 60_000)
        throw new Error("O horário escolhido já passou.");
      const { data: cur } = await admin.from("posts").select("*").eq("id", a.id).maybeSingle();
      if (
        !cur ||
        !["agendado", "aguardando_aprovacao"].includes(cur.status) ||
        cur.publish_attempted_at
      )
        throw new Error(
          "Só dá para reagendar publicações agendadas que ainda não começaram a ser publicadas.",
        );
      const { checkRules } = await import("./rules.server");
      const violacoes = await checkRules(admin, {
        id: cur.id,
        instagram_account_id: cur.instagram_account_id,
        tipo: cur.tipo,
        legenda: cur.legenda,
        campanha: cur.campanha,
        agendado_para: when,
      });
      const hold = violacoes.length
        ? { status: "aguardando_aprovacao", aprovado_por: null, aprovado_em: null }
        : {};
      const { data: row } = await admin
        .from("posts")
        .update({ agendado_para: when, proxima_tentativa: null, ...hold })
        .eq("id", a.id)
        .in("status", ["agendado", "aguardando_aprovacao"])
        .is("publish_attempted_at", null)
        .select("id, status, agendado_para")
        .maybeSingle();
      if (!row)
        throw new Error("Não foi possível reagendar: a publicação já está sendo publicada.");
      await audit(admin, {
        user_id: null,
        user_email: actor.email,
        acao: "post_reagendar",
        alvo: a.id,
        detalhes: { agendado_para: when },
      });
      return { ...row, quando_brasilia: brasilia(row.agendado_para), violacoes };
    },
  },
  {
    name: "cancelar_agendamento",
    title: "Cancelar agendamento",
    description:
      "Volta uma publicação agendada para rascunho (nada é apagado). Confirme com o usuário antes.",
    input: z.object({ id: z.string().uuid() }),
    run: async ({ admin, actor }, a) => {
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
        .eq("id", a.id)
        .in("status", ["agendado", "aguardando_aprovacao"])
        .is("publish_attempted_at", null)
        .select("id, status")
        .maybeSingle();
      if (!row)
        throw new Error(
          "Não foi possível cancelar: a publicação já está sendo publicada ou não está agendada.",
        );
      await audit(admin, {
        user_id: null,
        user_email: actor.email,
        acao: "post_cancelar_agendamento",
        alvo: a.id,
      });
      return row;
    },
  },
  {
    name: "listar_comentarios",
    title: "Listar comentários",
    description: "Comentários sem resposta, com categoria, sugestão atual e a legenda do post.",
    input: z.object({
      conta: conta.optional(),
      limite: z.number().int().min(1).max(100).optional(),
    }),
    readOnly: true,
    run: async ({ admin }, a) => {
      let q = admin
        .from("comments")
        .select(
          "id, instagram_account_id, ig_media_id, autor, texto, publicado_em, categoria, precisa_humano, motivo_humano, resposta_sugerida, sugestao_por, parent_ig_comment_id",
        )
        .eq("respondido", false)
        .eq("arquivado", false)
        .order("publicado_em", { ascending: false })
        .limit(a.limite ?? 40);
      if (a.conta) q = q.eq("instagram_account_id", (await resolveAccount(admin, a.conta)).id);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      const ids = [
        ...new Set((data ?? []).map((c) => c.ig_media_id).filter((x): x is string => !!x)),
      ];
      const { data: media } = ids.length
        ? await admin
            .from("ig_media")
            .select("ig_media_id, caption, permalink")
            .in("ig_media_id", ids)
        : {
            data: [] as { ig_media_id: string; caption: string | null; permalink: string | null }[],
          };
      return (data ?? []).map((c) => {
        const m = (media ?? []).find((x) => x.ig_media_id === c.ig_media_id);
        return {
          ...c,
          post: m ? { legenda: (m.caption ?? "").slice(0, 300), link: m.permalink } : null,
        };
      });
    },
  },
  {
    name: "sugerir_resposta",
    title: "Sugerir resposta",
    description:
      "Grava uma sugestão de resposta para um comentário. Não publica: o usuário revisa e clica em Responder no painel. Não use para comentários sensíveis nem conversas entre seguidores.",
    input: z.object({ id: z.string().uuid(), texto: z.string().trim().min(1).max(2200) }),
    run: async ({ admin }, a) => {
      const { data: c } = await admin
        .from("comments")
        .select("id, categoria, respondido")
        .eq("id", a.id)
        .maybeSingle();
      if (!c || c.respondido) throw new Error("Comentário não encontrado ou já respondido.");
      if (c.categoria === "sensivel")
        throw new Error("Comentário sensível: encaminhe ao usuário em vez de sugerir resposta.");
      const { error } = await admin
        .from("comments")
        .update({ resposta_sugerida: a.texto, sugestao_por: "assistente" })
        .eq("id", a.id);
      if (error) throw new Error(error.message);
      return {
        ok: true,
        aviso: "Sugestão gravada. A publicação depende do clique do usuário em Responder.",
      };
    },
  },
  {
    name: "resumo_metricas",
    title: "Resumo de métricas",
    description:
      "Métricas reais de UMA conta: totais diários do período, publicações com alcance e interações, e recomendações com nível de confiança.",
    input: z.object({ conta, dias: z.number().int().min(7).max(90).optional() }),
    readOnly: true,
    run: async ({ admin }, a) => {
      const acc = await resolveAccount(admin, a.conta);
      const dias = a.dias ?? 30;
      const desde = new Date(Date.now() - dias * 86400_000).toISOString().slice(0, 10);
      const [{ data: daily }, { data: media }] = await Promise.all([
        admin
          .from("metric_snapshots")
          .select("dia, metrica, valor")
          .eq("instagram_account_id", acc.id)
          .is("ig_media_id", null)
          .gte("dia", desde),
        admin
          .from("ig_media")
          .select(
            "ig_media_id, publicado_em, media_type, media_product_type, caption, permalink, like_count, comments_count, insights",
          )
          .eq("instagram_account_id", acc.id)
          .gte("publicado_em", desde)
          .order("publicado_em", { ascending: false })
          .limit(100),
      ]);
      const totais: Record<string, number> = {};
      for (const d of daily ?? [])
        if (d.valor != null) totais[d.metrica] = (totais[d.metrica] ?? 0) + Number(d.valor);
      const { analyze } = await import("../analysis");
      const mediaIn = (media ?? []).map((m) => ({
        ...m,
        insights: (m.insights ?? {}) as Record<string, number>,
      }));
      const analise = analyze({
        media: mediaIn,
        daily: (daily ?? []).filter(
          (d): d is { dia: string; metrica: string; valor: number | null } => !!d.dia,
        ),
      });
      return {
        conta: `@${acc.username}`,
        periodo_dias: dias,
        totais_diarios_somados: totais,
        publicacoes: mediaIn.slice(0, 30).map((m) => ({
          quando_brasilia: brasilia(m.publicado_em),
          formato: m.media_product_type ?? m.media_type,
          legenda: (m.caption ?? "").split("\n")[0]!.slice(0, 80),
          link: m.permalink,
          curtidas: m.like_count,
          comentarios: m.comments_count,
          alcance: m.insights["reach"] ?? null,
          views: m.insights["views"] ?? null,
          interacoes: m.insights["total_interactions"] ?? null,
          salvos: m.insights["saved"] ?? null,
          compartilhamentos: m.insights["shares"] ?? null,
        })),
        ...analise,
      };
    },
  },
  {
    name: "ver_alertas",
    title: "Ver alertas",
    description: "Alertas abertos (falhas, conexão, token, quedas de métricas).",
    input: z.object({}),
    readOnly: true,
    run: async ({ admin }) => {
      const { data } = await admin
        .from("alerts")
        .select("id, tipo, severidade, mensagem, detalhe, created_at, instagram_account_id")
        .eq("resolvido", false)
        .order("created_at", { ascending: false })
        .limit(50);
      return data;
    },
  },
];

/** JSON Schema for the zod types the tools use (object, string, number, boolean, enum, array). */
export function jsonSchema(t: z.ZodTypeAny): Record<string, unknown> {
  const desc = t.description ? { description: t.description } : {};
  if (t instanceof z.ZodOptional) return { ...jsonSchema(t.unwrap()), ...desc };
  if (t instanceof z.ZodObject) {
    const shape = t.shape as Record<string, z.ZodTypeAny>;
    const required = Object.keys(shape).filter((k) => !(shape[k] instanceof z.ZodOptional));
    return {
      type: "object",
      properties: Object.fromEntries(Object.entries(shape).map(([k, v]) => [k, jsonSchema(v)])),
      ...(required.length ? { required } : {}),
      additionalProperties: false,
      ...desc,
    };
  }
  if (t instanceof z.ZodEnum) return { type: "string", enum: t.options, ...desc };
  if (t instanceof z.ZodArray) {
    const out: Record<string, unknown> = { type: "array", items: jsonSchema(t.element), ...desc };
    if (t._def.minLength) out["minItems"] = t._def.minLength.value;
    if (t._def.maxLength) out["maxItems"] = t._def.maxLength.value;
    return out;
  }
  if (t instanceof z.ZodNumber) {
    const out: Record<string, unknown> = { type: t.isInt ? "integer" : "number", ...desc };
    if (t.minValue != null) out["minimum"] = t.minValue;
    if (t.maxValue != null) out["maximum"] = t.maxValue;
    return out;
  }
  if (t instanceof z.ZodBoolean) return { type: "boolean", ...desc };
  if (t instanceof z.ZodString) {
    const out: Record<string, unknown> = { type: "string", ...desc };
    if (t.minLength != null) out["minLength"] = t.minLength;
    if (t.maxLength != null) out["maxLength"] = t.maxLength;
    if (t.isUUID) out["format"] = "uuid";
    if (t.isURL) out["format"] = "uri";
    return out;
  }
  return { ...desc };
}

export function toolList() {
  return TOOLS.map((t) => ({
    name: t.name,
    title: t.title,
    description: t.description,
    inputSchema: jsonSchema(t.input),
    annotations: {
      title: t.title,
      readOnlyHint: !!t.readOnly,
      destructiveHint: false,
      openWorldHint: false,
    },
  }));
}

type RpcMessage = { jsonrpc?: string; id?: string | number | null; method?: string; params?: any };

const rpcResult = (id: RpcMessage["id"], result: unknown) => ({
  jsonrpc: "2.0",
  id: id ?? null,
  result,
});
const rpcError = (id: RpcMessage["id"], code: number, message: string) => ({
  jsonrpc: "2.0",
  id: id ?? null,
  error: { code, message },
});

/** Handles one JSON-RPC message. Returns null for notifications (no response body). */
export async function handleRpc(ctx: Ctx, msg: RpcMessage) {
  const isNotification = msg.id === undefined;
  if (msg.jsonrpc !== "2.0" || typeof msg.method !== "string")
    return isNotification ? null : rpcError(msg.id, -32600, "Invalid Request");
  if (isNotification) return null;
  switch (msg.method) {
    case "initialize": {
      const asked = String(msg.params?.protocolVersion ?? "");
      return rpcResult(msg.id, {
        protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS,
      });
    }
    case "ping":
      return rpcResult(msg.id, {});
    case "tools/list":
      return rpcResult(msg.id, { tools: toolList() });
    case "tools/call": {
      const tool = TOOLS.find((t) => t.name === msg.params?.name);
      if (!tool) return rpcError(msg.id, -32602, `Ferramenta desconhecida: ${msg.params?.name}`);
      try {
        const args = tool.input.parse(msg.params?.arguments ?? {});
        const out = await tool.run(ctx, args);
        return rpcResult(msg.id, {
          content: [{ type: "text", text: JSON.stringify(out, null, 1) }],
          isError: false,
        });
      } catch (e) {
        const text =
          e instanceof z.ZodError
            ? e.issues.map((i) => `${i.path.join(".") || "argumentos"}: ${i.message}`).join("; ")
            : e instanceof Error
              ? e.message
              : String(e);
        return rpcResult(msg.id, {
          content: [{ type: "text", text: `Erro: ${text}` }],
          isError: true,
        });
      }
    }
    case "resources/list":
      return rpcResult(msg.id, { resources: [] });
    case "prompts/list":
      return rpcResult(msg.id, { prompts: [] });
    default:
      return rpcError(msg.id, -32601, `Método não suportado: ${msg.method}`);
  }
}
