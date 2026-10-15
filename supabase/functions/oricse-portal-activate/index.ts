import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json"};
const resposta=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
function normalizarUsuario(valor:unknown){return String(valor??"").trim().replace(/^@+/,"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9._-]+/g,".").replace(/\.{2,}/g,".").replace(/^\.+|\.+$/g,"");}
async function sha256Hex(valor:string){const bytes=new TextEncoder().encode(valor);const hash=await crypto.subtle.digest("SHA-256",bytes);return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,"0")).join("");}
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
    const payload=await req.json().catch(()=>({}));const slug=String(payload?.slug??"").trim().toLowerCase();const usuarioChave=normalizarUsuario(payload?.usuario);const token=String(payload?.token??"").trim();const senha=String(payload?.senha??"");
    if(!slug||usuarioChave.length<3||token.length<32||senha.length<8||senha.length>128)return resposta({error:"Dados de ativação inválidos."},400);
    const url=Deno.env.get("SUPABASE_URL")!;const admin=createClient(url,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:clinica}=await admin.from("clinicas").select("id,slug,status").eq("slug",slug).eq("status","ativa").maybeSingle();
    if(!clinica?.id)return resposta({error:"Convite inválido ou expirado."},400);
    if(!(await portalIncluido(admin,clinica.id)))return resposta({error:"Portal indisponível para esta clínica."},403);
    const {data:convite}=await admin.from("oricse_portal_convites").select("id,clinica_id,tutor_id,usuario,usuario_chave,token_hash,expira_em,usado_em").eq("clinica_id",clinica.id).eq("usuario_chave",usuarioChave).is("usado_em",null).maybeSingle();
    const tokenHash=await sha256Hex(token);const expirado=!convite?.expira_em||new Date(convite.expira_em).getTime()<=Date.now();
    if(!convite||expirado||convite.token_hash!==tokenHash)return resposta({error:"Convite inválido ou expirado."},400);
    const {data:existente}=await admin.from("oricse_portal_tutores").select("id").eq("clinica_id",clinica.id).eq("tutor_id",convite.tutor_id).maybeSingle();if(existente?.id)return resposta({error:"Este acesso já foi ativado."},409);
    const emailInterno=`portal+${convite.id}@auth.oricse.local`;const {data:criado,error:erroCriar}=await admin.auth.admin.createUser({email:emailInterno,password:senha,email_confirm:true,app_metadata:{oricse_portal_tutor:true,clinica_id:convite.clinica_id,tutor_id:convite.tutor_id}});
    if(erroCriar||!criado.user)return resposta({error:"Não foi possível ativar o acesso agora."},500);
    const authUserId=criado.user.id;const {error:erroVinculo}=await admin.from("oricse_portal_tutores").insert({clinica_id:convite.clinica_id,tutor_id:convite.tutor_id,auth_user_id:authUserId,usuario:convite.usuario,usuario_chave:convite.usuario_chave,ativo:true});
    if(erroVinculo){await admin.auth.admin.deleteUser(authUserId).catch(()=>undefined);return resposta({error:"Não foi possível ativar o acesso agora."},500);}
    const {error:erroUsado}=await admin.from("oricse_portal_convites").update({usado_em:new Date().toISOString()}).eq("id",convite.id).is("usado_em",null);
    if(erroUsado){await admin.from("oricse_portal_tutores").delete().eq("auth_user_id",authUserId);await admin.auth.admin.deleteUser(authUserId).catch(()=>undefined);return resposta({error:"Não foi possível ativar o acesso agora."},500);}
    return resposta({ok:true,usuario:convite.usuario});
  }catch(error){console.error("oricse-portal-activate",error);return resposta({error:"Não foi possível ativar o acesso agora."},500);}
});