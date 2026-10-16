import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json"};
const resposta=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
function normalizarUsuario(valor:unknown){return String(valor??"").trim().replace(/^@+/,"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9._-]+/g,".").replace(/\.{2,}/g,".").replace(/^\.+|\.+$/g,"");}
async function sha256Hex(valor:string){const bytes=new TextEncoder().encode(valor);const hash=await crypto.subtle.digest("SHA-256",bytes);return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,"0")).join("");}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return resposta({error:"Método não permitido."},405);
  try{
    const payload=await req.json().catch(()=>({}));
    const slug=String(payload?.slug??"").trim().toLowerCase();
    const usuarioChave=normalizarUsuario(payload?.usuario);
    const token=String(payload?.token??"").trim();
    const senha=String(payload?.senha??"");
    if(!slug||usuarioChave.length<3||token.length<32||senha.length<8||senha.length>128)return resposta({error:"Dados de ativação inválidos."},400);

    const url=Deno.env.get("SUPABASE_URL")!;
    const admin=createClient(url,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:portal,error:portalError}=await admin.from("oricse_portal_tutores")
      .select("id,clinica_id,tutor_id,auth_user_id,usuario,usuario_chave,convite_token_hash,convite_expira_em,ativo")
      .eq("clinica_slug",slug)
      .eq("usuario_chave",usuarioChave)
      .eq("ativo",true)
      .maybeSingle();
    if(portalError||!portal)return resposta({error:"Convite inválido ou expirado."},400);
    if(portal.auth_user_id)return resposta({error:"Este acesso já foi ativado."},409);

    const tokenHash=await sha256Hex(token);
    const expirado=!portal.convite_expira_em||new Date(portal.convite_expira_em).getTime()<=Date.now();
    if(expirado||!portal.convite_token_hash||portal.convite_token_hash!==tokenHash)return resposta({error:"Convite inválido ou expirado."},400);

    const emailInterno=`portal+${portal.id}@auth.oricse.local`;
    const {data:criado,error:erroCriar}=await admin.auth.admin.createUser({email:emailInterno,password:senha,email_confirm:true,app_metadata:{oricse_portal_tutor:true,clinica_id:portal.clinica_id,tutor_id:portal.tutor_id}});
    if(erroCriar||!criado.user)return resposta({error:"Não foi possível ativar o acesso agora."},500);

    const authUserId=criado.user.id;
    const {error:erroVinculo}=await admin.from("oricse_portal_tutores").update({auth_user_id:authUserId,convite_token_hash:null,convite_expira_em:null,updated_at:new Date().toISOString()}).eq("id",portal.id).is("auth_user_id",null);
    if(erroVinculo){await admin.auth.admin.deleteUser(authUserId).catch(()=>undefined);return resposta({error:"Não foi possível ativar o acesso agora."},500);}
    return resposta({ok:true,usuario:portal.usuario});
  }catch(error){console.error("oricse-portal-activate",error);return resposta({error:"Não foi possível ativar o acesso agora."},500);}
});
