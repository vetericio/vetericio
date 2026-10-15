import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json"};
const resposta=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
function normalizarUsuario(valor:unknown){return String(valor??"").trim().replace(/^@+/,"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9._-]+/g,".").replace(/\.{2,}/g,".").replace(/^\.+|\.+$/g,"");}

async function portalIncluido(admin:any,clinicaId:string){
  const [{data:clinica},{data:excecao},{data:planos}]=await Promise.all([
    admin.from("clinicas").select("plano,status").eq("id",clinicaId).maybeSingle(),
    admin.from("oricse_clinica_funcionalidade_excecoes").select("permitido,expira_em").eq("clinica_id",clinicaId).eq("funcionalidade_codigo","portal_tutor.acesso").maybeSingle(),
    admin.from("oricse_planos").select("id,codigo,nome,ativo").eq("ativo",true),
  ]);
  if(!clinica||clinica.status!=="ativa")return false;
  if(excecao&&(!excecao.expira_em||new Date(excecao.expira_em).getTime()>Date.now()))return Boolean(excecao.permitido);
  const plano=(planos||[]).find((p:any)=>p.codigo===clinica.plano||p.nome===clinica.plano);if(!plano)return false;
  const {data:matriz}=await admin.from("oricse_plano_funcionalidades").select("permitido").eq("plano_id",plano.id).eq("funcionalidade_codigo","portal_tutor.acesso").maybeSingle();
  return Boolean(matriz?.permitido);
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return resposta({error:"Método não permitido."},405);
  try{
    const payload=await req.json().catch(()=>({}));const slug=String(payload?.slug??"").trim().toLowerCase();const usuarioChave=normalizarUsuario(payload?.usuario);const senha=String(payload?.senha??"");
    if(!slug||usuarioChave.length<3||!senha)return resposta({error:"Usuário ou senha inválidos."},401);
    const url=Deno.env.get("SUPABASE_URL")!;const admin=createClient(url,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:clinica}=await admin.from("clinicas").select("id,status").eq("slug",slug).eq("status","ativa").maybeSingle();
    if(!clinica?.id||!(await portalIncluido(admin,clinica.id)))return resposta({error:"Portal indisponível para esta clínica."},403);
    const {data:portal}=await admin.from("oricse_portal_tutores").select("auth_user_id,ativo").eq("clinica_id",clinica.id).eq("usuario_chave",usuarioChave).eq("ativo",true).maybeSingle();
    if(!portal?.auth_user_id)return resposta({error:"Usuário ou senha inválidos."},401);
    const {data:usuarioAuth,error:erroAuth}=await admin.auth.admin.getUserById(portal.auth_user_id);const email=usuarioAuth.user?.email;
    if(erroAuth||!email)return resposta({error:"Usuário ou senha inválidos."},401);
    const publico=createClient(url,Deno.env.get("SUPABASE_ANON_KEY")!,{auth:{persistSession:false,autoRefreshToken:false}});const {data:login,error:erroLogin}=await publico.auth.signInWithPassword({email,password:senha});
    if(erroLogin||!login.session||!login.user||login.user.id!==portal.auth_user_id)return resposta({error:"Usuário ou senha inválidos."},401);
    await admin.from("oricse_portal_tutores").update({ultimo_acesso_em:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("auth_user_id",portal.auth_user_id);
    return resposta({access_token:login.session.access_token,refresh_token:login.session.refresh_token,expires_in:login.session.expires_in,expires_at:login.session.expires_at,token_type:login.session.token_type});
  }catch(error){console.error("oricse-portal-login",error);return resposta({error:"Não foi possível entrar agora."},500);}
});