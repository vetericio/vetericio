// Threads OAuth por clínica. Segredos e tokens nunca saem do servidor.
import { createHash, randomBytes } from "node:crypto";
import { encryptMetaToken, decryptMetaToken, requireMetaEditor, requireMetaEditorByUser } from "@/lib/oricstudio-meta.server";

type Db=any;
const CALLBACK="https://oricse.vetericio.workers.dev/api/oricstudio/threads/callback";
const SCOPES="threads_basic,threads_content_publish,threads_manage_insights,threads_read_replies,threads_manage_replies";
const hash=(v:string)=>createHash("sha256").update(v).digest("hex");

function config(){
  const clientId=process.env["ORICSTUDIO_THREADS_CLIENT_ID"]||"";
  const clientSecret=process.env["ORICSTUDIO_THREADS_CLIENT_SECRET"]||"";
  const redirect=process.env["ORICSTUDIO_THREADS_REDIRECT_URI"]||CALLBACK;
  const url=new URL(redirect);
  if(url.protocol!=="https:"||url.origin!=="https://oricse.vetericio.workers.dev"||
     url.pathname!=="/api/oricstudio/threads/callback"||url.search||url.hash)
    throw new Error("URL de retorno Threads inválida.");
  return {clientId,clientSecret,redirect,configured:Boolean(clientId&&clientSecret)};
}
export function threadsConfigured(){ return config().configured; }

export async function threadsAuthorize(db:Db,token:string,clinicaId:string|null){
  const {userId,isPlatformAdmin}=await requireMetaEditor(db,token,clinicaId);
  if(!isPlatformAdmin){
    const {data:active}=await db.from("oricse_clinica_ativa_usuario")
      .select("clinica_id").eq("user_id",userId).maybeSingle();
    if(active?.clinica_id!==clinicaId)throw new Error("Selecione a clínica para conectar o Threads.");
  }
  const cfg=config();
  if(!cfg.configured)throw new Error("Threads ainda não configurado pela Administração Geral.");
  const state=randomBytes(32).toString("base64url");
  const {error}=await db.from("oricstudio_threads_oauth_states").insert({
    state_hash:hash(state),clinica_id:clinicaId,iniciado_por:userId,
    expira_em:new Date(Date.now()+10*60_000).toISOString()
  });
  if(error)throw new Error("Não foi possível iniciar a conexão Threads.");
  const u=new URL("https://threads.net/oauth/authorize");
  u.searchParams.set("client_id",cfg.clientId);
  u.searchParams.set("redirect_uri",cfg.redirect);
  u.searchParams.set("scope",SCOPES);
  u.searchParams.set("response_type","code");
  u.searchParams.set("state",state);
  return u.toString();
}

async function jsonResponse(r:Response){
  const body=await r.json().catch(()=>null) as any;
  if(!r.ok||!body||body.error)throw new Error("A API Threads não confirmou a autorização.");
  return body;
}

export async function threadsFinalize(db:Db,state:string,code:string){
  const stateHash=hash(state);
  const {data:flow,error}=await db.from("oricstudio_threads_oauth_states")
    .select("clinica_id,iniciado_por,expira_em,usado_em")
    .eq("state_hash",stateHash).maybeSingle();
  if(error||!flow||flow.usado_em||Date.parse(flow.expira_em)<=Date.now())
    throw new Error("Autorização do Threads expirada ou já utilizada.");
  const {data:consumed,error:consumeError}=await db.from("oricstudio_threads_oauth_states")
    .update({usado_em:new Date().toISOString()}).eq("state_hash",stateHash)
    .is("usado_em",null).gt("expira_em",new Date().toISOString())
    .select("state_hash").maybeSingle();
  if(consumeError||!consumed)throw new Error("Autorização Threads já utilizada.");
  await requireMetaEditorByUser(db,flow.iniciado_por,flow.clinica_id);
  const cfg=config();
  if(!cfg.configured)throw new Error("Threads não configurado.");
  const r=await fetch("https://graph.threads.net/oauth/access_token",{
    method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},
    body:new URLSearchParams({
      client_id:cfg.clientId,client_secret:cfg.clientSecret,
      grant_type:"authorization_code",redirect_uri:cfg.redirect,code
    })
  });
  const short=await jsonResponse(r);
  if(typeof short.access_token!=="string"||!short.access_token)
    throw new Error("A Meta não retornou a credencial Threads.");
  const longUrl=new URL("https://graph.threads.net/access_token");
  longUrl.searchParams.set("grant_type","th_exchange_token");
  longUrl.searchParams.set("client_secret",cfg.clientSecret);
  longUrl.searchParams.set("access_token",short.access_token);
  const long=await jsonResponse(await fetch(longUrl));
  if(typeof long.access_token!=="string"||!long.access_token)
    throw new Error("A Meta não retornou um token Threads de longa duração.");
  const profileUrl=new URL("https://graph.threads.net/v1.0/me");
  profileUrl.searchParams.set("fields","id,username");
  profileUrl.searchParams.set("access_token",long.access_token);
  const profile=await jsonResponse(await fetch(profileUrl));
  const userId=String(profile.id||short.user_id||"").trim();
  const username=String(profile.username||"").trim();
  if(!userId||!username)throw new Error("A Meta não identificou a conta Threads.");
  const {data:existing,error:existingError}=await db.from("oricstudio_threads_contas")
    .select("id,clinica_id").eq("threads_user_id",userId).maybeSingle();
  if(existingError)throw new Error("Não foi possível verificar o vínculo Threads.");
  if(existing&&existing.clinica_id!==flow.clinica_id)
    throw new Error("Conta Threads já vinculada a outra clínica.");
  const expiry=Number(long.expires_in)>0
    ?new Date(Date.now()+Number(long.expires_in)*1000).toISOString():null;
  const accountData={
    clinica_id:flow.clinica_id,threads_user_id:userId,username,status:"ativa",
    conectado_por:flow.iniciado_por,token_expira_em:expiry,
    atualizado_em:new Date().toISOString()
  };
  const q=existing
    ?db.from("oricstudio_threads_contas").update(accountData).eq("id",existing.id)
      .filter("clinica_id",flow.clinica_id===null?"is":"eq",flow.clinica_id===null?"null":flow.clinica_id).select("id").single()
    :db.from("oricstudio_threads_contas").insert(accountData).select("id").single();
  const {data:account,error:accountError}=await q;
  if(accountError||!account)throw new Error("Falha ao gravar conta Threads.");
  const encrypted=await encryptMetaToken(long.access_token);
  const {error:saveError}=await db.from("oricstudio_threads_tokens").upsert({
    conta_id:account.id,...encrypted,atualizado_em:new Date().toISOString()
  },{onConflict:"conta_id"});
  if(saveError) {
    await db.from("oricstudio_threads_contas").update({status:"reautenticar"})
      .eq("id",account.id).filter("clinica_id",flow.clinica_id===null?"is":"eq",flow.clinica_id===null?"null":flow.clinica_id);
    throw new Error("Falha ao armazenar a credencial Threads.");
  }
  return {username};
}

export async function threadsList(db:Db,token:string,clinicaId:string|null){
  await requireMetaEditor(db,token,clinicaId,false);
  const {data,error}=await db.from("oricstudio_threads_contas")
    .select("id,clinica_id,username,status,conectado_em,token_expira_em")
    .filter("clinica_id",clinicaId===null?"is":"eq",clinicaId===null?"null":clinicaId).order("conectado_em",{ascending:false});
  if(error)throw new Error("Erro ao consultar contas Threads.");
  return data||[];
}
export async function threadsDisconnect(db:Db,token:string,clinicaId:string|null,contaId:string){
  await requireMetaEditor(db,token,clinicaId,false);
  const {data:account,error}=await db.from("oricstudio_threads_contas")
    .select("id").eq("id",contaId).filter("clinica_id",clinicaId===null?"is":"eq",clinicaId===null?"null":clinicaId).maybeSingle();
  if(error||!account)throw new Error("Conta Threads não encontrada nesta clínica.");
  const {error:deleteError}=await db.from("oricstudio_threads_tokens")
    .delete().eq("conta_id",contaId);
  if(deleteError)throw new Error("Falha ao remover credencial Threads.");
  const {error:statusError}=await db.from("oricstudio_threads_contas")
    .update({status:"desconectada",atualizado_em:new Date().toISOString()})
    .eq("id",contaId).filter("clinica_id",clinicaId===null?"is":"eq",clinicaId===null?"null":clinicaId);
  if(statusError)throw new Error("Credencial removida. Não foi possível atualizar o status.");
  return {ok:true};
}

export async function threadsVerify(db:Db,token:string,clinicaId:string|null,contaId:string){
  await requireMetaEditor(db,token,clinicaId,true);
  const {data:account,error:accountError}=await db.from("oricstudio_threads_contas")
    .select("id,username,status,token_expira_em").eq("id",contaId).filter("clinica_id",clinicaId===null?"is":"eq",clinicaId===null?"null":clinicaId).maybeSingle();
  if(accountError||!account||account.status==="desconectada")
    throw new Error("Conta Threads não encontrada nesta clínica.");
  const {data:secret,error:secretError}=await db.from("oricstudio_threads_tokens")
    .select("token_cifrado_base64,iv_base64,atualizado_em").eq("conta_id",contaId).maybeSingle();
  if(secretError||!secret)throw new Error("Conta Threads sem token ativo.");
  try{
    let plain=await decryptMetaToken(secret.token_cifrado_base64,secret.iv_base64);
    const age=Date.now()-Date.parse(secret.atualizado_em);
    const remaining=account.token_expira_em?Date.parse(account.token_expira_em)-Date.now():Infinity;
    if(remaining<=0)throw new Error("Token Threads expirado.");
    let refreshed=false;
    let expiry=account.token_expira_em;
    if(age>=24*3600_000&&remaining<30*24*3600_000){
      const refresh=new URL("https://graph.threads.net/refresh_access_token");
      refresh.searchParams.set("grant_type","th_refresh_token");
      refresh.searchParams.set("access_token",plain);
      const renewed=await jsonResponse(await fetch(refresh));
      if(typeof renewed.access_token!=="string"||!renewed.access_token)
        throw new Error("Renovação Threads sem token.");
      plain=renewed.access_token;
      expiry=Number(renewed.expires_in)>0
        ?new Date(Date.now()+Number(renewed.expires_in)*1000).toISOString():expiry;
      refreshed=true;
    }
    const profileUrl=new URL("https://graph.threads.net/v1.0/me");
    profileUrl.searchParams.set("fields","id,username");
    profileUrl.searchParams.set("access_token",plain);
    const profile=await jsonResponse(await fetch(profileUrl));
    if(!profile.id||!profile.username)throw new Error("Perfil Threads inválido.");
    if(refreshed){
      const encrypted=await encryptMetaToken(plain);
      const {error:saveError}=await db.from("oricstudio_threads_tokens")
        .update({...encrypted,atualizado_em:new Date().toISOString()}).eq("conta_id",contaId);
      if(saveError)throw new Error("Falha ao salvar renovação Threads.");
    }
    const {error:updateError}=await db.from("oricstudio_threads_contas")
      .update({username:String(profile.username),status:"ativa",token_expira_em:expiry,
        atualizado_em:new Date().toISOString()})
      .eq("id",contaId).filter("clinica_id",clinicaId===null?"is":"eq",clinicaId===null?"null":clinicaId);
    if(updateError)throw new Error("Falha ao atualizar status Threads.");
    return {ok:true,username:String(profile.username),renovada:refreshed};
  }catch{
    await db.from("oricstudio_threads_contas")
      .update({status:"reautenticar",atualizado_em:new Date().toISOString()})
      .eq("id",contaId).filter("clinica_id",clinicaId===null?"is":"eq",clinicaId===null?"null":clinicaId);
    throw new Error("Não foi possível validar o Threads. Reconecte a conta.");
  }
}
