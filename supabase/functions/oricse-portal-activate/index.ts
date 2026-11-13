import { credencialSenhaPortal, orientacaoSenhaPortal, senhaPortalValida, versaoSenhaPortal } from "../_shared/portal-password.ts";
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Permite a plataforma e subdomínios ORICSE sem abrir CORS para sites arbitrários.
function origemAutorizada(req: Request): string {
  const origem = req.headers.get("origin") || "";
  const configurada = Deno.env.get("ORICSE_APP_ORIGIN") || "";
  if (["https://oricse.com.br", "https://app.oricse.com.br",
       "https://www.oricse.com.br", "https://oricse.vetericio.workers.dev",
       configurada].includes(origem) && origem) return origem;
  try {
    const u = new URL(origem);
    if (u.protocol === "https:" && !u.port && u.origin === origem &&
        /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.oricse\.com\.br$/.test(u.hostname))
      return origem;
  } catch {}
  return "https://oricse.com.br";
}
const corsBase = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};
function normalizarUsuario(valor:unknown){return String(valor??"").trim().replace(/^@+/,"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9._-]+/g,".").replace(/\.{2,}/g,".").replace(/^\.+|\.+$/g,"");}
async function sha256Hex(valor:string){const bytes=new TextEncoder().encode(valor);const hash=await crypto.subtle.digest("SHA-256",bytes);return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,"0")).join("");}

Deno.serve(async(req)=>{
  const cors={...corsBase,"Access-Control-Allow-Origin":origemAutorizada(req),"Content-Type":"application/json"};
  const resposta=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return resposta({error:"Método não permitido."},405);
  try{
    const payload=await req.json().catch(()=>({}));
    const slug=String(payload?.slug??"").trim().toLowerCase();
    const usuarioChave=normalizarUsuario(payload?.usuario);
    const token=String(payload?.token??"").trim();
    const codigoCurto=/^[A-Z]{2}[0-9]{2}$/i.test(token);
    const senha=String(payload?.senha??"");
    if(!slug||usuarioChave.length<3||(!codigoCurto&&!/^[0-9a-f]{48}$/i.test(token)))return resposta({error:"Informe o usuário e o código de ativação enviado pela clínica."},400);
    if(!senhaPortalValida(senha))return resposta({error:orientacaoSenhaPortal},400);

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

    const expirado=!portal.convite_expira_em||new Date(portal.convite_expira_em).getTime()<=Date.now();
    let codigoFixo=false;
    if(codigoCurto){
      const {data:validacao,error:erroCodigo}=await admin.rpc("oricse_portal_verificar_codigo_ativacao",{
        p_portal_id:portal.id,p_convite_chave:portal.convite_token_hash,p_codigo:token.toUpperCase(),
      });
      if(erroCodigo)throw erroCodigo;
      if(validacao==="bloqueado")return resposta({error:"Limite de tentativas atingido. Aguarde 30 minutos para tentar de novo com o mesmo código."},429);
      codigoFixo=validacao==="fixo";
      if(!codigoFixo&&validacao!=="valido")return resposta({error:"Código de ativação inválido."},400);
    }else if(expirado||!portal.convite_token_hash||portal.convite_token_hash!==await sha256Hex(token)){
      return resposta({error:"Convite inválido ou expirado."},400);
    }

    const emailInterno=`portal+${portal.id}@auth.oricse.local`;
    const {data:criado,error:erroCriar}=await admin.auth.admin.createUser({email:emailInterno,password:await credencialSenhaPortal(senha,portal.id),email_confirm:true,app_metadata:{oricse_portal_tutor:true,oricse_versao_senha_portal:versaoSenhaPortal,clinica_id:portal.clinica_id,tutor_id:portal.tutor_id}});
    if(erroCriar||!criado.user)return resposta({error:"Não foi possível ativar o acesso agora."},500);

    const authUserId=criado.user.id;
    const vincular=admin.from("oricse_portal_tutores")
      .update({auth_user_id:authUserId,convite_token_hash:null,convite_expira_em:null,updated_at:new Date().toISOString()})
      .eq("id",portal.id).is("auth_user_id",null).eq("ativo",true);
    if(!codigoFixo) vincular.eq("convite_token_hash",portal.convite_token_hash).gt("convite_expira_em",new Date().toISOString());
    const {data:vinculo,error:erroVinculo}=await vincular.select("id").maybeSingle();
    if(erroVinculo||!vinculo){
      await admin.auth.admin.deleteUser(authUserId);
      if(erroVinculo)throw erroVinculo;
      return resposta({error:"Não foi possível concluir a ativação. Verifique se seu acesso já está ativo."},409);
    }
    return resposta({ok:true,usuario:portal.usuario});
  }catch(error){console.error("oricse-portal-activate",error);return resposta({error:"Não foi possível ativar o acesso agora."},500);}
});
