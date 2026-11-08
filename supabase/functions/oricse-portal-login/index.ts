import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const appOrigin=Deno.env.get("ORICSE_APP_ORIGIN")||"https://oricse.vetericio.workers.dev";
const cors={"Access-Control-Allow-Origin":appOrigin,"Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json","Vary":"Origin"};
const resposta=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
function normalizarUsuario(valor:unknown){return String(valor??"").trim().replace(/^@+/,"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9._-]+/g,".").replace(/\.{2,}/g,".").replace(/^\.+|\.+$/g,"");}

// Reduz tentativas automáticas no mesmo isolado. O limite persistente deve ser
// aplicado no gateway/banco antes de expor este endpoint em maior escala.
const tentativas=new Map<string,{quantidade:number;inicio:number}>();
function permitidoNoIsolado(chave:string){
  const agora=Date.now(),janela=10*60_000,limite=8,atual=tentativas.get(chave);
  if(!atual||agora-atual.inicio>=janela){tentativas.set(chave,{quantidade:1,inicio:agora});return true;}
  if(atual.quantidade>=limite)return false;
  atual.quantidade+=1;return true;
}
async function permitido(admin:ReturnType<typeof createClient>,chave:string){
  const {data,error}=await admin.rpc("oricse_rate_limit_allow",{p_escopo:"portal_login",p_chave:chave,p_limite:8,p_janela_segundos:600});
  if(!error)return data===true;
  // Compatibilidade segura enquanto a migration ainda não foi aplicada.
  console.error("Rate limit persistente indisponível",error.message);
  return permitidoNoIsolado(chave);
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return resposta({error:"Método não permitido."},405);
  try{
    const payload=await req.json().catch(()=>({}));
    const slug=String(payload?.slug??"").trim().toLowerCase();
    const usuarioChave=normalizarUsuario(payload?.usuario);
    const senha=String(payload?.senha??"");
    if(!slug||usuarioChave.length<3||!senha)return resposta({error:"Usuário ou senha inválidos."},401);
    const ip=(req.headers.get("x-forwarded-for")||"desconhecido").split(",")[0].trim();
    const url=Deno.env.get("SUPABASE_URL")!;
    const admin=createClient(url,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false,autoRefreshToken:false}});
    if(!await permitido(admin,`${ip}:${slug}:${usuarioChave}`))return resposta({error:"Muitas tentativas. Aguarde alguns minutos antes de tentar novamente."},429);
    const {data:portal,error:portalError}=await admin.from("oricse_portal_tutores")
      .select("id,auth_user_id,ativo")
      .eq("clinica_slug",slug)
      .eq("usuario_chave",usuarioChave)
      .eq("ativo",true)
      .maybeSingle();
    if(portalError||!portal?.auth_user_id)return resposta({error:"Usuário ou senha inválidos."},401);

    const {data:usuarioAuth,error:erroAuth}=await admin.auth.admin.getUserById(portal.auth_user_id);
    const email=usuarioAuth.user?.email;
    if(erroAuth||!email)return resposta({error:"Usuário ou senha inválidos."},401);

    const publico=createClient(url,Deno.env.get("SUPABASE_ANON_KEY")!,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:login,error:erroLogin}=await publico.auth.signInWithPassword({email,password:senha});
    if(erroLogin||!login.session||!login.user||login.user.id!==portal.auth_user_id)return resposta({error:"Usuário ou senha inválidos."},401);

    await admin.from("oricse_portal_tutores").update({ultimo_acesso_em:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",portal.id);
    return resposta({access_token:login.session.access_token,refresh_token:login.session.refresh_token,expires_in:login.session.expires_in,expires_at:login.session.expires_at,token_type:login.session.token_type});
  }catch(error){console.error("oricse-portal-login",error);return resposta({error:"Não foi possível entrar agora."},500);}
});
