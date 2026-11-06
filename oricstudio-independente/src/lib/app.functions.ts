import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function requireAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!data) throw new Error("Acesso restrito a administradores.");
}

function emailOf(claims: any): string | null {
  return (claims && typeof claims.email === "string" && claims.email) || null;
}

// ---------- Configuração inicial (pública, verificada no servidor) ----------
async function hasAnyUser() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1 });
  if (error) throw new Error("Falha ao verificar usuários.");
  return (data?.users?.length ?? 0) > 0;
}

export const getSetupStatus = createServerFn({ method: "GET" }).handler(async () => {
  return { disponivel: !(await hasAnyUser()) };
});

const setupSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(10, "Mínimo de 10 caracteres").max(72),
});

export const runInitialSetup = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => setupSchema.parse(input))
  .handler(async ({ data }) => {
    if (await hasAnyUser()) throw new Error("A configuração inicial já foi concluída.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (error || !created.user)
      throw new Error(error?.message || "Não foi possível criar o usuário.");
    // Race guard: if another user appeared concurrently, abort.
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 2 });
    if ((list?.users?.length ?? 0) > 1) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      throw new Error("A configuração inicial já foi concluída.");
    }
    await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role: "admin" });
    const { audit } = await import("./server/meta.server");
    await audit(supabaseAdmin, {
      user_id: created.user.id,
      user_email: data.email,
      acao: "configuracao_inicial",
      alvo: "admin",
    });
    return { ok: true };
  });

// ---------- Meta OAuth ----------
export const metaOAuthStart = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { metaConfig, buildAuthorizeUrl } = await import("./server/meta.server");
    const { randomToken, sha256Hex } = await import("./server/crypto.server");
    const cfg = metaConfig();
    if (cfg.missing.length) throw new Error(`Configure os secrets: ${cfg.missing.join(", ")}`);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const state = randomToken(32);
    await supabaseAdmin.from("oauth_states").insert({
      user_id: context.userId,
      state_hash: await sha256Hex(state),
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });
    return { url: buildAuthorizeUrl(state) };
  });

// Login direto do Instagram, sem exigencia de Pagina no Facebook.
export const getInstagramDirectStatus=createServerFn({method:"GET"})
  .middleware([requireSupabaseAuth])
  .handler(async({context})=>{
    await requireAdmin(context);
    const {instagramDirectConfig}=await import("./server/instagram-direct.server");
    const cfg=instagramDirectConfig();
    return {missing:cfg.missing,redirectUri:cfg.redirectUri};
  });

export const metaInstagramOAuthStart=createServerFn({method:"POST"})
  .middleware([requireSupabaseAuth])
  .handler(async({context})=>{
    await requireAdmin(context);
    const {instagramDirectConfig,buildInstagramAuthorizeUrl}=await import("./server/instagram-direct.server");
    const {randomToken,sha256Hex}=await import("./server/crypto.server");
    const cfg=instagramDirectConfig();
    if(cfg.missing.length)throw new Error(`Configure a integração Instagram: ${cfg.missing.join(", ")}`);
    const state=randomToken(32);
    const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
    const {error}=await supabaseAdmin.from("oauth_states").insert({
      user_id:context.userId,state_hash:await sha256Hex(state),
      expires_at:new Date(Date.now()+10*60*1000).toISOString(),
    });
    if(error)throw new Error("Não foi possível iniciar a conexão Instagram.");
    return {url:buildInstagramAuthorizeUrl(state)};
  });

export const metaConnectionCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ connectionId: z.string().uuid().optional() }).parse(input ?? {}),
  )
  .handler(async ({ context, data }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { runConnectionCheck, audit } = await import("./server/meta.server");
    try {
      const results = await runConnectionCheck(supabaseAdmin, data.connectionId);
      await audit(supabaseAdmin, {
        user_id: context.userId,
        user_email: emailOf(context.claims),
        acao: "verificar_conexao",
        alvo: data.connectionId ?? "todas",
        detalhes: { results },
      });
      return { results };
    } catch (e: any) {
      await audit(supabaseAdmin, {
        user_id: context.userId,
        user_email: emailOf(context.claims),
        acao: "verificar_conexao",
        alvo: data.connectionId ?? "todas",
        resultado: "erro",
        detalhes: { erro: String(e?.message || e) },
      });
      throw e;
    }
  });

export const metaDisconnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .union([
        z.object({ tipo: z.literal("conta"), accountId: z.string().uuid() }),
        z.object({ tipo: z.literal("conexao"), connectionId: z.string().uuid() }),
      ])
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { audit, getUserToken, metaConfig } = await import("./server/meta.server");
    const who = { user_id: context.userId, user_email: emailOf(context.claims) };
    if (data.tipo === "conta") {
      await supabaseAdmin
        .from("instagram_accounts")
        .update({ gerenciada: false, status: "inativa" })
        .eq("id", data.accountId);
      await audit(supabaseAdmin, { ...who, acao: "desativar_conta", alvo: data.accountId });
      return { ok: true };
    }
    let revogado = false;
    try {
      const token = await getUserToken(supabaseAdmin, data.connectionId);
      if (token) {
        const res = await fetch(
          `${metaConfig().graph}/me/permissions?access_token=${encodeURIComponent(token)}`,
          { method: "DELETE" },
        );
        revogado = res.ok;
      }
    } catch {
      revogado = false;
    }
    await supabaseAdmin.from("meta_tokens").delete().eq("connection_id", data.connectionId);
    await supabaseAdmin
      .from("instagram_accounts")
      .update({ gerenciada: false, status: "desconectada" })
      .eq("connection_id", data.connectionId);
    await supabaseAdmin
      .from("meta_connections")
      .update({ status: "desconectada", escopos_concedidos: [], ultimo_erro: null })
      .eq("id", data.connectionId);
    await audit(supabaseAdmin, {
      ...who,
      acao: "desconectar_meta",
      alvo: data.connectionId,
      resultado: revogado ? "sucesso" : "parcial",
      detalhes: { permissoes_revogadas_na_meta: revogado },
    });
    return { ok: true, revogado };
  });

export const setAccountManaged = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ accountId: z.string().uuid(), gerenciada: z.boolean() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { audit } = await import("./server/meta.server");
    const { error } = await supabaseAdmin
      .from("instagram_accounts")
      .update({ gerenciada: data.gerenciada })
      .eq("id", data.accountId);
    if (error) throw new Error("Não foi possível atualizar a conta.");
    await audit(supabaseAdmin, {
      user_id: context.userId,
      user_email: emailOf(context.claims),
      acao: data.gerenciada ? "gerenciar_conta" : "deixar_de_gerenciar_conta",
      alvo: data.accountId,
    });
    return { ok: true };
  });

export const updateSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        pausa_geral: z.boolean().optional(),
        modo_autonomia: z.enum(["assistido", "automatico_regras", "gestao_ampliada"]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { audit } = await import("./server/meta.server");
    const { error } = await supabaseAdmin
      .from("app_settings")
      .update({
        ...(data.pausa_geral !== undefined ? { pausa_geral: data.pausa_geral } : {}),
        ...(data.modo_autonomia !== undefined ? { modo_autonomia: data.modo_autonomia } : {}),
        updated_by: context.userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", true);
    if (error) throw new Error("Não foi possível salvar.");
    await audit(supabaseAdmin, {
      user_id: context.userId,
      user_email: emailOf(context.claims),
      acao:
        data.pausa_geral !== undefined
          ? data.pausa_geral
            ? "pausa_geral_ativada"
            : "pausa_geral_desativada"
          : "alterar_configuracao",
      alvo: "app_settings",
      detalhes: data,
    });
    return { ok: true };
  });

export const getConfigStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { metaConfig } = await import("./server/meta.server");
    const cfg = metaConfig();
    return {
      missing: cfg.missing,
      usaConfigId: !!cfg.configId,
      versao: cfg.version,
      redirectUri: cfg.baseUrl ? cfg.redirectUri : null,
    };
  });

// ---------- Exclusão de dados (pública: só status por código) ----------
export const getDeletionStatus = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z
      .object({
        codigo: z
          .string()
          .trim()
          .regex(/^[A-Za-z0-9_-]{8,64}$/),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("data_deletion_requests")
      .select("status, created_at, concluida_em")
      .eq("confirmation_code", data.codigo)
      .maybeSingle();
    return row ? { encontrado: true as const, ...row } : { encontrado: false as const };
  });
