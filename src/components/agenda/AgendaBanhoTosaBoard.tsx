import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { supabaseBanco } from "@/integrations/supabase/client";
import { usePermissoes } from "@/hooks/usePermissoes";
import { salvarAgendaOnline } from "@/lib/agenda.functions";
import { toast } from "sonner";

type Agenda = {id:string;nome:string;responsavel:string;inicio:string;fim:string;dias_semana:number[];intervalo_min:number;cor:string};
type Atendimento = {id:string;animal_id:string;inicio:string;fim:string;profissional:string;servico_nome:string;status:string};
type Animal = {id:string;nome:string};
const pad=(n:number)=>String(n).padStart(2,"0");
const iso=(d:Date)=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const duracao=(s:string)=>{const [h,m]=s.split(":").map(Number);return h*60+m};
const hora=(n:number)=>`${pad(Math.floor(n/60))}:${pad(n%60)}`;
const D=[{v:0,n:"Dom"},{v:1,n:"Seg"},{v:2,n:"Ter"},{v:3,n:"Qua"},{v:4,n:"Qui"},{v:5,n:"Sex"},{v:6,n:"Sáb"}];

export function AgendaBanhoTosaBoard(){
 const {clinicaId,pode,adminGlobal}=usePermissoes();
 const navigate=useNavigate();
 const [data,setData]=useState(iso(new Date())),[filtro,setFiltro]=useState("todas");
 const [agendas,setAgendas]=useState<Agenda[]>([]),[atendimentos,setAtendimentos]=useState<Atendimento[]>([]),[animais,setAnimais]=useState<Animal[]>([]);
 const [carregando,setCarregando]=useState(true),[salvando,setSalvando]=useState(false),[erro,setErro]=useState("");
 const [modal,setModal]=useState(false),[nome,setNome]=useState(""),[responsavel,setResponsavel]=useState(""),[entrada,setEntrada]=useState("08:00"),[saida,setSaida]=useState("18:00"),[intervalo,setIntervalo]=useState(30),[dias,setDias]=useState([1,2,3,4,5,6]);
 const permitido=adminGlobal||pode("recepcao.agenda")||pode("hotelzinho.operar");
 const carregar=useCallback(async()=>{
  if(!clinicaId){setCarregando(false);return;}
  setCarregando(true);
  const db=supabaseBanco as any;
  try{
   const [a,b,c]=await Promise.all([
    db.from("oricse_agendas_online").select("id,nome,responsavel,inicio,fim,dias_semana,intervalo_min,cor,tipo").eq("clinica_id",clinicaId).eq("tipo","Banho e tosa").order("nome"),
    db.from("oricse_banho_tosa_agendamentos").select("id,animal_id,inicio,fim,profissional,servico_nome,status").eq("clinica_id",clinicaId).gte("inicio",new Date(new Date(data+"T00:00:00").getTime()-86400000).toISOString()).lte("inicio",new Date(new Date(data+"T00:00:00").getTime()+172800000).toISOString()).limit(500),
    db.from("oricse_animais").select("id,nome").eq("clinica_id",clinicaId)
   ]);
   if(a.error||b.error||c.error)throw a.error||b.error||c.error;
   setAgendas(a.data||[]);setAtendimentos(b.data||[]);setAnimais(c.data||[]);setErro("");
  }catch(e){setErro(e instanceof Error?e.message:"Não foi possível carregar a agenda.");}
  finally{setCarregando(false);}
 },[clinicaId,data]);
 useEffect(()=>{void carregar()},[carregar]);
 const nomes=useMemo(()=>new Map(animais.map(a=>[a.id,a.nome])),[animais]);
 const diaSemana=new Date(data+"T12:00:00").getDay();
 const agendasDia=agendas.filter(a=>(filtro==="todas"||filtro===a.id)&&a.dias_semana.includes(diaSemana));
 function navegar(d:number){const dt=new Date(data+"T12:00:00");dt.setDate(dt.getDate()+d);setData(iso(dt))}
 function novo(a:Agenda,h:string){void navigate({to:"/banho-tosa",hash:"novo",search:{profissional:a.responsavel||a.nome,inicio:data+"T"+h} as any});}
 async function criar(){
  if(!clinicaId||!permitido)return;
  if(!nome.trim()||!responsavel.trim()||duracao(entrada)>=duracao(saida)||!dias.length||intervalo<5||intervalo>240){toast.error("Preencha nome, profissional, dias e horários válidos.");return;}
  setSalvando(true);
  try{
   const {data:auth}=await (supabaseBanco as any).auth.getSession();
   const token=auth.session?.access_token;if(!token)throw new Error("Sessão expirada.");
   await salvarAgendaOnline({data:{accessToken:token,clinicaId,agenda:{nome:nome.trim(),responsavel:responsavel.trim(),tipo:"Banho e tosa",inicio:entrada,fim:saida,dias_semana:dias,intervalo_min:intervalo,portal_ativo:false,modalidade:"livre",antecedencia_horas:0,timezone:"America/Sao_Paulo",cor:"roxo"}}});
   setModal(false);setNome("");setResponsavel("");toast.success("Agenda do profissional criada.");await carregar();
  }catch(e){toast.error(e instanceof Error?e.message:"Falha ao criar agenda");}finally{setSalvando(false);}
 }
 return <section className="min-w-0 rounded-2xl border bg-white p-4 shadow-sm sm:p-5">
  <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2"><CalendarDays size={22} className="text-primary"/><h2 className="text-2xl font-bold">Agenda do dia</h2></div><p className="mt-1 text-sm text-muted-foreground">Profissionais e horários do Banho e Tosa, com o mesmo modelo da agenda clínica.</p></div>
  <div className="flex flex-wrap gap-2"><select className="min-h-10 rounded-xl border bg-white px-3 text-sm font-semibold" value={filtro} onChange={e=>setFiltro(e.target.value)}><option value="todas">Todas as agendas</option>{agendas.map(a=><option key={a.id} value={a.id}>{a.nome} · {a.responsavel}</option>)}</select><button type="button" disabled={!permitido} onClick={()=>setModal(true)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-sm font-semibold disabled:opacity-50"><Plus size={15}/> Criar agenda</button></div></div>
  <div className="mt-4 flex items-center gap-3 rounded-2xl border bg-[#f8faf8] p-3"><button aria-label="Dia anterior" onClick={()=>navegar(-1)} className="rounded-xl border bg-white p-2.5"><ChevronLeft size={19}/></button><button onClick={()=>setData(iso(new Date()))} className="min-w-0 flex-1 text-center"><div className="text-[10px] font-bold uppercase tracking-wider text-[#126b5e]">DATA DA AGENDA</div><div className="text-xl font-black text-[#172b3c]">{new Date(data+"T12:00:00").toLocaleDateString("pt-BR",{weekday:"long",day:"2-digit",month:"long",year:"numeric"}).toUpperCase()}</div><div className="text-[10px] text-[#586678]">Clique para voltar para hoje</div></button><button aria-label="Próximo dia" onClick={()=>navegar(1)} className="rounded-xl border bg-white p-2.5"><ChevronRight size={19}/></button></div>
  {erro&&<p role="alert" className="mt-3 rounded-xl border border-red-200 p-3 text-sm text-red-700">{erro}</p>}
  {carregando?<p className="p-6 text-sm text-muted-foreground">Carregando agenda…</p>:!agendas.length?<div className="mt-5 rounded-2xl border border-dashed p-8 text-center"><CalendarDays className="mx-auto text-muted-foreground"/><h3 className="mt-3 text-lg font-bold">Nenhuma agenda criada</h3><p className="text-sm text-muted-foreground">Crie uma agenda para cada profissional do Banho e Tosa.</p><button disabled={!permitido} onClick={()=>setModal(true)} className="mt-4 rounded-xl bg-primary px-4 py-2 font-bold text-primary-foreground disabled:opacity-50">Criar primeira agenda</button></div>:
  <div className="mt-4 flex gap-3 overflow-x-auto pb-2">{agendasDia.map(a=><article key={a.id} className="w-[330px] min-w-[330px] overflow-hidden rounded-xl border-2 border-primary/30 bg-[#fcfcfb]"><header className="border-b bg-white p-3"><h3 className="font-black">{a.nome}</h3><p className="text-xs text-muted-foreground">Banho e tosa · {a.responsavel}</p><p className="mt-1 text-[10px] font-semibold text-primary">{a.inicio}–{a.fim} · {a.intervalo_min} min</p></header><div className="space-y-1.5 p-2">{Array.from({length:Math.max(0,Math.floor((duracao(a.fim)-duracao(a.inicio))/a.intervalo_min))},(_,i)=>hora(duracao(a.inicio)+i*a.intervalo_min)).map(h=>{
  const t=new Date(data+"T"+h+":00").getTime();
  const ocupados=atendimentos.filter(e=>e.status!=="cancelado"&&e.profissional.trim().toLocaleLowerCase("pt-BR")===a.responsavel.trim().toLocaleLowerCase("pt-BR")&&new Date(e.inicio).getTime()<=t&&new Date(e.fim).getTime()>t);
  const evento=ocupados[0];if(!evento)return <button key={h} disabled={!permitido} onClick={()=>novo(a,h)} className="flex min-h-9 w-full items-center gap-2 rounded-lg border border-dashed bg-white px-2.5 text-left text-[11px] hover:bg-secondary/40 disabled:opacity-50"><strong className="w-11">{h}</strong><span className="font-semibold text-muted-foreground">Livre</span><span className="ml-auto font-bold text-primary">+ Agendar</span></button>;
  const inicio=new Date(evento.inicio).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});
  return <div key={h} className="rounded-lg border border-sky-300 bg-sky-50 p-2 text-xs"><strong className="mr-2">{h}</strong>{inicio===h?<><strong>{nomes.get(evento.animal_id)||"Animal"}</strong><p className="text-[10px]">{evento.servico_nome} · {evento.status.replaceAll("_"," ")}</p></>:<span>Ocupado · {evento.servico_nome}</span>}</div>;
 })}</div></article>)}</div>}
  {!!agendas.length&&!agendasDia.length&&<p className="mt-4 rounded-xl bg-secondary/40 p-4 text-sm">Nenhum profissional atende nesta data.</p>}
  {modal&&<div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/35 p-4"><div className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-xl"><h3 className="text-xl font-bold">Criar agenda do Banho e Tosa</h3><div className="mt-4 grid gap-3 sm:grid-cols-2">{[["Nome da agenda",nome,setNome],["Profissional",responsavel,setResponsavel],["Início",entrada,setEntrada],["Fim",saida,setSaida]].map(([label,value,setter],i)=><label key={String(label)} className="text-sm font-semibold">{String(label)}<input required type={i>1?"time":"text"} value={String(value)} onChange={e=>(setter as (s:string)=>void)(e.target.value)} className="mt-1 w-full rounded-xl border p-3"/></label>)}<label className="text-sm font-semibold">Intervalo (min)<input type="number" min="5" max="240" value={intervalo} onChange={e=>setIntervalo(Number(e.target.value))} className="mt-1 w-full rounded-xl border p-3"/></label></div><p className="mt-4 text-sm font-bold">Dias de atendimento</p><div className="mt-2 flex flex-wrap gap-3">{D.map(d=><label key={d.v} className="text-sm"><input type="checkbox" checked={dias.includes(d.v)} onChange={e=>setDias(x=>e.target.checked?[...x,d.v]:x.filter(v=>v!==d.v))}/> {d.n}</label>)}</div><div className="mt-5 flex justify-end gap-2"><button onClick={()=>setModal(false)} className="rounded-xl border px-4 py-2">Cancelar</button><button disabled={salvando} onClick={()=>void criar()} className="rounded-xl bg-primary px-4 py-2 font-semibold text-primary-foreground">Salvar agenda</button></div></div></div>}
 </section>;
}
