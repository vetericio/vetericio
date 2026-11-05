// Servidor OricStúdio: credenciais OAuth exclusivas por clínica.
// Nunca importar no bundle do navegador nem registrar tokens em logs.
import { createHash, randomBytes } from "node:crypto";

type Db = any;
export type MetaConta = {
  id: string; clinica_id: string; instagram_user_id: string; username: string;
  account_type: string | null; status: string; escopos: string[];
  conectado_em: string; token_expira_em: string | null;
};

const SCOPES = [
  "instagram_business_basic",
  "instagram_business_content_publish",
  "instagram_business_manage_comments",
  "instagram_business_manage_insights",
].join(",");

export function metaConfig() {
  const clientId = process.env["ORICSTUDIO_META_CLIENT_ID"] || "";
  const clientSecret = process.env["ORICSTUDIO_META_CLIENT_SECRET"] || "";
  const redirectUri = process.env["ORICSTUDIO_META_REDIRECT_URI"] ||
    "https://oricse.vetericio.workers.dev/api/oricstudio/meta/callback";
  const encryptionKey = process.env["ORICSTUDIO_META_ENCRYPTION_KEY"] || "";
  const u = new URL(redirectUri);
  if (u.protocol !== "https:" || u.pathname !== "/api/oricstudio/meta/callback" || u.search || u.hash) {
    throw new Error("Redirect URI do OricStúdio inválido.");
  }
  const keyBytes = Buffer.from(encryptionKey, "base64");
  const configured = Boolean(clientId && clientSecret && keyBytes.length === 32);
  return {clientId,clientSecret,redirectUri,encryptionKey,configured};
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
  if (admin?.role!=="admin" && !(link?.ativo&&["responsavel","admin_clinica","rt"].includes(link.papel))) {
    throw new Error("A autorização do usuário para esta clínica foi revogada.");
  }
  if (clinic?.status!=="ativa" || lic?.status!=="ativo" ||
      (lic.expira_em&&Date.parse(lic.expira_em)<=Date.now()))
    throw new Error("Licença do OricStúdio indisponível.");
}

export async function authorizeMetaUrl(db: Db, accessToken: string, clinicaId: string) {
  const {userId,isPlatformAdmin}=await requireMetaEditor(db,accessToken,clinicaId);
  // A clínica deve ser a selecionada na sessão, exceto para administração central.
  if (!isPlatformAdmin) {
    const {data:ativa}=await db.from("oricse_clinica_ativa_usuario")
      .select("clinica_id").eq("user_id",userId).maybeSingle();
    if (ativa?.clinica_id!==clinicaId) throw new Error("Selecione esta clínica antes de conectar o Instagram.");
  }
  const cfg=metaConfig();
  if(!cfg.configured)throw new Error("Integração Meta pendente de configuração pela Administração Geral.");
  const state=randomBytes(32).toString("base64url");
  const {error}=await db.from("oricstudio_meta_oauth_states").insert({
    state_hash:sha256(state),clinica_id:clinicaId,iniciado_por:userId,
    expira_em:new Date(Date.now()+10*60*1000).toISOString(),
  });
  if(error)throw new Error("Não foi possível iniciar a conexão.");
  const url=new URL("https://www.instagram.com/oauth/authorize");
  url.searchParams.set("client_id",cfg.clientId);
  url.searchParams.set("redirect_uri",cfg.redirectUri);
  url.searchParams.set("response_type","code");
  url.searchParams.set("scope",SCOPES);
  url.searchParams.set("state",state);
  return url.toString();
}

async function postForToken(url: string, fields: Record<string,string>) {
  const r=await fetch(url,{
    method:"POST",
    headers:{"Content-Type":"application/x-www-form-urlencoded"},
    body:new URLSearchParams(fields),
  });
  const data=await r.json().catch(()=>null) as any;
  if(!r.ok||!data?.access_token) throw new Error("Não foi possível trocar a autorização com a Meta.");
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
  await requireMetaEditorByUser(db,flow.iniciado_por,flow.clinica_id);
  const cfg=metaConfig();
  if(!cfg.configured)throw new Error("Integração Meta ainda não configurada.");
  const short=await postForToken("https://api.instagram.com/oauth/access_token",{
    client_id:cfg.clientId,client_secret:cfg.clientSecret,
    grant_type:"authorization_code",redirect_uri:cfg.redirectUri,code,
  });
  const exchange=new URL("https://graph.instagram.com/access_token");
  exchange.searchParams.set("grant_type","ig_exchange_token");
  exchange.searchParams.set("client_secret",cfg.clientSecret);
  exchange.searchParams.set("access_token",short.access_token);
  const long=await graphGet(exchange);
  if (typeof long.access_token!=="string")throw new Error("A Meta não retornou token de longa duração.");
  const profileUrl=new URL("https://graph.instagram.com/me");
  profileUrl.searchParams.set("fields","user_id,username,account_type");
  profileUrl.searchParams.set("access_token",long.access_token);
  const profile=await graphGet(profileUrl);
  const igUserId=String(profile.user_id||profile.id||"").trim();
  const username=String(profile.username||"").trim();
  if(!igUserId||!username)throw new Error("Conta Instagram profissional não identificada.");
  const {data:existing,error:existingErr}=await db.from("oricstudio_meta_contas")
    .select("id,clinica_id").eq("instagram_user_id",igUserId).maybeSingle();
  if(existingErr)throw new Error("Não foi possível confirmar o vínculo da conta.");
  if(existing&&existing.clinica_id!==flow.clinica_id)
    throw new Error("Esta conta do Instagram já está vinculada a outra clínica.");
  const expiry=Number(long.expires_in)>0?new Date(Date.now()+Number(long.expires_in)*1000).toISOString():null;
  const encrypted=await encryptMetaToken(long.access_token);
  const values={
    clinica_id:flow.clinica_id,instagram_user_id:igUserId,username,
    account_type:profile.account_type?String(profile.account_type):null,
    status:"incompleta",
    escopos:SCOPES.split(","),
    conectado_por:flow.iniciado_por,
    token_expira_em:expiry,atualizado_em:new Date().toISOString(),
    ultimo_erro:null,
  };
  const q=existing
    ? db.from("oricstudio_meta_contas").update(values).eq("id",existing.id).eq("clinica_id",flow.clinica_id).select("id").single()
    : db.from("oricstudio_meta_contas").insert(values).select("id").single();
  const {data:account,error:accountErr}=await q;
  if(accountErr||!account?.id)throw new Error("Não foi possível salvar a conta profissional.");
  const {error:secretErr}=await db.from("oricstudio_meta_tokens").upsert({
    conta_id:account.id,...encrypted,token_expira_em:expiry,
    atualizado_em:new Date().toISOString(),
  },{onConflict:"conta_id"});
  if(secretErr)throw new Error("Não foi possível armazenar o token protegido.");
  const {error:activateErr}=await db.from("oricstudio_meta_contas")
    .update({status:"ativa",atualizado_em:new Date().toISOString()})
    .eq("id",account.id).eq("clinica_id",flow.clinica_id);
  if(activateErr)throw new Error("Conta registrada, aguardando validação.");
  await db.from("oricstudio_meta_auditoria").insert({
    clinica_id:flow.clinica_id,conta_id:account.id,usuario_id:flow.iniciado_por,
    acao:"conectar",detalhes:{username,account_type:profile.account_type||null},
  });
  return {username};
}

export async function metaListForClinic(db:Db,accessToken:string,clinicaId:string) {
  await requireMetaEditor(db,accessToken,clinicaId,false);
  const {data,error}=await db.from("oricstudio_meta_contas")
    .select("id,clinica_id,instagram_user_id,username,account_type,status,escopos,conectado_em,token_expira_em")
    .eq("clinica_id",clinicaId).order("conectado_em",{ascending:false});
  if(error)throw new Error("Não foi possível consultar as contas conectadas.");
  return (data||[]) as MetaConta[];
}

export async function metaDisconnect(db:Db,accessToken:string,clinicaId:string,accountId:string) {
  const {userId}=await requireMetaEditor(db,accessToken,clinicaId,false);
  const {data:acct,error}=await db.from("oricstudio_meta_contas")
    .select("id,instagram_user_id").eq("clinica_id",clinicaId).eq("id",accountId).maybeSingle();
  if(error||!acct)throw new Error("Conta não encontrada nesta clínica.");
  const {error:secretErr}=await db.from("oricstudio_meta_tokens").delete().eq("conta_id",accountId);
  if(secretErr)throw new Error("Não foi possível excluir as credenciais.");
  const {error:updateErr}=await db.from("oricstudio_meta_contas")
    .update({status:"desconectada",atualizado_em:new Date().toISOString()})
    .eq("id",accountId).eq("clinica_id",clinicaId);
  if(updateErr)throw new Error("Credenciais excluídas; consulte o status da conta.");
  await db.from("oricstudio_meta_auditoria").insert({
    clinica_id:clinicaId,conta_id:accountId,usuario_id:userId,
    acao:"desconectar",detalhes:{revogacao_local:true},
  });
  return {ok:true};
}
