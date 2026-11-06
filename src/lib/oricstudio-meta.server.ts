// Servidor OricStúdio: credenciais OAuth exclusivas por clínica.
// Nunca importar no bundle do navegador nem registrar tokens em logs.
import { createHash, randomBytes } from "node:crypto";
import { ORICSTUDIO_PLATAFORMA_ID } from "@/lib/oricstudio-plataforma";

type Db = any;
const ehAmbienteDaPlataforma = (id: string) => id === ORICSTUDIO_PLATAFORMA_ID;
const filtrarPorAmbiente = (query: any, id: string) =>
  ehAmbienteDaPlataforma(id) ? query.is("clinica_id", null) : query.eq("clinica_id", id);
const idNoBanco = (id: string) => ehAmbienteDaPlataforma(id) ? null : id;
export type MetaConta = {
  id: string; clinica_id: string | null; instagram_user_id: string; username: string;
  account_type: string | null; status: string; escopos: string[];
  conectado_em: string; token_expira_em: string | null;
};

const UNIFIED_SCOPES = [
  "instagram_basic",
  "instagram_content_publish",
  "instagram_manage_comments",
];

export function metaConfig() {
  const clientId = (process.env["ORICSTUDIO_META_CLIENT_ID"] || "").trim();
  const clientSecret = (process.env["ORICSTUDIO_META_CLIENT_SECRET"] || "").trim();
  const redirectUri = (process.env["ORICSTUDIO_META_REDIRECT_URI"] ||
    "https://oricse.vetericio.workers.dev/api/oricstudio/meta/callback").trim();
  const encryptionKey = process.env["ORICSTUDIO_META_ENCRYPTION_KEY"] || "";
  const configId = (process.env["ORICSTUDIO_META_CONFIG_ID"] || "").trim();
  const u = new URL(redirectUri);
  if (u.protocol !== "https:" || u.pathname !== "/api/oricstudio/meta/callback" || u.search || u.hash) {
    throw new Error("Redirect URI do OricStúdio inválido.");
  }
  const keyBytes = Buffer.from(encryptionKey, "base64");
  // Instagram App ID (Instagram > API setup with Instagram Login) é numérico.
  // Um ID do produto Facebook/Meta também pode ser numérico: só a Meta valida
  // se o app correto está associado a este login e a esta redirect URI.
  const clientIdFormatoValido = /^\d{8,30}$/.test(clientId);
  const configIdFormatoValido = /^\d{8,30}$/.test(configId);
  const configured = Boolean(clientIdFormatoValido && clientSecret && keyBytes.length === 32 && configIdFormatoValido);
  return {
    clientId,clientSecret,redirectUri,encryptionKey,configId,configured,
    clientIdFormatoValido,configIdFormatoValido,
    temAppSecret:Boolean(clientSecret),temChaveCriptografiaValida:keyBytes.length===32,
  };
}

function sha256(data: string) {return createHash("sha256").update(data).digest("hex");}

async function aesKey() {
  const keyBytes = Buffer.from(metaConfig().encryptionKey, "base64");
  if (keyBytes.byteLength !== 32) throw new Error("Chave de proteção do OricStúdio não configurada.");
  return crypto.subtle.importKey("raw",keyBytes,{name:"AES-GCM"},false,["encrypt","decrypt"]);
}

export async function encryptMetaToken(token: string) {
  const iv = randomBytes(12);
  const bytes = new TextEncoder().encode(token);
  const cipher = await crypto.subtle.encrypt({name:"AES-GCM",iv},await aesKey(),bytes);
  return {
    token_cifrado_base64:Buffer.from(cipher).toString("base64"),
    iv_base64:iv.toString("base64"),
  };
}

async function decryptMetaToken(ciphertext:string,ivBase64:string):Promise<string> {
  const iv=Buffer.from(ivBase64,"base64");
  if(iv.length!==12)throw new Error("Credencial Meta inválida.");
  const bytes=Buffer.from(ciphertext,"base64");
  const decrypted=await crypto.subtle.decrypt({name:"AES-GCM",iv},await aesKey(),bytes);
  return new TextDecoder().decode(decrypted);
}

async function metaRefreshToken(token:string) {
  const u=new URL("https://graph.instagram.com/refresh_access_token");
  u.searchParams.set("grant_type","ig_refresh_token");
  u.searchParams.set("access_token",token);
  const response=await graphGet(u);
  if(typeof response.access_token!=="string" || !Number.isFinite(Number(response.expires_in))
    || Number(response.expires_in)<=0)throw new Error("A Meta não forneceu token renovado.");
  return {token:response.access_token,expiresAt:new Date(Date.now()+Number(response.expires_in)*1000).toISOString()};
}

export async function verifyAndRefreshMetaAccount(db:Db,accessToken:string,clinicaId:string,contaId:string) {
  const {userId}=await requireMetaEditor(db,accessToken,clinicaId,true);
  const {data:account,error:accountErr}=await filtrarPorAmbiente(db.from("oricstudio_meta_contas")
    .select("id,instagram_user_id,status").eq("id",contaId),clinicaId).maybeSingle();
  if(accountErr||!account||account.status==="desconectada")
    throw new Error("Conta não encontrada nesta clínica.");
  const {data:secret,error:secretErr}=await db.from("oricstudio_meta_tokens")
    .select("token_cifrado_base64,iv_base64").eq("conta_id",contaId).maybeSingle();
  if(secretErr||!secret)throw new Error("Conta sem credencial Meta ativa.");
  try {
    const token=await decryptMetaToken(secret.token_cifrado_base64,secret.iv_base64);
    const profileUrl=new URL(`https://graph.facebook.com/v26.0/${encodeURIComponent(account.instagram_user_id)}`);
    profileUrl.searchParams.set("fields","id,username,account_type");
    profileUrl.searchParams.set("access_token",token);
    const profile=await graphGet(profileUrl);
    if(!profile.id||!profile.username)throw new Error("Conta profissional não confirmada.");
    const {error:updateErr}=await filtrarPorAmbiente(db.from("oricstudio_meta_contas").update({
      username:String(profile.username),account_type:profile.account_type?String(profile.account_type):null,
      status:"ativa",ultimo_erro:null,atualizado_em:new Date().toISOString(),
    }),clinicaId).eq("id",contaId);
    if(updateErr)throw new Error("Falha ao atualizar estado da conta.");
    await db.from("oricstudio_meta_auditoria").insert({
      clinica_id:idNoBanco(clinicaId),conta_id:contaId,usuario_id:userId,
      acao:"verificar",detalhes:{resultado:"sucesso",modo:"login_unificado"},
    });
    return {ok:true,renovada:false,username:String(profile.username)};
  } catch {
    await filtrarPorAmbiente(db.from("oricstudio_meta_contas").update({
      status:"reautenticar",ultimo_erro:"Falha na validação da credencial Meta",
      atualizado_em:new Date().toISOString(),
    }),clinicaId).eq("id",contaId);
    throw new Error("Não foi possível verificar a conexão Meta. Conecte a conta novamente.");
  }
}


export async function requireMetaEditor(db: Db, token: string, clinicaId: string, exigirAtiva = true) {
  const {data:result,error}=await db.auth.getUser(token);
  if(error||!result?.user?.id)throw new Error("Sessão ORICSE inválida ou expirada.");
  const userId = result.user.id;
  const [{data:admin},{data:link},{data:lic},{data:clinic}]=await Promise.all([
    db.from("app_users").select("role").eq("user_id",userId).maybeSingle(),
    db.from("clinica_usuarios").select("ativo,papel").eq("user_id",userId).eq("clinica_id",clinicaId).maybeSingle(),
    db.from("oricstudio_licencas").select("status,expira_em").eq("clinica_id",clinicaId).maybeSingle(),
    db.from("clinicas").select("status").eq("id",clinicaId).maybeSingle(),
  ]);
  const isPlatformAdmin=admin?.role==="admin";
  if (ehAmbienteDaPlataforma(clinicaId)) {
    if (!isPlatformAdmin) throw new Error("Acesso reservado à Administração Geral do ORICSE.");
    return {userId,isPlatformAdmin:true};
  }
  const editor=Boolean(link?.ativo && ["responsavel","admin_clinica","rt"].includes(link.papel));
  if (!isPlatformAdmin && !editor) throw new Error("Somente responsáveis e administradores podem conectar a Meta.");
  if (exigirAtiva && (
    clinic?.status!=="ativa" || lic?.status!=="ativo" ||
    (lic.expira_em && Date.parse(lic.expira_em)<=Date.now())
  )) throw new Error("O OricStúdio precisa estar ativo para conectar uma conta.");
  return {userId,isPlatformAdmin};
}

export async function requireMetaEditorByUser(db: Db,userId:string,clinicaId:string) {
  const [{data:admin},{data:link},{data:lic},{data:clinic}]=await Promise.all([
    db.from("app_users").select("role").eq("user_id",userId).maybeSingle(),
    db.from("clinica_usuarios").select("ativo,papel").eq("user_id",userId).eq("clinica_id",clinicaId).maybeSingle(),
    db.from("oricstudio_licencas").select("status,expira_em").eq("clinica_id",clinicaId).maybeSingle(),
    db.from("clinicas").select("status").eq("id",clinicaId).maybeSingle(),
  ]);
  if (ehAmbienteDaPlataforma(clinicaId)) {
    if (admin?.role!=="admin") throw new Error("A autorização de administrador ORICSE foi revogada.");
    return;
  }
  if (admin?.role!=="admin" && !(link?.ativo&&["responsavel","admin_clinica","rt"].includes(link.papel))) {
    throw new Error("A autorização do usuário para esta clínica foi revogada.");
  }
  if (clinic?.status!=="ativa" || lic?.status!=="ativo" ||
      (lic.expira_em&&Date.parse(lic.expira_em)<=Date.now()))
    throw new Error("Licença do OricStúdio indisponível.");
}

export async function authorizeMetaUrl(db: Db, accessToken: string, clinicaId: string) {
  const {userId,isPlatformAdmin}=await requireMetaEditor(db,accessToken,clinicaId);
  if (!isPlatformAdmin) {
    const {data:ativa}=await db.from("oricse_clinica_ativa_usuario")
      .select("clinica_id").eq("user_id",userId).maybeSingle();
    if (ativa?.clinica_id!==clinicaId) throw new Error("Selecione esta clínica antes de conectar o Instagram.");
  }
  const cfg=metaConfig();
  if(!cfg.configured)throw new Error("O OricStúdio precisa do App ID, App Secret, Configuration ID do Login Unificado e chave de criptografia configurados.");
  const state=randomBytes(32).toString("base64url");
  const {error}=await db.from("oricstudio_meta_oauth_states").insert({
    state_hash:sha256(state),clinica_id:idNoBanco(clinicaId),iniciado_por:userId,
    expira_em:new Date(Date.now()+10*60*1000).toISOString(),
  });
  if(error)throw new Error("Não foi possível iniciar a conexão.");
  // Apps recentes usam Instagram API with Unified Login. O config_id da
  // configuração selecionada na Meta substitui escopos na URL de autorização.
  const url=new URL("https://www.facebook.com/dialog/oauth");
  url.searchParams.set("client_id",cfg.clientId);
  url.searchParams.set("config_id",cfg.configId);
  url.searchParams.set("redirect_uri",cfg.redirectUri);
  url.searchParams.set("response_type","code");
  url.searchParams.set("prompt","login");
  url.searchParams.set("state",state);
  return url.toString();
}

async function postForToken(url: string, fields: Record<string,string>) {
  const r=await fetch(url,{
    method:"POST",
    headers:{"Content-Type":"application/x-www-form-urlencoded"},
    body:new URLSearchParams(fields),
  });
  const body=await r.json().catch(()=>null) as any;
  // A Meta pode retornar o token diretamente ou em data[0].
  const data=body?.access_token ? body :
    (Array.isArray(body?.data) && body.data.length===1 ? body.data[0] : null);
  if(!r.ok||typeof data?.access_token!=="string"||!data.access_token)
    throw new Error("Não foi possível trocar a autorização com a Meta.");
  return data;
}

async function graphGet(url:URL) {
  const r=await fetch(url.toString(),{headers:{"Accept":"application/json"}});
  const body=await r.json().catch(()=>null) as any;
  if(!r.ok||!body||body.error)throw new Error("A Meta não confirmou a conexão.");
  return body;
}

export async function finalizeMetaOAuth(db: Db, state: string, code: string) {
  const stateHash=sha256(state);
  const {data:flow,error:flowErr}=await db.from("oricstudio_meta_oauth_states")
    .select("state_hash,clinica_id,iniciado_por,expira_em,usado_em").eq("state_hash",stateHash).maybeSingle();
  if(flowErr||!flow||flow.usado_em||Date.parse(flow.expira_em)<=Date.now())
    throw new Error("Autorização expirada ou já utilizada.");
  const {data:consumed,error:consumedErr}=await db.from("oricstudio_meta_oauth_states")
    .update({usado_em:new Date().toISOString()}).eq("state_hash",stateHash)
    .is("usado_em",null).gt("expira_em",new Date().toISOString()).select("state_hash").maybeSingle();
  if(consumedErr||!consumed)throw new Error("Esta autorização já foi usada.");
  await requireMetaEditorByUser(db,flow.iniciado_por,flow.clinica_id || ORICSTUDIO_PLATAFORMA_ID);
  const cfg=metaConfig();
  if(!cfg.configured)throw new Error("Integração Meta ainda não configurada.");
  const tokenUrl=new URL("https://graph.facebook.com/v26.0/oauth/access_token");
  tokenUrl.searchParams.set("client_id",cfg.clientId);
  tokenUrl.searchParams.set("client_secret",cfg.clientSecret);
  tokenUrl.searchParams.set("redirect_uri",cfg.redirectUri);
  tokenUrl.searchParams.set("code",code);
  const token=await graphGet(tokenUrl);
  if(typeof token.access_token!=="string"||!token.access_token)
    throw new Error("A Meta não retornou a credencial da integração.");
  const accountsUrl=new URL("https://graph.facebook.com/v26.0/me/assigned_instagram_accounts");
  accountsUrl.searchParams.set("fields","id,username,account_type");
  accountsUrl.searchParams.set("access_token",token.access_token);
  const assigned=await graphGet(accountsUrl);
  const accounts=(Array.isArray(assigned.data)?assigned.data:[]).map((account:any)=>({
    instagramUserId:String(account?.id||"").trim(),
    username:String(account?.username||"").trim(),
    accountType:account?.account_type?String(account.account_type):null,
  })).filter((account:{instagramUserId:string;username:string})=>account.instagramUserId&&account.username);
  if(!accounts.length)throw new Error("A Meta não compartilhou nenhuma conta profissional. Selecione uma conta Business ou Creator do portfólio correto e tente novamente.");
  const expiry=Number(token.expires_in)>0?new Date(Date.now()+Number(token.expires_in)*1000).toISOString():null;
  const encrypted=await encryptMetaToken(token.access_token);
  const saved:string[]=[];
  for(const metaAccount of accounts) {
    const {data:existing,error:existingErr}=await db.from("oricstudio_meta_contas")
      .select("id,clinica_id").eq("instagram_user_id",metaAccount.instagramUserId).maybeSingle();
    if(existingErr)throw new Error("Não foi possível confirmar o vínculo da conta.");
    if(existing&&existing.clinica_id!==flow.clinica_id)
      throw new Error("Uma das contas do Instagram já está vinculada a outra clínica.");
    const values={
      clinica_id:flow.clinica_id,instagram_user_id:metaAccount.instagramUserId,username:metaAccount.username,
      account_type:metaAccount.accountType,status:"incompleta",escopos:UNIFIED_SCOPES,
      conectado_por:flow.iniciado_por,token_expira_em:expiry,atualizado_em:new Date().toISOString(),ultimo_erro:null,
    };
    const q=existing
      ? filtrarPorAmbiente(db.from("oricstudio_meta_contas").update(values).eq("id",existing.id),flow.clinica_id || ORICSTUDIO_PLATAFORMA_ID).select("id").single()
      : db.from("oricstudio_meta_contas").insert(values).select("id").single();
    const {data:account,error:accountErr}=await q;
    if(accountErr||!account?.id)throw new Error("Não foi possível salvar a conta profissional.");
    const {error:secretErr}=await db.from("oricstudio_meta_tokens").upsert({
      conta_id:account.id,...encrypted,token_expira_em:expiry,atualizado_em:new Date().toISOString(),
    },{onConflict:"conta_id"});
    if(secretErr)throw new Error("Não foi possível armazenar o token protegido.");
    const {error:activateErr}=await filtrarPorAmbiente(db.from("oricstudio_meta_contas")
      .update({status:"ativa",atualizado_em:new Date().toISOString()})
      .eq("id",account.id),flow.clinica_id || ORICSTUDIO_PLATAFORMA_ID);
    if(activateErr)throw new Error("Conta registrada, aguardando validação.");
    await db.from("oricstudio_meta_auditoria").insert({
      clinica_id:flow.clinica_id,conta_id:account.id,usuario_id:flow.iniciado_por,
      acao:"conectar",detalhes:{username:metaAccount.username,account_type:metaAccount.accountType,modo:"login_unificado"},
    });
    saved.push(metaAccount.username);
  }
  return {username:saved.join(", "),plataforma:flow.clinica_id===null};
}

export async function metaListForClinic(db:Db,accessToken:string,clinicaId:string) {
  await requireMetaEditor(db,accessToken,clinicaId,false);
  const {data,error}=await filtrarPorAmbiente(db.from("oricstudio_meta_contas")
    .select("id,clinica_id,instagram_user_id,username,account_type,status,escopos,conectado_em,token_expira_em"),
    clinicaId).order("conectado_em",{ascending:false});
  if(error)throw new Error("Não foi possível consultar as contas conectadas.");
  return (data||[]) as MetaConta[];
}

export async function metaDisconnect(db:Db,accessToken:string,clinicaId:string,accountId:string) {
  const {userId}=await requireMetaEditor(db,accessToken,clinicaId,false);
  const {data:acct,error}=await filtrarPorAmbiente(db.from("oricstudio_meta_contas")
    .select("id,instagram_user_id").eq("id",accountId),clinicaId).maybeSingle();
  if(error||!acct)throw new Error("Conta não encontrada nesta clínica.");
  const {error:secretErr}=await db.from("oricstudio_meta_tokens").delete().eq("conta_id",accountId);
  if(secretErr)throw new Error("Não foi possível excluir as credenciais.");
  const {error:updateErr}=await filtrarPorAmbiente(db.from("oricstudio_meta_contas")
    .update({status:"desconectada",atualizado_em:new Date().toISOString()})
    .eq("id",accountId),clinicaId);
  if(updateErr)throw new Error("Credenciais excluídas; consulte o status da conta.");
  await db.from("oricstudio_meta_auditoria").insert({
    clinica_id:idNoBanco(clinicaId),conta_id:accountId,usuario_id:userId,
    acao:"desconectar",detalhes:{revogacao_local:true},
  });
  return {ok:true};
}
