// OricStudio: Instagram Login direto. Aplicativo, tokens e banco independentes do Gestor 2.0.
// Nao copiar chaves do Gestor e nunca enviar tokens ao navegador.
import { assertIndependentOricStudio } from "./instance-guard.server";
import { encryptToken } from "./crypto.server";
import { getUserToken } from "./meta.server";

type Admin = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];
const IG_SCOPES = [
  "instagram_business_basic",
  "instagram_business_content_publish",
  "instagram_business_manage_comments",
  "instagram_business_manage_insights",
] as const;
const GRAPH = "https://graph.instagram.com";

export function instagramDirectConfig() {
  assertIndependentOricStudio();
  const appId = (process.env["IG_APP_ID"] || "").trim();
  const appSecret = process.env["IG_APP_SECRET"] || "";
  const baseUrl = (process.env["APP_BASE_URL"] || "").replace(/\/+$/, "");
  const missing: string[] = [];
  if (!/^\d{8,30}$/.test(appId)) missing.push("IG_APP_ID");
  if (!appSecret) missing.push("IG_APP_SECRET");
  if (!baseUrl || !baseUrl.startsWith("https://")) missing.push("APP_BASE_URL");
  if (!process.env["TOKEN_ENCRYPTION_KEY"]) missing.push("TOKEN_ENCRYPTION_KEY");
  return {
    appId, appSecret, baseUrl, missing,
    redirectUri: `${baseUrl}/api/public/instagram-oauth-callback`,
    scopes: [...IG_SCOPES],
  };
}

export function buildInstagramAuthorizeUrl(state: string) {
  const cfg = instagramDirectConfig();
  if (cfg.missing.length) throw new Error(`Conexão direta não configurada: ${cfg.missing.join(", ")}`);
  if (!/^[a-zA-Z0-9_-]{32,128}$/.test(state)) throw new Error("Estado OAuth inválido.");
  const url = new URL("https://www.instagram.com/oauth/authorize");
  url.searchParams.set("client_id", cfg.appId);
  url.searchParams.set("redirect_uri", cfg.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", cfg.scopes.join(","));
  url.searchParams.set("state", state);
  return url.toString();
}

async function fetchJson(url: string, init: RequestInit = {}) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(25_000) });
  const json: any = await response.json().catch(() => null);
  if (!response.ok || !json || json.error) {
    // Não incluir a URL (pode conter token), segredos ou resposta integral da Meta no erro.
    throw new Error("A Meta não confirmou a autorização direta do Instagram.");
  }
  return json;
}

async function graphInstagram(path: string, params: Record<string,string>) {
  const url = new URL(`${GRAPH}${path}`);
  for (const [k,v] of Object.entries(params)) url.searchParams.set(k,v);
  return fetchJson(url.toString());
}

export async function finalizeInstagramDirect(admin: Admin, userId: string, code: string) {
  const cfg = instagramDirectConfig();
  if (cfg.missing.length) throw new Error("Integração direta do Instagram não configurada.");
  if (!code || code.length > 4096) throw new Error("Código OAuth inválido.");
  const short = await fetchJson("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: cfg.appId, client_secret: cfg.appSecret,
      grant_type: "authorization_code", redirect_uri: cfg.redirectUri, code,
    }),
  });
  if (typeof short.access_token !== "string" || !short.access_token) {
    throw new Error("A Meta não forneceu o token de acesso.");
  }
  const long = await graphInstagram("/access_token", {
    grant_type: "ig_exchange_token",
    client_secret: cfg.appSecret,
    access_token: short.access_token,
  });
  if (typeof long.access_token !== "string" || !long.access_token) {
    throw new Error("Não foi possível obter uma sessão de longa duração.");
  }
  const profile = await graphInstagram("/me", {
    fields: "id,user_id,username,account_type,profile_picture_url,followers_count",
    access_token: long.access_token,
  });
  const igId = String(profile.user_id || profile.id || short.user_id || "").trim();
  const username = String(profile.username || "").trim();
  if (!/^\d+$/.test(igId) || !username) {
    throw new Error("A Meta não confirmou a conta profissional.");
  }
  if (profile.account_type && !["BUSINESS", "MEDIA_CREATOR", "CREATOR"].includes(String(profile.account_type))) {
    throw new Error("É necessário Instagram profissional (Empresa ou Criador).");
  }
  const expiresIn = Number(long.expires_in);
  const expiresAt = Number.isFinite(expiresIn) && expiresIn > 0
    ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;
  const scopes = Array.isArray(short.permissions)
    ? short.permissions.filter((p:unknown):p is string=>typeof p==="string")
    : typeof short.permissions === "string" ? short.permissions.split(",").filter(Boolean) : [];
  const {data:conn,error:connErr} = await admin.from("meta_connections").upsert({
    meta_user_id: `instagram:${igId}`, meta_user_name: username,
    connected_by: userId, login_provider: "instagram",
    status: "ativa", escopos_concedidos: scopes, escopos_recusados: [],
    expira_em: expiresAt, ultima_verificacao: new Date().toISOString(), ultimo_erro: null,
  } as any,{onConflict:"meta_user_id"}).select("id").single();
  if (connErr || !conn?.id) throw new Error("Não foi possível registrar a conexão Instagram.");
  const encrypted = await encryptToken(long.access_token);
  const {data:oldToken} = await admin.from("meta_tokens")
    .select("id").eq("connection_id",conn.id).eq("tipo","user").maybeSingle();
  const tokenValues = {
    connection_id:conn.id,tipo:"user",page_id:null,
    token_criptografado:encrypted.ciphertext,iv:encrypted.iv,expira_em:expiresAt,
  };
  const tokenSave = oldToken?.id
    ? await admin.from("meta_tokens").update(tokenValues).eq("id",oldToken.id)
    : await admin.from("meta_tokens").insert(tokenValues);
  if (tokenSave.error) throw new Error("Não foi possível proteger a credencial Instagram.");
  const {error:accountErr} = await admin.from("instagram_accounts").upsert({
    ig_user_id:igId,username,
    foto_url:typeof profile.profile_picture_url==="string"?profile.profile_picture_url:null,
    seguidores:Number.isFinite(Number(profile.followers_count))?Number(profile.followers_count):null,
    page_id:null, connection_id:conn.id,status:"ativa",
    permissoes_efetivas:scopes,ultimo_erro:null,
  }, {onConflict:"ig_user_id"});
  if (accountErr) throw new Error("Credencial salva, mas houve falha ao registrar o perfil.");
  await admin.from("audit_log").insert({
    user_id:userId,acao:"conectar_instagram_direto",alvo:igId,
    detalhes:{username,login_provider:"instagram"},
  });
  return { username };
}

export async function verifyDirectInstagramConnection(admin:Admin, connectionId:string) {
  let status = "ativa", error: string | null = null, expiresAt: string | null = null;
  let profile:any = null;
  try {
    const token = await getUserToken(admin,connectionId);
    if (!token) throw new Error("Token Instagram não encontrado.");
    const {data:conn} = await admin.from("meta_connections")
      .select("expira_em").eq("id",connectionId).maybeSingle();
    expiresAt = conn?.expira_em ?? null;
    if (expiresAt && Date.parse(expiresAt) <= Date.now()) {
      status = "token_expirado";
      throw new Error("Token Instagram expirado. Reconecte a conta.");
    }
    profile = await graphInstagram("/me",{
      fields:"id,user_id,username,account_type,profile_picture_url,followers_count",
      access_token:token,
    });
    if (!profile?.id && !profile?.user_id) throw new Error("Perfil não encontrado no Instagram.");
    // Acesso de longa duração dura ate 60 dias. Renovar antes de expirar, sem
    // reconectar nem levar o token ao navegador; preserva o token anterior se falhar.
    if (expiresAt && Date.parse(expiresAt)-Date.now()<14*86400_000) {
      const long = await graphInstagram("/refresh_access_token",{
        grant_type:"ig_refresh_token",access_token:token,
      });
      if (typeof long.access_token === "string" && Number(long.expires_in)>0) {
        expiresAt = new Date(Date.now()+Number(long.expires_in)*1000).toISOString();
        const enc=await encryptToken(long.access_token);
        const {error:saveError}=await admin.from("meta_tokens").update({
          token_criptografado:enc.ciphertext,iv:enc.iv,expira_em:expiresAt,
        }).eq("connection_id",connectionId).eq("tipo","user");
        if(saveError)throw new Error("A renovação da credencial não pôde ser salva.");
      }
    }
  }catch(e) {
    if(status!=="token_expirado")status="erro";
    error = e instanceof Error ? e.message.slice(0,280) : "Falha na verificação.";
  }
  await admin.from("meta_connections").update({
    status,ultimo_erro:error,ultima_verificacao:new Date().toISOString(),
    ...(expiresAt?{expira_em:expiresAt}:{}),
  }).eq("id",connectionId);
  const accountUpdate={
    status,ultimo_erro:error,
    ...(profile?.username?{username:String(profile.username)}:{}),
    ...(Number.isFinite(Number(profile?.followers_count))?{seguidores:Number(profile.followers_count)}:{}),
  };
  await admin.from("instagram_accounts").update(accountUpdate)
    .eq("connection_id",connectionId);
  return {status,error,expiresAt};
}
