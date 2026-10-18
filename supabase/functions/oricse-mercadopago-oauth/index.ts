import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
const encoder=new TextEncoder();
const bytes=(n:number)=>crypto.getRandomValues(new Uint8Array(n));
const b64=(a:Uint8Array)=>btoa(String.fromCharCode(...a)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
async function sha(v:string){return b64(new Uint8Array(await crypto.subtle.digest("SHA-256",encoder.encode(v))));}
function hexBytes(str:string){if(!/^[0-9a-f]{64}$/i.test(str))throw new Error("ORICSE_MP_ENCRYPTION_KEY deve conter 64 caracteres hexadecimais.");return new Uint8Array(str.match(/../g)!.map(v=>parseInt(v,16)));}
async function aesKey(){const secret=Deno.env.get("ORICSE_MP_ENCRYPTION_KEY");if(!secret)throw new Error("Chave de criptografia ORICSE_MP_ENCRYPTION_KEY ainda não configurada");return await crypto.subtle.importKey("raw",hexBytes(secret),"AES-GCM",false,["encrypt","decrypt"]);}
async function encrypt(s:string){const iv=bytes(12),key=await aesKey();const ciphertext=new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv},key,encoder.encode(s)));return b64(iv)+"."+b64(ciphertext);}
async function decrypt(s:string){const [i,c]=s.split(".");const from=(v:string)=>Uint8Array.from(atob(v.replace(/-/g,"+").replace(/_/g,"/")),x=>x.charCodeAt(0));return new TextDecoder().decode(await crypto.subtle.decrypt({name:"AES-GCM",iv:from(i)},await aesKey(),from(c)));}
const supabase=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const callback="https://oricse.vetericio.workers.dev/api/mercadopago/callback";
const allowedOrigin="https://oricse.vetericio.workers.dev";
function response(obj:unknown,status=200){return new Response(JSON.stringify(obj),{status,headers:{"content-type":"application/json","access-control-allow-origin":allowedOrigin,"access-control-allow-headers":"authorization,apikey,content-type"}})}
function webRedirect(ok:boolean){return Response.redirect(allowedOrigin+"/mercado-pago-clinica?mp="+(ok?"conectado":"erro"),303);}
Deno.serve(async(req)=>{
 try{
  if(req.method==="OPTIONS")return new Response(null,{headers:{"access-control-allow-origin":allowedOrigin,"access-control-allow-methods":"GET,POST,OPTIONS","access-control-allow-headers":"authorization,apikey,content-type"}});
  const uri=new URL(req.url),action=uri.searchParams.get("action");
  if(req.method==="GET"&&action==="callback"){
    const state=uri.searchParams.get("state"),code=uri.searchParams.get("code");
    if(!state||!code||uri.searchParams.has("error"))return webRedirect(false);
    const hash=await sha(state);
    const {data:session,error}=await supabase.from("oricse_mp_oauth_sessoes").delete().eq("state_hash",hash).select("*").maybeSingle();
    if(error||!session||Date.parse(session.expira_em)<Date.now())return webRedirect(false);
    const verifier=await decrypt(session.code_verifier_cifrado);
    const clientId=Deno.env.get("MERCADOPAGO_CLIENT_ID"),clientSecret=Deno.env.get("MERCADOPAGO_CLIENT_SECRET");
    if(!clientId||!clientSecret)throw new Error("OAuth não configurado");
    const form=new URLSearchParams({client_id:clientId,client_secret:clientSecret,grant_type:"authorization_code",code,redirect_uri:callback,code_verifier:verifier});
    const mp=await fetch("https://api.mercadopago.com/oauth/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:form});
    if(!mp.ok)return webRedirect(false);
    const token=await mp.json();
    if(!token.access_token||!token.user_id)return webRedirect(false);
    // Impede que uma mesma conta Mercado Pago seja vinculada a diferentes clínicas.
    const {data:existing}=await supabase.from("oricse_mercadopago_conexoes").select("clinica_id").eq("collector_id",String(token.user_id)).neq("clinica_id",session.clinica_id).limit(1);
    if(existing?.length)return webRedirect(false);
    const {error:saveError}=await supabase.from("oricse_mercadopago_conexoes").upsert({
       clinica_id:session.clinica_id,collector_id:String(token.user_id),
       access_token_cifrado:await encrypt(token.access_token),
       refresh_token_cifrado:token.refresh_token?await encrypt(token.refresh_token):null,
       token_expira_em:token.expires_in?new Date(Date.now()+Number(token.expires_in)*1000).toISOString():null,
       escopos:typeof token.scope==="string"?token.scope.split(" "):[],
       status:"conectada",connected_by:session.iniciado_por,updated_at:new Date().toISOString()
    },{onConflict:"clinica_id"});
    if(saveError)throw saveError;
    return webRedirect(true);
  }
  if(req.method!=="POST")return response({error:"Método não permitido"},405);
  const bearer=req.headers.get("authorization")?.replace(/^Bearer /i,"")||"";
  const {data:{user},error:authErr}=await supabase.auth.getUser(bearer);
  if(authErr||!user)return response({error:"Sessão inválida"},401);
  const body=await req.json(),clinicaId=body?.clinica_id;
  if(typeof clinicaId!=="string")return response({error:"Clínica não informada"},400);
  const {data:vinculo}=await supabase.from("clinica_usuarios").select("papel,ativo").eq("user_id",user.id).eq("clinica_id",clinicaId).eq("ativo",true).maybeSingle();
  const {data:perfil}=await supabase.from("app_users").select("role").eq("user_id",user.id).maybeSingle();
  const isAdminGeral=perfil?.role==="admin";
  if(!isAdminGeral&&(!vinculo||!["rt","admin","gestor"].includes(String(vinculo.papel))))return response({error:"Apenas responsáveis autorizados da clínica podem configurar pagamentos"},403);
  if(action==="status"){
   const {data}=await supabase.from("oricse_mercadopago_conexoes").select("collector_id,status,connected_at").eq("clinica_id",clinicaId).maybeSingle();
   return response({connected:data?.status==="conectada",collector_id:data?.collector_id??null,connected_at:data?.connected_at??null});
  }
  if(action!=="start")return response({error:"Ação não permitida"},400);
  const clientId=Deno.env.get("MERCADOPAGO_CLIENT_ID");
  if(!clientId)return response({error:"MERCADOPAGO_CLIENT_ID ausente"},503);
  await aesKey();
  const state=b64(bytes(32)),verifier=b64(bytes(48)),challenge=await sha(verifier);
  const {error:sessionError}=await supabase.from("oricse_mp_oauth_sessoes").insert({
    state_hash:await sha(state),clinica_id:clinicaId,iniciado_por:user.id,
    code_verifier_cifrado:await encrypt(verifier),expira_em:new Date(Date.now()+10*60*1000).toISOString()
  });
  if(sessionError)throw sessionError;
  const url=new URL("https://auth.mercadopago.com/authorization");
  for(const [key,value] of Object.entries({client_id:clientId,response_type:"code",platform_id:"mp",redirect_uri:callback,state,code_challenge:challenge,code_challenge_method:"S256"}))url.searchParams.set(key,value);
  return response({authorization_url:url.toString()});
 }catch(error){console.error("Mercado Pago OAuth:",error instanceof Error?error.message:"Erro desconhecido");return response({error:"Falha na integração Mercado Pago. Confira a configuração segura do servidor."},500);}
});