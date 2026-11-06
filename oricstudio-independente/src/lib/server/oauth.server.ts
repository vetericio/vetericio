// OAuth 2.1 authorization server for the MCP connector (ChatGPT, Codex and compatible clients). Public clients only (PKCE S256,
// no client secret), dynamic client registration, rotating refresh tokens. Only SHA-256 hashes of
// codes and tokens are stored. Server only.
import { randomToken, sha256Hex, b64UrlToBytes, timingSafeEqualBytes } from "./crypto.server";
import type { Actor } from "./posts.server";

type Admin = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];

export const ACCESS_TTL_S = 60 * 60;
const REFRESH_TTL_S = 30 * 24 * 60 * 60;
const CODE_TTL_S = 5 * 60;

export class OAuthError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

/** Public origin of the app (https outside local development). */
export function baseUrl(request: Request) {
  const u = new URL(request.url);
  const local = u.hostname === "localhost" || u.hostname === "127.0.0.1";
  return `${local ? u.protocol : "https:"}//${u.host}`;
}

export function authServerMetadata(base: string) {
  return {
    issuer: base,
    authorization_endpoint: `${base}/api/public/oauth/authorize`,
    token_endpoint: `${base}/api/public/oauth/token`,
    registration_endpoint: `${base}/api/public/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: ["gestor"],
  };
}

export function protectedResourceMetadata(base: string) {
  return {
    resource: `${base}/api/public/mcp`,
    authorization_servers: [base],
    bearer_methods_supported: ["header"],
    scopes_supported: ["gestor"],
    resource_name: "Gestor Instagram",
  };
}

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Authorization, Content-Type, Mcp-Protocol-Version, Mcp-Session-Id",
  "Access-Control-Expose-Headers": "WWW-Authenticate, Mcp-Session-Id",
};

export function oauthJson(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return Response.json(body, {
    status,
    headers: { ...CORS, "Cache-Control": "no-store", ...extra },
  });
}

export function oauthErrorResponse(e: unknown) {
  if (e instanceof OAuthError)
    return oauthJson({ error: e.code, error_description: e.message }, e.status);
  console.error("oauth", e);
  return oauthJson({ error: "server_error", error_description: "Erro interno." }, 500);
}

/** Only known ChatGPT/Claude callbacks and loopback development callbacks may receive codes. */
export function allowedRedirect(uri: string) {
  let u: URL;
  try {
    u = new URL(uri);
  } catch {
    return false;
  }
  if (u.hash) return false;
  if (u.protocol === "https:") {
    if (["claude.ai", "claude.com"].includes(u.hostname)) return true;
    // ChatGPT uses either a callback-specific URI or the issuer-bound stable callback.
    return (
      u.hostname === "chatgpt.com" &&
      (u.pathname === "/connector_platform_oauth_redirect" ||
        /^\/connector\/oauth\/[A-Za-z0-9_-]+$/.test(u.pathname))
    );
  }
  return u.protocol === "http:" && ["localhost", "127.0.0.1"].includes(u.hostname);
}

export async function registerClient(admin: Admin, body: unknown) {
  const b = (body ?? {}) as { redirect_uris?: unknown; client_name?: unknown };
  const uris = Array.isArray(b.redirect_uris)
    ? b.redirect_uris.filter((x): x is string => typeof x === "string")
    : [];
  if (!uris.length || uris.length > 5 || !uris.every(allowedRedirect))
    throw new OAuthError(
      "invalid_redirect_uri",
      "Use um endereço de retorno oficial do ChatGPT, Claude ou um loopback local.",
    );
  const client_name = typeof b.client_name === "string" ? b.client_name.slice(0, 100) : "MCP client";
  const client_id = `mcp_${randomToken(18)}`;
  const { error } = await admin
    .from("oauth_clients")
    .insert({ client_id, client_name, redirect_uris: uris });
  if (error) throw new Error(error.message);
  return {
    client_id,
    client_name,
    redirect_uris: uris,
    client_id_issued_at: Math.floor(Date.now() / 1000),
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
  };
}

export type AuthorizeParams = {
  client_id: string;
  redirect_uri: string;
  code_challenge: string;
  state: string | null;
};

/** Validates an authorization request. Errors before the redirect URI is trusted are never redirected. */
export async function validateAuthorize(
  admin: Admin,
  p: Record<string, string | null | undefined>,
) {
  const client_id = p["client_id"] ?? "";
  const { data: client } = await admin
    .from("oauth_clients")
    .select("client_id, client_name, redirect_uris")
    .eq("client_id", client_id)
    .maybeSingle();
  if (!client)
    throw new OAuthError(
      "invalid_client",
      "Cliente desconhecido. Remova e adicione o conector novamente no ChatGPT.",
    );
  const redirect_uri = p["redirect_uri"] ?? client.redirect_uris[0] ?? "";
  if (!client.redirect_uris.includes(redirect_uri) || !allowedRedirect(redirect_uri))
    throw new OAuthError(
      "invalid_request",
      "Endereço de retorno não registrado para este cliente.",
    );
  if ((p["response_type"] ?? "") !== "code")
    throw new OAuthError("unsupported_response_type", "Use response_type=code.");
  const code_challenge = p["code_challenge"] ?? "";
  if ((p["code_challenge_method"] ?? "") !== "S256" || !/^[A-Za-z0-9_-]{43}$/.test(code_challenge))
    throw new OAuthError("invalid_request", "PKCE S256 é obrigatório.");
  return {
    params: {
      client_id,
      redirect_uri,
      code_challenge,
      state: p["state"] ?? null,
    } as AuthorizeParams,
    clientName: client.client_name ?? "MCP client",
  };
}

export function redirectWith(redirect_uri: string, values: Record<string, string | null>) {
  const u = new URL(redirect_uri);
  for (const [k, v] of Object.entries(values)) if (v != null) u.searchParams.set(k, v);
  return u.toString();
}

export async function createCode(admin: Admin, userId: string, p: AuthorizeParams) {
  const code = randomToken(32);
  const { error } = await admin.from("oauth_codes").insert({
    code_hash: await sha256Hex(code),
    client_id: p.client_id,
    user_id: userId,
    redirect_uri: p.redirect_uri,
    code_challenge: p.code_challenge,
    expires_at: new Date(Date.now() + CODE_TTL_S * 1000).toISOString(),
  });
  if (error) throw new Error(error.message);
  return code;
}

export async function pkceMatches(verifier: string, challenge: string) {
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) return false;
  const d = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)),
  );
  return timingSafeEqualBytes(d, b64UrlToBytes(challenge));
}

async function issueTokens(admin: Admin, client_id: string, user_id: string) {
  const access = randomToken(32);
  const refresh = randomToken(32);
  const { error } = await admin.from("oauth_tokens").insert({
    client_id,
    user_id,
    access_hash: await sha256Hex(access),
    refresh_hash: await sha256Hex(refresh),
    expires_at: new Date(Date.now() + ACCESS_TTL_S * 1000).toISOString(),
    refresh_expires_at: new Date(Date.now() + REFRESH_TTL_S * 1000).toISOString(),
  });
  if (error) throw new Error(error.message);
  return {
    access_token: access,
    token_type: "Bearer",
    expires_in: ACCESS_TTL_S,
    refresh_token: refresh,
    scope: "gestor",
  };
}

export async function exchangeToken(admin: Admin, form: URLSearchParams) {
  const grant = form.get("grant_type");
  const client_id = form.get("client_id") ?? "";
  const now = new Date().toISOString();

  if (grant === "authorization_code") {
    const code = form.get("code") ?? "";
    const { data: row } = await admin
      .from("oauth_codes")
      .select("*")
      .eq("code_hash", await sha256Hex(code))
      .maybeSingle();
    if (!row || row.used_at || row.expires_at < now)
      throw new OAuthError("invalid_grant", "Código inválido ou expirado.");
    // Single use: mark first, so a replayed code fails even if the rest of the request does.
    const { data: claimed } = await admin
      .from("oauth_codes")
      .update({ used_at: now })
      .eq("code_hash", row.code_hash)
      .is("used_at", null)
      .select("code_hash")
      .maybeSingle();
    if (!claimed) throw new OAuthError("invalid_grant", "Código já utilizado.");
    if (row.client_id !== client_id)
      throw new OAuthError("invalid_grant", "Código emitido para outro cliente.");
    const redirect = form.get("redirect_uri");
    if (redirect != null && redirect !== row.redirect_uri)
      throw new OAuthError("invalid_grant", "redirect_uri diferente.");
    if (!(await pkceMatches(form.get("code_verifier") ?? "", row.code_challenge)))
      throw new OAuthError("invalid_grant", "code_verifier inválido.");
    return issueTokens(admin, row.client_id, row.user_id);
  }

  if (grant === "refresh_token") {
    const hash = await sha256Hex(form.get("refresh_token") ?? "");
    const { data: tok } = await admin
      .from("oauth_tokens")
      .select("id, client_id, user_id, refresh_expires_at, revogado_em")
      .eq("refresh_hash", hash)
      .maybeSingle();
    if (!tok || tok.revogado_em || !tok.refresh_expires_at || tok.refresh_expires_at < now)
      throw new OAuthError(
        "invalid_grant",
        "Sessão do conector expirada ou revogada. Conecte de novo.",
      );
    if (client_id && tok.client_id !== client_id)
      throw new OAuthError("invalid_grant", "Token de outro cliente.");
    // Rotation: the old pair stops working as soon as the new one is issued.
    const { data: rotated } = await admin
      .from("oauth_tokens")
      .update({ revogado_em: now, refresh_hash: null })
      .eq("id", tok.id)
      .is("revogado_em", null)
      .select("id")
      .maybeSingle();
    if (!rotated) throw new OAuthError("invalid_grant", "Token já utilizado.");
    return issueTokens(admin, tok.client_id, tok.user_id);
  }

  throw new OAuthError("unsupported_grant_type", "Use authorization_code ou refresh_token.");
}

/** Resolves a bearer access token to the connector actor (subject to the automation rules). */
export async function verifyAccess(
  admin: Admin,
  request: Request,
): Promise<{ actor: Actor; userId: string; email: string | null } | null> {
  const token = /^Bearer ([A-Za-z0-9_-]{20,200})$/.exec(
    request.headers.get("authorization") ?? "",
  )?.[1];
  if (!token) return null;
  const { data: tok } = await admin
    .from("oauth_tokens")
    .select("id, user_id, expires_at, revogado_em")
    .eq("access_hash", await sha256Hex(token))
    .maybeSingle();
  if (!tok || tok.revogado_em || tok.expires_at < new Date().toISOString()) return null;
  const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", tok.user_id);
  if (!(roles ?? []).some((r) => r.role === "admin" || r.role === "editor")) return null;
  await admin
    .from("oauth_tokens")
    .update({ ultimo_uso: new Date().toISOString() })
    .eq("id", tok.id);
  const { data: u } = await admin.auth.admin.getUserById(tok.user_id);
  const email = u.user?.email ?? null;
  return {
    actor: { userId: null, email: `mcp:${email ?? tok.user_id}`, role: "assistente" },
    userId: tok.user_id,
    email,
  };
}
