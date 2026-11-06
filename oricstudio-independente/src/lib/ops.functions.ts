import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Server functions for metrics, reports, alerts, automation rules and comments.

type Ctx = { supabase: any; userId: string; claims: any };

async function roleOf(context: Ctx): Promise<"admin" | "editor" | "viewer" | null> {
  const { data } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId);
  const roles = (data ?? []).map((r: { role: string }) => r.role);
  return roles.includes("admin")
    ? "admin"
    : roles.includes("editor")
      ? "editor"
      : roles.includes("viewer")
        ? "viewer"
        : null;
}

async function need(context: Ctx, min: "admin" | "editor") {
  const r = await roleOf(context);
  if (min === "admin" ? r !== "admin" : r !== "admin" && r !== "editor") {
    throw new Error(
      min === "admin"
        ? "Somente administradores podem fazer isso."
        : "Você não tem permissão para fazer isso.",
    );
  }
}

function who(context: Ctx) {
  return {
    user_id: context.userId,
    user_email: typeof context.claims?.email === "string" ? context.claims.email : null,
  };
}

async function server() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { audit } = await import("./server/meta.server");
  return { admin: supabaseAdmin, audit };
}

const optionalAccount = z.object({ accountId: z.string().uuid().optional() });

export const collectNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => optionalAccount.parse(input ?? {}))
  .handler(async ({ context, data }) => {
    await need(context, "editor");
    const { admin, audit } = await server();
    const { runCollection } = await import("./server/collector.server");
    const resultados = await runCollection(admin, data.accountId);
    await audit(admin, {
      ...who(context),
      acao: "coleta_manual",
      alvo: data.accountId ?? "todas",
      detalhes: { resultados },
    });
    return { resultados };
  });

export const generateReportNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        tipo: z.enum(["diario", "semanal", "mensal", "personalizado"]),
        inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        accountId: z.string().uuid().nullable(),
      })
      .refine((v) => v.inicio <= v.fim, "O início precisa ser antes do fim.")
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    await need(context, "editor");
    const { admin, audit } = await server();
    const { generateReport } = await import("./server/reports.server");
    const id = await generateReport(admin, data.tipo, data.inicio, data.fim, data.accountId);
    await audit(admin, { ...who(context), acao: "relatorio_gerado", alvo: id, detalhes: data });
    return { id };
  });

export const resolveAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    await need(context, "editor");
    const { admin, audit } = await server();
    await admin
      .from("alerts")
      .update({ resolvido: true, resolvido_em: new Date().toISOString() })
      .eq("id", data.id);
    await audit(admin, { ...who(context), acao: "alerta_resolvido", alvo: data.id });
    return { ok: true };
  });

const rulesSchema = z.object({
  instagram_account_id: z.string().uuid(),
  ativa: z.boolean(),
  formatos: z.array(z.enum(["imagem", "carrossel", "reels", "story"])),
  max_por_dia: z.number().int().min(0).max(50),
  max_por_semana: z.number().int().min(0).max(200),
  hora_inicio: z.number().int().min(0).max(23),
  hora_fim: z.number().int().min(1).max(24),
  dias_semana: z.array(z.number().int().min(0).max(6)),
  palavras_proibidas: z.array(z.string().trim().min(1).max(60)).max(100),
  campanhas_com_aprovacao: z.array(z.string().trim().min(1).max(120)).max(50),
  suspender_apos_falhas: z.number().int().min(1).max(20),
  respostas_automaticas: z.boolean(),
});

export const saveRules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    rulesSchema
      .refine((v) => v.hora_inicio < v.hora_fim, "A hora inicial precisa ser antes da final.")
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    await need(context, "admin");
    const { admin, audit } = await server();
    const { error } = await admin
      .from("regras_publicacao")
      .upsert(
        { ...data, updated_at: new Date().toISOString() },
        { onConflict: "instagram_account_id" },
      );
    if (error) throw new Error("Não foi possível salvar as regras.");
    await audit(admin, {
      ...who(context),
      acao: "regras_alteradas",
      alvo: data.instagram_account_id,
      detalhes: data,
    });
    return { ok: true };
  });

export const resumeAutomation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ accountId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    await need(context, "admin");
    const { admin, audit } = await server();
    await admin
      .from("regras_publicacao")
      .update({ suspensa_em: null, motivo_suspensao: null })
      .eq("instagram_account_id", data.accountId);
    const { resolveAlerts } = await import("./server/alerts.server");
    await resolveAlerts(admin, data.accountId, "automacao_suspensa");
    await audit(admin, { ...who(context), acao: "automacao_retomada", alvo: data.accountId });
    return { ok: true };
  });

export const saveAlertLimits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        accountId: z.string().uuid(),
        queda_alcance_pct: z.number().min(5).max(95),
        aprovacao_horas: z.number().min(1).max(168),
        variacao_incomum_pct: z.number().min(20).max(1000),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    await need(context, "admin");
    const { admin, audit } = await server();
    const { accountId, ...limites } = data;
    const { data: brand } = await admin
      .from("brands")
      .select("id")
      .eq("instagram_account_id", accountId)
      .maybeSingle();
    if (!brand)
      throw new Error(
        "Preencha primeiro o perfil da marca desta conta (Contas conectadas → Perfil da marca).",
      );
    await admin
      .from("brands")
      .update({ limites_alerta: limites as any })
      .eq("id", brand.id);
    await audit(admin, {
      ...who(context),
      acao: "limites_alerta_alterados",
      alvo: accountId,
      detalhes: limites,
    });
    return { ok: true };
  });

export const replyComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), message: z.string().trim().min(1).max(2200) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await need(context, "editor");
    const { admin, audit } = await server();
    const { replyToComment } = await import("./server/collector.server");
    const email = who(context).user_email ?? context.userId;
    const replyId = await replyToComment(admin, data.id, data.message, email);
    await audit(admin, {
      ...who(context),
      acao: "comentario_respondido",
      alvo: data.id,
      detalhes: { reply_id: replyId },
    });
    return { ok: true };
  });

export const hideComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), hide: z.boolean() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await need(context, "admin");
    const { admin, audit } = await server();
    const { setCommentHidden } = await import("./server/collector.server");
    await setCommentHidden(admin, data.id, data.hide);
    await audit(admin, {
      ...who(context),
      acao: data.hide ? "comentario_ocultado" : "comentario_reexibido",
      alvo: data.id,
    });
    return { ok: true };
  });

export const archiveComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), arquivado: z.boolean() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await need(context, "editor");
    const { admin } = await server();
    const { data: c } = await admin
      .from("comments")
      .update({ arquivado: data.arquivado })
      .eq("id", data.id)
      .select("ig_comment_id, instagram_account_id")
      .maybeSingle();
    if (c && data.arquivado) {
      const { resolveAlerts } = await import("./server/alerts.server");
      await resolveAlerts(admin, c.instagram_account_id, "comentario_sensivel", c.ig_comment_id);
    }
    return { ok: true };
  });
