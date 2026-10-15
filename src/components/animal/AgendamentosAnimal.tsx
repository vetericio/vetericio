import { Link } from "@tanstack/react-router";
import { CalendarDays, Clock3, Loader2, Plus, Stethoscope } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type AgendamentoDb={
  id:string;
  agenda_id:string;
  inicio:string;
  fim:string;
  estado:string;
  tipo:string;
  origem:string;
  dados:Record<string,unknown>|null;
};
type AgendaDb={id:string;nome:string;responsavel:string;timezone:string};
type AgendamentoAnimal=AgendamentoDb&{agendaNome:string;responsavel:string;timezone:string};

function status(item:AgendamentoDb){
  if(item.estado==="cancelado")return"Cancelado";
  if(item.estado==="solicitado")return"Aguardando aprovação";
  const clinico=String(item.dados?.status_clinico||"");
  return clinico||"Agendado";
}
function pagamento(item:AgendamentoDb){const p=String(item.dados?.pagamento||"");return p==="Pendente"?"Pagamento pendente":p;}
function formatarDataHora(valor:string,timeZone:string){
  const d=new Date(valor);
  return {
    data:new Intl.DateTimeFormat("pt-BR",{timeZone,day:"2-digit",month:"2-digit",year:"numeric"}).format(d),
    hora:new Intl.DateTimeFormat("pt-BR",{timeZone,hour:"2-digit",minute:"2-digit",hour12:false}).format(d),
  };
}

export function AgendamentosAnimal({animalId,tutorId}:{animalId:string;tutorId:string}){
  const[agendamentos,setAgendamentos]=useState<AgendamentoAnimal[]>([]);
  const[carregando,setCarregando]=useState(true);

  useEffect(()=>{
    let vivo=true;
    void(async()=>{
      setCarregando(true);
      try{
        const{data:ctx,error:ctxError}=await(supabase as any).rpc("oricse_contexto_clinica_atual");
        if(ctxError)throw ctxError;
        const clinicaId=ctx?.[0]?.clinica_id||"";
        if(!clinicaId){if(vivo)setAgendamentos([]);return;}
        const[a,e]=await Promise.all([
          (supabase as any).from("oricse_agendas_online").select("id,nome,responsavel,timezone").eq("clinica_id",clinicaId),
          (supabase as any).from("oricse_agendamentos_online").select("id,agenda_id,inicio,fim,estado,tipo,origem,dados").eq("clinica_id",clinicaId).eq("animal_id",animalId).neq("estado","cancelado").order("inicio",{ascending:true}),
        ]);
        if(a.error)throw a.error;if(e.error)throw e.error;
        const mapa=new Map<string,AgendaDb>((a.data||[]).map((item:AgendaDb)=>[item.id,item]));
        const lista=(e.data||[]).map((item:AgendamentoDb)=>{const agenda=mapa.get(item.agenda_id);return{...item,agendaNome:agenda?.nome||"Agenda",responsavel:agenda?.responsavel||"Sem responsável",timezone:agenda?.timezone||"America/Sao_Paulo"};});
        if(vivo)setAgendamentos(lista);
      }catch(error){console.error("Não foi possível carregar os agendamentos do animal:",error);if(vivo)setAgendamentos([]);}finally{if(vivo)setCarregando(false);}
    })();
    return()=>{vivo=false};
  },[animalId]);

  const ordenados=useMemo(()=>{
    const agora=Date.now();
    const futuros=agendamentos.filter(i=>new Date(i.inicio).getTime()>=agora).sort((a,b)=>+new Date(a.inicio)-+new Date(b.inicio));
    const passados=agendamentos.filter(i=>new Date(i.inicio).getTime()<agora).sort((a,b)=>+new Date(b.inicio)-+new Date(a.inicio));
    return[...futuros,...passados];
  },[agendamentos]);
  const agora=Date.now();

  return <section className="mt-4 overflow-hidden rounded-2xl border bg-white shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/20 px-4 py-3"><div><div className="flex items-center gap-2"><CalendarDays size={19} className="text-primary"/><h2 className="text-xl font-black">Agendamentos</h2></div><p className="mt-1 text-sm text-muted-foreground">Histórico vindo da mesma agenda usada pela Recepção e pelo Portal do Tutor.</p></div><Link to="/encaminhar" search={{tutorId,animalId,retorno:"animal"} as never} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-black text-primary-foreground"><Plus size={16}/> Novo agendamento</Link></div>
    <div className="p-4"><div className="mb-3 text-xs font-black uppercase tracking-wide text-muted-foreground">Histórico de agendamentos</div>{carregando?<div className="flex items-center gap-2 rounded-xl bg-slate-50 p-4 text-sm text-muted-foreground"><Loader2 size={16} className="animate-spin"/>Carregando agenda...</div>:ordenados.length?<div className="space-y-2.5">{ordenados.map(item=>{const dh=formatarDataHora(item.inicio,item.timezone);const futuro=new Date(item.inicio).getTime()>=agora;return <article key={item.id} className="rounded-xl border bg-white p-3.5"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><strong className="text-base">{dh.data}</strong><span className="inline-flex items-center gap-1 text-sm font-bold text-primary"><Clock3 size={14}/>{dh.hora}</span>{futuro&&<span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-700">Próximo</span>}</div><div className="mt-1 flex items-center gap-1.5 text-sm font-bold"><Stethoscope size={14} className="text-primary"/>{item.responsavel}</div><div className="mt-1 text-xs text-muted-foreground">{item.agendaNome} · {item.tipo} · {item.origem==="portal_tutor"?"Tutor APP":"Recepção"}</div></div><div className="text-right text-xs"><div className="font-bold">{status(item)}</div>{pagamento(item)&&<div className="mt-1 text-muted-foreground">{pagamento(item)}</div>}</div></div></article>})}</div>:<div className="rounded-xl border border-dashed bg-slate-50 px-4 py-10 text-center text-muted-foreground"><CalendarDays className="mx-auto mb-3 opacity-30" size={34}/><p>Nenhum agendamento registrado para este animal.</p></div>}</div>
  </section>;
}
