import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, CalendarDays, Clock3, ListPlus, PawPrint, Send, Stethoscope } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabaseBanco } from "@/integrations/supabase/client";

import { categoriaAgendaBanhoTosa, dataHoraNoFuso, instanteDaAgenda, isoLocalAgenda } from "@/lib/agenda-operacional";

export const Route = createFileRoute("/encaminhar")({ component: Encaminhar });

type Tutor={id:string;nome:string;telefone:string|null;codigo_publico:string};
type Animal={id:string;tutor_id:string;nome:string;especie:string};
type Agenda={id:string;nome:string;responsavel:string;inicio:string;fim:string;dias_semana:number[];intervalo_min:number;timezone:string;tipo:string};
type Agendamento={id:string;agenda_id:string;inicio:string;fim:string;estado:string;pagamento_expira_em:string|null};
type Destino="agenda"|"fila";

function hojeIso(){return dataHoraNoFuso(new Date())?.data || isoLocalAgenda(new Date());}
function minutos(hora:string){const[h="0",m="0"]=hora.split(":");return Number(h)*60+Number(m);}
function horaDeMinutos(total:number){return `${String(Math.floor(total/60)).padStart(2,"0")}:${String(total%60).padStart(2,"0")}`;}
function hhmm(v:string){return v?.slice(0,5)||"";}

function Encaminhar(){
  const navigate=useNavigate();
  const params=new URLSearchParams(typeof window!=="undefined"?window.location.search:"");
  const tutorId=params.get("tutorId")||"";const animalId=params.get("animalId")||"";const retorno=params.get("retorno")||"";
  const [diaConsultado,setDiaConsultado]=useState("");const[versaoHorarios,setVersaoHorarios]=useState(0);
  const [clinicaId,setClinicaId]=useState("");const[tutor,setTutor]=useState<Tutor|null>(null);const[animal,setAnimal]=useState<Animal|null>(null);const[agendas,setAgendas]=useState<Agenda[]>([]);const[eventos,setEventos]=useState<Agendamento[]>([]);const[carregando,setCarregando]=useState(true);const[carregandoEventos,setCarregandoEventos]=useState(false);const[erroEventos,setErroEventos]=useState("");
  const[destino,setDestino]=useState<Destino>("agenda");const[data,setData]=useState(hojeIso());const[agendaId,setAgendaId]=useState("");const[hora,setHora]=useState("");const[salvando,setSalvando]=useState(false);
  const voltar=()=>{if(retorno==="animal"&&animalId){window.location.href=`/animal?animalId=${encodeURIComponent(animalId)}`;return;}void navigate({to:"/recepcao"});};

  useEffect(()=>{let vivo=true;void(async()=>{setCarregando(true);try{if(!tutorId||!animalId){void navigate({to:"/fila-espera"});return;}const{data:cid,error:ctxError}=await(supabaseBanco as any).rpc("oricse_resolver_clinica_cadastro_animal",{p_tutor:tutorId,p_animal:animalId});if(ctxError||!cid)throw new Error(ctxError?.message||"Clínica do tutor não identificada.");const[t,a,g]=await Promise.all([(supabaseBanco as any).from("tutores").select("id,nome,telefone,codigo_publico").eq("clinica_id",cid).eq("id",tutorId).maybeSingle(),(supabaseBanco as any).from("oricse_animais").select("id,tutor_id,nome,especie").eq("clinica_id",cid).eq("id",animalId).eq("tutor_id",tutorId).maybeSingle(),(supabaseBanco as any).from("oricse_agendas_online").select("id,nome,responsavel,inicio,fim,dias_semana,intervalo_min,timezone,tipo").eq("clinica_id",cid).order("nome")]);for(const r of[t,a,g])if(r.error)throw r.error;if(!vivo)return;setClinicaId(cid);setTutor(t.data);setAnimal(a.data);setAgendas((g.data||[]).filter((agenda:Agenda)=>!categoriaAgendaBanhoTosa(agenda.tipo)));}catch(e){if(vivo)toast.error(e instanceof Error?e.message:"Não foi possível abrir o encaminhamento.");}finally{if(vivo)setCarregando(false);}})();return()=>{vivo=false};},[tutorId,animalId]);

  const agenda=agendas.find(a=>a.id===agendaId);
  const chaveHorarios=JSON.stringify([clinicaId,agendaId,data,versaoHorarios]);

  useEffect(()=>{
    if(!clinicaId||!agenda||!data){setEventos([]);setCarregandoEventos(false);setErroEventos("");return;}
    let vivo=true;
    setDiaConsultado("");
    setEventos([]);
    setErroEventos("");
    setCarregandoEventos(true);
    const de=new Date(`${data}T00:00:00Z`);
    de.setUTCDate(de.getUTCDate()-1);
    const ate=new Date(`${data}T00:00:00Z`);
    ate.setUTCDate(ate.getUTCDate()+2);
    void(async()=>{
      try{
        const{data:lista,error,count}=await(supabaseBanco as any).from("oricse_agendamentos_online")
          .select("id,agenda_id,inicio,fim,estado,pagamento_expira_em", {count:"exact"}).eq("clinica_id",clinicaId)
          .eq("agenda_id",agenda.id).gt("fim",de.toISOString()).lt("inicio",ate.toISOString());
        if(!vivo)return;
        if(error || !Array.isArray(lista) || count !== lista.length) throw error || new Error("Lista de horários incompleta.");
        setEventos(lista);
        setDiaConsultado(chaveHorarios);
      }catch(error){
        if(vivo){setErroEventos("Não foi possível consultar os horários ocupados.");toast.error(error instanceof Error?error.message:"Falha ao consultar horários.");}
      }finally{if(vivo)setCarregandoEventos(false);}
    })();
    return()=>{vivo=false};
  },[clinicaId,agenda,data,chaveHorarios]);

  // A agenda é um recurso da clínica; o profissional vinculado é opcional.
  // Filtrar somente pela data impede bloquear agendas válidas sem responsável.
  const agendasDisponiveis=useMemo(()=>{if(!data)return[];const[y,m,d]=data.split("-").map(Number);const dia=new Date(y,m-1,d,12).getDay();return agendas.filter(a=>(a.dias_semana||[]).includes(dia));},[agendas,data]);
  const horarios=useMemo(()=>{
    if(!agenda||!Number.isInteger(agenda.intervalo_min)||agenda.intervalo_min<5)return [];
    const lista:string[]=[];
    for(let m=minutos(hhmm(agenda.inicio));m+agenda.intervalo_min<=minutos(hhmm(agenda.fim));m+=agenda.intervalo_min) {
      lista.push(horaDeMinutos(m));
    }
    return lista;
  },[agenda]);
  const gradePronta=diaConsultado===chaveHorarios&&!carregandoEventos&&!erroEventos;
  const livres=useMemo(()=>{
    if(!agenda||!gradePronta)return [];
    const agora=Date.now();
    return horarios.filter(h=>{
      const instante=instanteDaAgenda(data,h,agenda.timezone);
      if(!instante)return false;
      const inicio=Date.parse(instante),fim=inicio+agenda.intervalo_min*60_000;
      if(inicio<=agora)return false;
      return !eventos.some(e=>
        !["cancelado","expirado"].includes(e.estado)
        && !(e.estado==="reservado" && e.pagamento_expira_em && Date.parse(e.pagamento_expira_em)<=agora)
        && inicio<Date.parse(e.fim) && fim>Date.parse(e.inicio));
    });
  },[agenda,horarios,eventos,data,gradePronta]);

  async function enviarAgenda(){
    if(!tutor||!animal||!agenda||!clinicaId||salvando)return;
    if(!gradePronta)return void toast.error("Aguarde a confirmação dos horários disponíveis.");
    if(!hora)return void toast.error("Selecione um horário livre.");
    const instante=instanteDaAgenda(data,hora,agenda.timezone);
    if(!livres.includes(hora)||!instante||Date.parse(instante)<=Date.now()){
      setVersaoHorarios(v=>v+1);
      setHora("");
      return void toast.error("Esse horário não está mais disponível. Selecione outro.");
    }
    setSalvando(true);
    try{
      const{data:quantidade,error}=await(supabaseBanco as any).rpc("oricse_agenda_salvar_horarios",{
        p_clinica:clinicaId,p_agenda:agenda.id,p_data:data,p_hora:hora,
        p_duracao:agenda.intervalo_min,p_tipo:"Consulta",p_tutor:tutor.id,p_animal:animal.id,
      });
      if(error)throw error;
      if(quantidade!==1)throw new Error("A agenda não confirmou o agendamento.");
      toast.success(`${animal.nome} agendado na agenda ${agenda.nome}${agenda.responsavel?.trim() ? ` com ${agenda.responsavel.trim()}` : ""} em ${data} às ${hora}.`);
      voltar();
    }catch(e:any){
      if(e?.code==="23P01"){setHora("");setVersaoHorarios(v=>v+1);}
      toast.error(e?.code==="23P01"?"Esse horário acabou de ser ocupado. Escolha outro.":e?.message||"Não foi possível agendar.");
    }finally{setSalvando(false);}
  }

  async function enviarFila(){
    if(!tutor||!animal||!clinicaId)return;
    setSalvando(true);
    try{
      const {error}=await (supabaseBanco as any).rpc("oricse_fila_operar",{p_clinica:clinicaId,p_acao:"adicionar",p_tutor:tutor.id,p_animal:animal.id,p_motivo:""});
      if(error)throw error;
      toast.success(`${animal.nome} enviado para a fila de espera.`);
      voltar();
    }catch(e){toast.error(e instanceof Error?e.message:"Não foi possível enviar à fila.");}
    finally{setSalvando(false);}
  }

  if(carregando)return <main className="mx-auto max-w-3xl p-8 text-sm text-muted-foreground">Carregando...</main>;
  if(!tutor||!animal)return <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-8 sm:px-6"><Link to="/tutores" className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft size={18}/> Voltar</Link><div className="mt-5 rounded-2xl border border-destructive/30 bg-destructive/5 p-5">Tutor ou animal não encontrado no banco desta clínica.</div></main>;

  return <main className="mx-auto min-h-screen w-full max-w-3xl px-4 pb-28 pt-6 sm:px-6"><button onClick={voltar} className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft size={18}/> Voltar</button><div className="mt-4"><p className="text-xs font-bold uppercase tracking-wider text-primary">Enviar para…</p><h1 className="mt-1 flex items-center gap-2 text-3xl font-black"><PawPrint className="text-primary"/> {animal.nome}</h1><p className="mt-1 text-sm text-muted-foreground">Tutor: <strong className="text-foreground">{tutor.nome}</strong> <span className="ml-2 font-mono font-semibold text-primary">{tutor.codigo_publico}</span>{tutor.telefone?` · ${tutor.telefone}`:""}</p></div><div className="mt-6 grid gap-3 sm:grid-cols-2"><button onClick={()=>setDestino("agenda")} className={`rounded-2xl border-2 p-4 text-left ${destino==="agenda"?"border-primary bg-primary/5":"border-slate-200 bg-white"}`}><CalendarDays className="text-primary"/><div className="mt-2 font-black">Agenda</div><div className="text-sm text-muted-foreground">Consulta na agenda clínica usada na Recepção e no Portal.</div></button><button onClick={()=>setDestino("fila")} className={`rounded-2xl border-2 p-4 text-left ${destino==="fila"?"border-primary bg-primary/5":"border-slate-200 bg-white"}`}><ListPlus className="text-primary"/><div className="mt-2 font-black">Fila de espera</div><div className="text-sm text-muted-foreground">Atendimento por ordem de chegada.</div></button></div>
  {destino==="agenda"?<section className="mt-5 rounded-2xl border bg-white p-5 shadow-sm">
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">Para banho ou tosa, use o <Link to="/banho-tosa" className="font-semibold text-primary underline">módulo de Banho e Tosa</Link>.</p>
      <label className="block text-sm font-semibold">
        Data do atendimento
        <input type="date" value={data} min={hojeIso()} onChange={e=>{setData(e.target.value);setAgendaId("");setHora("");}} className="mt-2 min-h-12 w-full rounded-xl border bg-white px-3 text-base font-normal"/>
      </label>
      {data&&<div>
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><CalendarDays size={16} className="text-primary"/> Agenda disponível</div>
        {agendasDisponiveis.length?<div className="grid gap-2 sm:grid-cols-2">
          {agendasDisponiveis.map((a,index)=><button type="button" key={a.id} aria-pressed={agendaId===a.id} onClick={()=>{setAgendaId(a.id);setHora("");}} className={`rounded-xl border-2 p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${agendaId===a.id?"border-primary bg-primary/5":"border-slate-200 bg-white hover:border-primary/50"}`}>
            <div className="text-base font-bold">{a.nome}</div>
            <div className="mt-1 text-sm text-muted-foreground">{hhmm(a.inicio)}–{hhmm(a.fim)} · {a.intervalo_min} min</div>
            <div className="mt-1 text-xs text-muted-foreground">{a.responsavel?.trim() ? `Veterinário: ${a.responsavel.trim()}` : "Profissional a definir"}{agendasDisponiveis.filter(item=>item.nome===a.nome).length>1 ? ` · Agenda ${index+1}` : ""}</div>
          </button>)}
        </div>:<div role="status" className="rounded-xl border border-dashed bg-slate-50 p-4 text-sm text-muted-foreground">Nenhuma agenda cadastrada para esta data. Escolha outro dia.</div>}
      </div>}
      {agenda&&<div>
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Clock3 size={16} className="text-primary"/> Horário</div>
        {!gradePronta&&!erroEventos&&<p role="status" className="mb-3 text-sm text-muted-foreground">Verificando horários disponíveis...</p>}
        {erroEventos&&<div role="alert" className="mb-3 text-sm font-semibold text-red-700">{erroEventos} <button type="button" className="underline" onClick={()=>setVersaoHorarios(v=>v+1)}>Tentar novamente</button></div>}
        {gradePronta&&<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {horarios.map(h=>{const livre=livres.includes(h);return <button type="button" key={h} aria-pressed={hora===h} disabled={!livre} onClick={()=>setHora(h)} className={`min-h-11 rounded-xl border px-2 text-sm font-bold ${!livre?"cursor-not-allowed bg-slate-100 text-slate-400":hora===h?"border-primary bg-primary text-primary-foreground":"bg-white hover:border-primary"}`}>{h}<span className="ml-1 text-[10px] font-medium">{livre?"Livre":"Indisponível"}</span></button>})}
        </div>}
        {gradePronta&&horarios.length===0&&<p role="status" className="mt-2 text-sm text-muted-foreground">Esta agenda não possui horários configurados para atendimento.</p>}
      </div>}
    </div>
    <button type="button" disabled={salvando||!agenda||!hora||!livres.includes(hora)} onClick={enviarAgenda} className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"><Stethoscope size={18}/>{salvando?"Agendando...":"Confirmar agendamento"}</button>
  </section>:<section className="mt-5 rounded-2xl border bg-white p-5 shadow-sm"><div className="rounded-xl bg-primary/5 p-4"><div className="font-black">Fila de espera</div><p className="mt-1 text-sm text-muted-foreground">{animal.nome} será adicionado à fila com o tutor {tutor.nome}.</p></div><button onClick={enviarFila} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground"><Send size={18}/> Enviar para fila</button></section>}</main>;
}
