import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { exigirPermissaoClinica } from "@/lib/permissao-clinica.server";

const cancelarInput = z.object({
  accessToken: z.string().min(20),
  clinicaId: z.string().uuid(),
  agendamentoId: z.string().uuid(),
  motivo: z.string().trim().min(8).max(500),
});
const politicaSchema = z.object({
  versao: z.literal(1),
  agenda: z.object({
    cancelamentoHoras: z.number().int().min(0).max(168),
    reagendamentoHoras: z.number().int().min(0).max(168),
  }),
});

/** Cancelamento pela clínica com verificação de vínculo, permissão e prazo no servidor. */
export const cancelarAgendamentoPolitica = createServerFn({ method: "POST" })
  .validator((v:unknown)=>cancelarInput.parse(v))
  .handler(async ({data})=>{
    const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
    const {data:auth,error:authError}=await supabaseAdmin.auth.getUser(data.accessToken);
    if(authError||!auth.user)throw new Error("Sessão expirada.");
    const uid=auth.user.id;
    await exigirPermissaoClinica(supabaseAdmin,uid,data.clinicaId,["recepcao.agenda"],data.accessToken);
    const {data:perfil}=await supabaseAdmin.from("app_users").select("role").eq("user_id",uid).maybeSingle();
    const adminGeral=perfil?.role==="admin";
    const {data:vinculo}=await supabaseAdmin.from("clinica_usuarios").select("papel")
      .eq("user_id",uid).eq("clinica_id",data.clinicaId).eq("ativo",true).maybeSingle();
    const {data:agendamento,error:erroAgenda}=await(supabaseAdmin as any).from("oricse_agendamentos_online")
      .select("id,clinica_id,inicio,estado,origem,observacoes").eq("id",data.agendamentoId).eq("clinica_id",data.clinicaId).maybeSingle();
    if(erroAgenda||!agendamento)throw new Error("Agendamento não encontrado nesta clínica.");
    if(!["solicitado","confirmado","reservado"].includes(String(agendamento.estado))){
      throw new Error("Este agendamento não permite cancelamento.");
    }
    const inicio=new Date(agendamento.inicio).getTime();
    if(!Number.isFinite(inicio)||inicio<=Date.now())throw new Error("Agendamento já iniciado ou encerrado.");
    const {data:registro,error:erroRegistro}=await supabaseAdmin.from("oricse_dados_modulos").select("dados")
      .eq("clinica_id",data.clinicaId).eq("chave","estado_sistema").maybeSingle();
    if(erroRegistro)throw new Error("Não foi possível conferir a política da clínica.");
    const estado=registro?.dados&&typeof registro.dados==="object"&&!Array.isArray(registro.dados)
      ? registro.dados as Record<string,unknown>:{};
    let horas=24;
    if(estado["oricse-politicas-operacionais-v1"]){
      let parsed:unknown;
      try{parsed=JSON.parse(String(estado["oricse-politicas-operacionais-v1"]));}
      catch{throw new Error("Política de cancelamento inválida.");}
      const valido=politicaSchema.safeParse(parsed);
      if(!valido.success)throw new Error("Política de cancelamento inconsistente.");
      horas=valido.data.agenda.cancelamentoHoras;
    }
    const gestao=adminGeral||["rt","admin_clinica"].includes(String(vinculo?.papel||""));
    const dentroDoPrazo=(inicio-Date.now())/3600000<horas;
    if(dentroDoPrazo&&!gestao){
      throw new Error("O prazo mínimo de "+horas+" horas para cancelar foi ultrapassado. Solicite autorização à administração.");
    }
    const observacao=String(agendamento.observacoes||"");
    const novaObservacao=(observacao+"\nCancelamento pela equipe: "+data.motivo).trim().slice(0,1500);
    const {data:alterado,error:erroUpdate}=await(supabaseAdmin as any).from("oricse_agendamentos_online")
      .update({estado:"cancelado",observacoes:novaObservacao})
      .eq("id",data.agendamentoId).eq("clinica_id",data.clinicaId).eq("estado",agendamento.estado)
      .select("id,estado").maybeSingle();
    if(erroUpdate||!alterado||alterado.estado!=="cancelado"){
      throw new Error("Não foi possível confirmar o cancelamento. Atualize a agenda e tente novamente.");
    }
    return {ok:true,agendamentoId:alterado.id,aprovacaoGerencial:dentroDoPrazo&&gestao};
  });
