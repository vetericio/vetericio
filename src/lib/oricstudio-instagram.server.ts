// Instagram API with Instagram Login, sem Página do Facebook.
// Credenciais exclusivas do OricStudio. O Gestor 2.0 nunca é consultado.
import {createHash,randomBytes} from "node:crypto";
import {ORICSTUDIO_PLATAFORMA_ID} from "@/lib/oricstudio-plataforma";
import {encryptMetaToken,requireMetaEditor,requireMetaEditorByUser,metaConfig}
 from "@/lib/oricstudio-meta.server";

type Db=any;
const SCOPES=["instagram_business_basic","instagram_business_content_publish",
  "instagram_business_manage_comments","instagram_business_manage_insights"];
const HASH=(value:string)=>createHash("sha256").update(value).digest("hex");

export function instagramDiretoConfig() {
  const appId=(process.env["ORICSTUDIO_IG_APP_ID"]||"").trim();
  const appSecret=process.env["ORICSTUDIO_IG_APP_SECRET"]||"";
  const callback=(process.env["ORICSTUDIO_IG_REDIRECT_URI"]||
    "https://oricse.com.br/api/oricstudio/instagram/callback").trim();
  let redirectValido=false;
  try {
    const u=new URL(callback);
    redirectValido=u.protocol==="https:" && u.pathname==="/api/oricstudio/instagram/callback"
      && !u.hash && !u.search;
  }catch{}
  const chaveValida=metaConfig().temChaveCriptografiaValida;
  return {appId,appSecret,callback,redirectValido,chaveValida,
    configured:/^\d{8,30}$/.test(appId)&&!!appSecret&&redirectValido&&chaveValida};
}

async function metaJson(url:string,init:RequestInit={}) {
  const res=await fetch(url,{...init,signal:AbortSignal.timeout(30000)});
  const body:any=await res.json().catch(()=>null);
  if(!res.ok || !body || body.error)
    throw new Error("A Meta não confirmou a autorização do Instagram. Confira o aplicativo e suas permissões.");
  return body;
}
function idDb(id:string) {return id===ORICSTUDIO_PLATAFORMA_ID?null:id;}

export async function autorizarInstagramDireto(db:Db,accessToken:string,clinicaId:string) {
  const {userId,isPlatformAdmin}=await requireMetaEditor(db,accessToken,clinicaId,true);
  if(!isPlatformAdmin) {
    const {data:selecionada}=await db.from("oricse_clinica_ativa_usuario")
      .select("clinica_id").eq("user_id",userId).maybeSingle();
    if(selecionada?.clinica_id!==clinicaId)
      throw new Error("Selecione esta clínica na Oricse antes de conectar o Instagram.");
  }
  const cfg=instagramDiretoConfig();
  if(!cfg.configured) throw new Error("Configure ORICSTUDIO_IG_APP_ID, ORICSTUDIO_IG_APP_SECRET, callback e chave de criptografia no Cloudflare.");
  const state=randomBytes(32).toString("base64url");
  const {error}=await db.from("oricstudio_meta_oauth_states").insert({
    state_hash:HASH(state),clinica_id:idDb(clinicaId),iniciado_por:userId,login_tipo:"instagram",
    expira_em:new Date(Date.now()+600000).toISOString(),
  });
  if(error)throw new Error("Não foi possível iniciar a conexão Instagram.");
  const url=new URL("https://www.instagram.com/oauth/authorize");
  url.searchParams.set("client_id",cfg.appId);
  url.searchParams.set("redirect_uri",cfg.callback);
  url.searchParams.set("response_type","code");
  url.searchParams.set("scope",SCOPES.join(","));
  url.searchParams.set("state",state);
  return url.toString();
}

export async function finalizarInstagramDireto(db:Db,state:string,code:string) {
  if(!/^[A-Za-z0-9_-]{32,128}$/.test(state) || !code || code.length>4096)
    throw new Error("Autorização inválida.");
  const hash=HASH(state);
  const {data:flow,error:flowError}=await db.from("oricstudio_meta_oauth_states")
    .select("state_hash,clinica_id,iniciado_por,expira_em,usado_em,login_tipo")
    .eq("state_hash",hash).eq("login_tipo","instagram").maybeSingle();
  if(flowError||!flow||flow.usado_em||Date.parse(flow.expira_em)<=Date.now())
    throw new Error("Autorização expirada, inválida ou utilizada.");
  const {data:claim,error:claimError}=await db.from("oricstudio_meta_oauth_states")
    .update({usado_em:new Date().toISOString()}).eq("state_hash",hash)
    .eq("login_tipo","instagram").is("usado_em",null)
    .gt("expira_em",new Date().toISOString()).select("state_hash").maybeSingle();
  if(claimError||!claim)throw new Error("Autorização já utilizada.");
  const clinicaId=flow.clinica_id||ORICSTUDIO_PLATAFORMA_ID;
  await requireMetaEditorByUser(db,flow.iniciado_por,clinicaId);
  const cfg=instagramDiretoConfig();
  if(!cfg.configured)throw new Error("App Instagram OricStudio ainda não configurado.");

  const shortResponse=await metaJson("https://api.instagram.com/oauth/access_token",{
    method:"POST",body:new URLSearchParams({
      client_id:cfg.appId,client_secret:cfg.appSecret,grant_type:"authorization_code",
      redirect_uri:cfg.callback,code,
    }),
  });
  const short=typeof shortResponse.access_token==="string"?shortResponse:
    (Array.isArray(shortResponse.data)&&shortResponse.data.length===1?shortResponse.data[0]:null);
  if(!short?.access_token || typeof short.access_token!=="string")
    throw new Error("O Instagram não retornou uma única conta autorizada.");
  const exchange=new URL("https://graph.instagram.com/access_token");
  exchange.searchParams.set("grant_type","ig_exchange_token");
  exchange.searchParams.set("client_secret",cfg.appSecret);
  exchange.searchParams.set("access_token",short.access_token);
  const long=await metaJson(exchange.toString());
  if(typeof long.access_token!=="string"||!long.access_token||Number(long.expires_in)<=0)
    throw new Error("O Instagram não retornou token longo válido.");
  const profileUrl=new URL("https://graph.instagram.com/me");
  profileUrl.searchParams.set("fields","id,user_id,username,account_type");
  profileUrl.searchParams.set("access_token",long.access_token);
  const profile=await metaJson(profileUrl.toString());
  const instaId=String(profile.user_id||profile.id||short.user_id||"");
  const username=String(profile.username||"").trim();
  if(!/^\d+$/.test(instaId)||!username)
    throw new Error("Não foi possível identificar a conta profissional.");
  if(profile.account_type && !["BUSINESS","MEDIA_CREATOR","CREATOR"].includes(String(profile.account_type)))
    throw new Error("A conta precisa ser profissional (Business ou Creator).");
  const {data:existing,error:existingErr}=await db.from("oricstudio_meta_contas")
    .select("id,clinica_id").eq("instagram_user_id",instaId).maybeSingle();
  if(existingErr)throw new Error("Falha ao conferir vínculo Instagram.");
  if(existing&&existing.clinica_id!==flow.clinica_id)
    throw new Error("Esta conta já pertence a outra clínica. Desconecte-a antes de transferir.");
  if(!existing&&flow.clinica_id) {
    const [{data:lic},{count,error:contaErro}]=await Promise.all([
      db.from("oricstudio_licencas").select("quantidade_contas_contratadas")
        .eq("clinica_id",flow.clinica_id).single(),
      db.from("oricstudio_meta_contas").select("id",{count:"exact",head:true})
        .eq("clinica_id",flow.clinica_id).neq("status","desconectada"),
    ]);
    if(contaErro)throw new Error("Não foi possível verificar o limite de contas.");
    if((count||0)>=Number(lic?.quantidade_contas_contratadas||1))
      throw new Error("Limite de contas contratadas atingido. Contrate uma conta adicional.");
  }
  const expiry=new Date(Date.now()+Number(long.expires_in)*1000).toISOString();
  const encrypted=await encryptMetaToken(long.access_token);
  const row={
    clinica_id:flow.clinica_id,instagram_user_id:instaId,username,
    account_type:profile.account_type?String(profile.account_type):null,
    status:"incompleta",login_tipo:"instagram",escopos:SCOPES,
    conectado_por:flow.iniciado_por,token_expira_em:expiry,
    ultimo_erro:null,atualizado_em:new Date().toISOString(),
  };
  const {data:saved,error:saveError}=existing
    ? await (flow.clinica_id
        ? db.from("oricstudio_meta_contas").update(row).eq("id",existing.id)
            .eq("clinica_id",flow.clinica_id)
        : db.from("oricstudio_meta_contas").update(row).eq("id",existing.id)
            .is("clinica_id",null)).select("id").single()
    : await db.from("oricstudio_meta_contas").insert(row).select("id").single();
  if(saveError||!saved?.id)throw new Error("Falha ao registrar conta Instagram.");
  const {error:tokenError}=await db.from("oricstudio_meta_tokens").upsert({
    conta_id:saved.id,...encrypted,token_expira_em:expiry,
    atualizado_em:new Date().toISOString(),
  },{onConflict:"conta_id"});
  if(tokenError)throw new Error("Conta salva, mas o token protegido não foi gravado.");
  const {error:activeError}=await db.from("oricstudio_meta_contas")
    .update({status:"ativa"}).eq("id",saved.id);
  if(activeError)throw new Error("Conexão salva, mas aguardando validação.");
  await db.from("oricstudio_meta_auditoria").insert({
    clinica_id:flow.clinica_id,conta_id:saved.id,usuario_id:flow.iniciado_por,
    acao:"conectar",detalhes:{modo:"instagram_direto",username},
  });
  return {username,plataforma:flow.clinica_id===null};
}
