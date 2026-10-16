import { oricseStorage, oricseSession } from "@/lib/oricse-storage";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lerComandas, saldoComanda, totalComanda, totalPagoComanda } from "@/lib/comandas";

function dataHoraNoFuso(valor:string,timeZone:string){
  const data=new Date(valor);
  const partes=new Intl.DateTimeFormat("en-CA",{timeZone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false}).formatToParts(data);
  const mapa=Object.fromEntries(partes.map(p=>[p.type,p.value]));
  return {data:`${mapa.year}-${mapa.month}-${mapa.day}`,hora:`${mapa.hour}:${mapa.minute}`};
}

export function CrmBackgroundSync(){
  useEffect(()=>{
    let ativo=true;

    const sincronizarComandas=async(clinicaId:string)=>{
      if(typeof window==="undefined")return;
      const comandas=lerComandas();
      if(!comandas.length)return;
      const [tutoresResp,animaisResp]=await Promise.all([
        (supabase as any).from("tutores").select("id").eq("clinica_id",clinicaId),
        (supabase as any).from("oricse_animais").select("id,tutor_id").eq("clinica_id",clinicaId),
      ]);
      if(tutoresResp.error||animaisResp.error)return;
      const tutores=new Set((tutoresResp.data||[]).map((t:any)=>String(t.id)));
      const animais=new Map((animaisResp.data||[]).map((a:any)=>[String(a.id),String(a.tutor_id)]));
      const compativeis=comandas.filter((c)=>tutores.has(String(c.tutorId))&&animais.get(String(c.animalId))===String(c.tutorId));
      if(!compativeis.length)return;
      const agora=new Date().toISOString();
      const linhas=compativeis.map((c)=>({
        id:c.id,
        clinica_id:clinicaId,
        tutor_id:c.tutorId,
        animal_id:c.animalId,
        numero:c.numero,
        status:c.status,
        origem:c.origem,
        aberta_em:c.abertaEm,
        finalizada_em:c.finalizadaEm||null,
        itens:c.itens,
        pagamentos:c.pagamentos,
        total:totalComanda(c),
        total_pago:totalPagoComanda(c),
        saldo:saldoComanda(c),
        visivel_tutor:true,
        updated_at:agora,
      }));
      await(supabase as any).from("oricse_portal_comandas").upsert(linhas,{onConflict:"id"});
    };

    const sincronizar=async()=>{
      if(!ativo||typeof window==="undefined")return;
      const{data:sessao}=await supabase.auth.getSession();const userId=sessao.session?.user?.id;if(!userId)return;
      const{data:contexto}=await(supabase as any).rpc("oricse_contexto_clinica_atual");const clinicaId=contexto?.[0]?.clinica_id;if(!clinicaId)return;
      const ler=(chave:string)=>{try{const valor=JSON.parse(oricseStorage.getItem(chave)||"[]");return Array.isArray(valor)?valor:[];}catch{return[];}};
      const[agendasResp,eventosResp]=await Promise.all([
        (supabase as any).from("oricse_agendas_online").select("id,nome,responsavel,timezone").eq("clinica_id",clinicaId),
        (supabase as any).from("oricse_agendamentos_online").select("id,agenda_id,tutor_id,animal_id,animal_referencia,inicio,estado,tipo,dados").eq("clinica_id",clinicaId).neq("estado","cancelado"),
      ]);
      if(agendasResp.error||eventosResp.error)return;
      const agendas=(agendasResp.data||[]).map((agenda:any)=>({
        id:agenda.id,nome:agenda.nome,responsavel:agenda.responsavel,
        eventos:(eventosResp.data||[]).filter((e:any)=>e.agenda_id===agenda.id).map((e:any)=>{const dh=dataHoraNoFuso(e.inicio,agenda.timezone||"America/Sao_Paulo");return{id:e.id,tutorId:e.tutor_id,animalId:e.animal_id,paciente:e.animal_referencia,data:dh.data,hora:dh.hora,tipo:e.tipo,status:e.estado==="solicitado"?"Agendado":String(e.dados?.status_clinico||"Agendado"),pagamento:String(e.dados?.pagamento||"Pendente")};}),
      }));
      const agora=new Date().toISOString();
      const{error}=await(supabase as any).from("oricse_crm_fontes").upsert({clinica_id:clinicaId,tutores:ler("oricse-tutores-v1"),animais:ler("oricse-animais-v1"),prontuario:ler("oricse-prontuario-animal-v1"),agendas,sincronizado_por:userId,sincronizado_em:agora,updated_at:agora},{onConflict:"clinica_id"});
      if(!error)await(supabase as any).rpc("oricse_crm_processar_clinica",{p_clinica_id:clinicaId});
      await sincronizarComandas(String(clinicaId));
    };

    const aoMudarComanda=()=>void sincronizar();
    const aoStorage=(evento:StorageEvent)=>{if(evento.key==="oricse-comandas-v1")void sincronizar();};
    void sincronizar();
    window.addEventListener("oricse-comandas-atualizadas",aoMudarComanda);
    window.addEventListener("storage",aoStorage);
    const timer=window.setInterval(()=>void sincronizar(),300000);
    return()=>{
      ativo=false;
      window.removeEventListener("oricse-comandas-atualizadas",aoMudarComanda);
      window.removeEventListener("storage",aoStorage);
      window.clearInterval(timer);
    };
  },[]);
  return null;
}
