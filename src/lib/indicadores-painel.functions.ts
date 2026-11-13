import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema=z.object({
  consultas:z.boolean(),exames:z.boolean(),internacao:z.boolean(),hotel:z.boolean(),
  banhoTosa:z.boolean(),vendaExpressa:z.boolean(),receita:z.boolean(),despesas:z.boolean(),
}).strict();
const padrao={
  consultas:true,exames:true,internacao:true,hotel:true,
  banhoTosa:true,vendaExpressa:true,receita:true,despesas:true,
};
export const consultarIndicadoresPainel=createServerFn({method:"POST"})
  .validator((input:unknown)=>z.object({accessToken:z.string().min(20),clinicaId:z.string().uuid()}).parse(input))
  .handler(async({data})=>{
    const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
    const {data:auth,error:authError}=await supabaseAdmin.auth.getUser(data.accessToken);
    if(authError||!auth.user)throw new Error("Sessão expirada.");
    const userId=auth.user.id;
    const {data:perfil,error:erroPerfil}=await supabaseAdmin.from("app_users")
      .select("role").eq("user_id",userId).maybeSingle();
    if(erroPerfil)throw new Error("Falha ao verificar permissões.");
    if(perfil?.role!=="admin"){
      const {data:vinculo,error:erroVinculo}=await supabaseAdmin.from("clinica_usuarios")
        .select("clinica_id").eq("user_id",userId).eq("clinica_id",data.clinicaId)
        .eq("ativo",true).maybeSingle();
      if(erroVinculo||!vinculo)throw new Error("Usuário sem vínculo com esta clínica.");
      const {data:permissoes,error:erroPermissoes}=await(supabaseAdmin as any)
        .rpc("oricse_permissoes_efetivas",{p_clinica_id:data.clinicaId,p_user_id:userId});
      if(erroPermissoes||!Array.isArray(permissoes)||
        !permissoes.some((p:any)=>(p.codigo==="caixa.financeiro.visualizar"||p.codigo==="caixa.comandas"||p.codigo==="administracao.configuracoes")&&p.permitido===true)){
        throw new Error("Perfil sem acesso aos indicadores financeiros.");
      }
    }
    const {data:clinica,error:erroClinica}=await supabaseAdmin.from("clinicas")
      .select("id,status,excluido_em").eq("id",data.clinicaId).maybeSingle();
    if(erroClinica||!clinica||clinica.status!=="ativa"||clinica.excluido_em)throw new Error("Clínica indisponível.");
    const {data:registro,error:erroRegistro}=await supabaseAdmin.from("oricse_dados_modulos")
      .select("dados").eq("clinica_id",data.clinicaId).eq("chave","estado_sistema").maybeSingle();
    if(erroRegistro)throw new Error("Erro ao carregar as preferências.");
    const estado=registro?.dados&&typeof registro.dados==="object"&&!Array.isArray(registro.dados)
      ? registro.dados as Record<string,unknown>:{};
    const bruto=estado["oricse-modulos-administrativos-v3"];
    if(!bruto)return padrao;
    let parsed:unknown;
    try{parsed=JSON.parse(String(bruto));}catch{throw new Error("Preferências do painel inválidas.");}
    const prefs=schema.safeParse((parsed as {indicadores?:unknown})?.indicadores);
    if(!prefs.success)throw new Error("Preferências inconsistentes. Solicite revisão à administração.");
    return prefs.data;
  });
