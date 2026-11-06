// Meta Graph API helpers. Server only. Never log tokens.
import { encryptToken, decryptToken } from "./crypto.server";
import { META_SCOPES } from "../meta-permissions";
import { assertIndependentOricStudio } from "./instance-guard.server";

type Admin = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];

export function metaConfig() {
  assertIndependentOricStudio();
  const appId = process.env["META_APP_ID"];
  const appSecret = process.env["META_APP_SECRET"];
  const version = process.env["META_GRAPH_VERSION"] || "v24.0";
  const baseUrl = (process.env["APP_BASE_URL"] || "").replace(/\/+$/, "");
  const configId = process.env["META_LOGIN_CONFIG_ID"] || "";
  const missing: string[] = [];
  if (!appId) missing.push("META_APP_ID");
  if (!appSecret) missing.push("META_APP_SECRET");
  if (!baseUrl) missing.push("APP_BASE_URL");
  if (!process.env["TOKEN_ENCRYPTION_KEY"]) missing.push("TOKEN_ENCRYPTION_KEY");
  return {
    appId: appId || "",
    appSecret: appSecret || "",
    version,
    baseUrl,
    configId,
    missing,
    redirectUri: `${baseUrl}/api/public/meta-oauth-callback`,
    graph: `https://graph.facebook.com/${version}`,
  };
}

export class GraphError extends Error {
  code: number | undefined;
  transient: boolean;
  constructor(message: string, code?: number, transient = false) {
    super(message);
    this.code = code;
    this.transient = transient;
  }
}

/** The request never got a response from Meta (network failure or timeout): its outcome is unknown. */
export class GraphNetworkError extends Error {}

// Meta error codes that mean "try again later": unknown/service errors and rate limits.
const TRANSIENT_CODES = new Set([1, 2, 4, 17, 32, 341, 613, 9007]);

async function graphFetch<T>(url: string, init: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(30_000) });
  } catch (e: any) {
    throw new GraphNetworkError(String(e?.message || e));
  }
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    const code = json?.error?.code;
    const message = json?.error?.error_user_msg || json?.error?.message || `HTTP ${res.status}`;
    throw new GraphError(
      message,
      code,
      res.status >= 500 || json?.error?.is_transient === true || TRANSIENT_CODES.has(code),
    );
  }
  return json as T;
}

export async function graphGet<T = any>(url: string, params: Record<string, string>): Promise<T> {
  const u = new URL(url);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return graphFetch<T>(u.toString(), { method: "GET" });
}

/** POST with form-encoded params; the token goes in the body, never in the URL. */
export async function graphPost<T = any>(url: string, params: Record<string, string>): Promise<T> {
  return graphFetch<T>(url, { method: "POST", body: new URLSearchParams(params) });
}

export async function audit(
  admin: Admin,
  entry: {
    user_id?: string | null;
    user_email?: string | null;
    acao: string;
    alvo?: string | null;
    resultado?: string;
    detalhes?: Record<string, unknown>;
  },
) {
  await admin.from("audit_log").insert({
    user_id: entry.user_id ?? null,
    user_email: entry.user_email ?? null,
    acao: entry.acao,
    alvo: entry.alvo ?? null,
    resultado: entry.resultado ?? "sucesso",
    detalhes: (entry.detalhes ?? {}) as any,
  });
}

type IgNode = {
  id: string;
  username?: string;
  name?: string;
  profile_picture_url?: string;
  followers_count?: number;
};
type PageNode = {
  id: string;
  name?: string;
  access_token?: string;
  instagram_business_account?: IgNode;
};

async function collectPages(graph: string, url: string, token: string): Promise<PageNode[]> {
  const out: PageNode[] = [];
  let next: string | null = url;
  let guard = 0;
  while (next && guard++ < 20) {
    const res = await fetch(
      next.includes("access_token=")
        ? next
        : `${next}${next.includes("?") ? "&" : "?"}access_token=${encodeURIComponent(token)}`,
    );
    const json: any = await res.json();
    if (json.error) throw new GraphError(json.error.message, json.error.code);
    out.push(...(json.data || []));
    next = json.paging?.next || null;
  }
  void graph;
  return out;
}

const PAGE_FIELDS =
  "id,name,access_token,instagram_business_account{id,username,name,profile_picture_url,followers_count}";

/** Fetch pages + IG accounts for a connection and persist them (tokens encrypted). */
export async function syncConnectionAssets(
  admin: Admin,
  connectionId: string,
  userToken: string,
  granted: string[],
) {
  const { graph } = metaConfig();
  const pages = new Map<string, PageNode & { origem: string }>();
  for (const p of await collectPages(
    graph,
    `${graph}/me/accounts?fields=${encodeURIComponent(PAGE_FIELDS)}&limit=100`,
    userToken,
  )) {
    pages.set(p.id, { ...p, origem: "me_accounts" });
  }
  if (granted.includes("business_management")) {
    try {
      const biz = await graphGet<{ data: { id: string }[] }>(`${graph}/me/businesses`, {
        fields: "id,name",
        limit: "100",
        access_token: userToken,
      });
      for (const b of biz.data || []) {
        for (const edge of ["owned_pages", "client_pages"]) {
          try {
            for (const p of await collectPages(
              graph,
              `${graph}/${b.id}/${edge}?fields=${encodeURIComponent(PAGE_FIELDS)}&limit=100`,
              userToken,
            )) {
              if (!pages.has(p.id)) pages.set(p.id, { ...p, origem: `business:${b.id}` });
            }
          } catch {
            /* edge may be unavailable for this business */
          }
        }
      }
    } catch {
      /* businesses not accessible */
    }
  }

  const igFound: string[] = [];
  for (const p of pages.values()) {
    await admin.from("facebook_pages").upsert({
      id: p.id,
      nome: p.name ?? null,
      connection_id: connectionId,
      origem: p.origem,
      updated_at: new Date().toISOString(),
    });
    if (p.access_token) {
      const enc = await encryptToken(p.access_token);
      await admin
        .from("meta_tokens")
        .delete()
        .eq("connection_id", connectionId)
        .eq("tipo", "page")
        .eq("page_id", p.id);
      await admin.from("meta_tokens").insert({
        connection_id: connectionId,
        tipo: "page",
        page_id: p.id,
        token_criptografado: enc.ciphertext,
        iv: enc.iv,
      });
    }
    const ig = p.instagram_business_account;
    if (ig?.id) {
      igFound.push(ig.id);
      await admin.from("instagram_accounts").upsert(
        {
          ig_user_id: ig.id,
          username: ig.username ?? null,
          nome: ig.name ?? null,
          foto_url: ig.profile_picture_url ?? null,
          seguidores: ig.followers_count ?? null,
          page_id: p.id,
          connection_id: connectionId,
          status: "ativa",
          permissoes_efetivas: granted.filter((s) => s.startsWith("instagram_")),
          ultimo_erro: null,
        },
        { onConflict: "ig_user_id" },
      );
    }
  }
  return { pages: pages.size, instagram: igFound.length };
}

export async function getUserToken(admin: Admin, connectionId: string): Promise<string | null> {
  const { data } = await admin
    .from("meta_tokens")
    .select("token_criptografado, iv")
    .eq("connection_id", connectionId)
    .eq("tipo", "user")
    .maybeSingle();
  if (!data) return null;
  return decryptToken(data.token_criptografado, data.iv);
}

export async function getPageToken(
  admin: Admin,
  connectionId: string,
  pageId: string,
): Promise<string | null> {
  const { data } = await admin
    .from("meta_tokens")
    .select("token_criptografado, iv")
    .eq("connection_id", connectionId)
    .eq("tipo", "page")
    .eq("page_id", pageId)
    .maybeSingle();
  if (!data) return null;
  return decryptToken(data.token_criptografado, data.iv);
}

const REQUIRED_CORE = ["instagram_basic", "pages_show_list"];

/** Verify every (or one) connection and update statuses. */
export async function runConnectionCheck(admin: Admin, onlyConnectionId?: string) {
  const cfg = metaConfig();
  // Instagram Login funciona mesmo que as credenciais do Facebook Login nao existam.
  let q = admin.from("meta_connections").select("id,login_provider").neq("status", "desconectada");
  if (onlyConnectionId) q = q.eq("id", onlyConnectionId);
  const { data: conns } = await q;
  const results: { id: string; status: string }[] = [];
  for (const c of conns || []) {
    if ((c as any).login_provider === "instagram") {
      const {verifyDirectInstagramConnection}=await import("./instagram-direct.server");
      const check=await verifyDirectInstagramConnection(admin,c.id);
      results.push({id:c.id,status:check.status});
      continue;
    }
    if (cfg.missing.length) throw new Error(`Secrets do Login Facebook ausentes: ${cfg.missing.join(", ")}`);
    let status = "ativa";
    let erro: string | null = null;
    let expira: string | null = null;
    let scopes: string[] | null = null;
    try {
      const token = await getUserToken(admin, c.id);
      if (!token) throw new GraphError("Token não encontrado", 190);
      const dbg = await graphGet<any>(`${cfg.graph}/debug_token`, {
        input_token: token,
        access_token: `${cfg.appId}|${cfg.appSecret}`,
      });
      const d = dbg.data || {};
      scopes = d.scopes || [];
      if (d.expires_at) expira = new Date(d.expires_at * 1000).toISOString();
      if (!d.is_valid) {
        const sub = d.error?.subcode;
        status =
          sub === 458 || sub === 460
            ? "revogada"
            : d.expires_at && d.expires_at * 1000 < Date.now()
              ? "token_expirado"
              : "revogada";
        erro = d.error?.message || "Token inválido";
      } else if (!REQUIRED_CORE.every((s) => scopes!.includes(s))) {
        status = "permissao_insuficiente";
        erro =
          "Permissões essenciais ausentes: " +
          REQUIRED_CORE.filter((s) => !scopes!.includes(s)).join(", ");
      }
    } catch (e: any) {
      status = e?.code === 190 ? "token_expirado" : "erro";
      erro = String(e?.message || e).slice(0, 500);
    }

    await admin
      .from("meta_connections")
      .update({
        status,
        ultimo_erro: erro,
        ultima_verificacao: new Date().toISOString(),
        ...(expira ? { expira_em: expira } : {}),
        ...(scopes ? { escopos_concedidos: scopes } : {}),
      })
      .eq("id", c.id);

    // Test each IG account profile read
    const { data: accounts } = await admin
      .from("instagram_accounts")
      .select("id, ig_user_id, page_id")
      .eq("connection_id", c.id);
    for (const a of accounts || []) {
      if (status !== "ativa") {
        await admin.from("instagram_accounts").update({ status, ultimo_erro: erro }).eq("id", a.id);
        continue;
      }
      try {
        const tk =
          (a.page_id && (await getPageToken(admin, c.id, a.page_id))) ||
          (await getUserToken(admin, c.id));
        const prof = await graphGet<any>(`${cfg.graph}/${a.ig_user_id}`, {
          fields: "id,username,name,profile_picture_url,followers_count",
          access_token: tk!,
        });
        await admin
          .from("instagram_accounts")
          .update({
            status: "ativa",
            ultimo_erro: null,
            username: prof.username ?? null,
            nome: prof.name ?? null,
            foto_url: prof.profile_picture_url ?? null,
            seguidores: prof.followers_count ?? null,
            permissoes_efetivas: (scopes || []).filter((s) => s.startsWith("instagram_")),
          })
          .eq("id", a.id);
      } catch (e: any) {
        await admin
          .from("instagram_accounts")
          .update({
            status: e?.code === 10 || e?.code === 200 ? "permissao_insuficiente" : "erro",
            ultimo_erro: String(e?.message || e).slice(0, 500),
          })
          .eq("id", a.id);
      }
    }
    const { raiseAlert, resolveAlerts } = await import("./alerts.server");
    if (status !== "ativa") {
      await raiseAlert(admin, {
        instagram_account_id: null,
        tipo: "conexao",
        chave: c.id,
        severidade: "alta",
        mensagem: `Conexão com a Meta com problema (${status}): ${erro ?? "verifique em Contas conectadas"}. Use “Reconectar”.`,
      });
    } else await resolveAlerts(admin, null, "conexao", c.id);
    if (expira && new Date(expira).getTime() - Date.now() < 7 * 86_400_000) {
      await raiseAlert(admin, {
        instagram_account_id: null,
        tipo: "token_expirando",
        chave: c.id,
        severidade: "media",
        mensagem: `O acesso à Meta expira em ${new Date(expira).toLocaleDateString("pt-BR")}. Clique em “Reconectar” em Contas conectadas antes disso.`,
      });
    } else await resolveAlerts(admin, null, "token_expirando", c.id);
    results.push({ id: c.id, status });
  }
  return results;
}

export function buildAuthorizeUrl(state: string) {
  const cfg = metaConfig();
  const u = new URL(`https://www.facebook.com/${cfg.version}/dialog/oauth`);
  u.searchParams.set("client_id", cfg.appId);
  u.searchParams.set("redirect_uri", cfg.redirectUri);
  u.searchParams.set("state", state);
  u.searchParams.set("response_type", "code");
  if (cfg.configId) u.searchParams.set("config_id", cfg.configId);
  else u.searchParams.set("scope", META_SCOPES.join(","));
  return u.toString();
}
