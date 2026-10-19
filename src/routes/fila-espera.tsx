import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Clock3, Play, Plus, RotateCcw, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabaseBanco } from "@/integrations/supabase/client";
import { lerContextoAdminClinica } from "@/lib/admin-clinic-context";
import { codigoPublicoTutor } from "@/lib/codigo-tutor";

export const Route = createFileRoute("/fila-espera")({ component: FilaEspera });

type Tutor = { id: string; nome: string; telefone?: string; email?: string; cpf?: string; cpfCnpj?: string; codigoPublico?: string; codigo_publico?: string; codigo?: string };
type Animal = { id: string; tutorId: string; nome: string; especie?: string; raca?: string };
type StatusFila = "Aguardando" | "Chamado";
type ItemFila = { id: string; tutorId: string; animalId: string; tutorNome: string; animalNome: string; especie?: string; motivo?: string; chegadaEm: string; status: StatusFila; chamadoEm?: string };


function normalizar(valor?: string) { return (typeof valor === "string" ? valor : "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim(); }
function somenteDigitos(valor?: string) { return (typeof valor === "string" ? valor : "").replace(/\D/g, ""); }
function codigoTutor(tutor: Tutor) { return codigoPublicoTutor(tutor) || ""; }
function hora(dataIso: string) { const data = new Date(typeof dataIso === "string" ? dataIso : ""); return Number.isNaN(data.getTime()) ? "—" : new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(data); }
function tempoEspera(dataIso: string, agora = Date.now()) { const chegada = new Date(dataIso).getTime(); if (!Number.isFinite(chegada)) return "—"; const minutos=Math.max(0,Math.floor((agora-chegada)/60000)); if(minutos<60)return `${minutos} min`; const h=Math.floor(minutos/60),m=minutos%60; return m?`${h}h ${m}min`:`${h}h`; }
function emojiEspecie(especie?: string) { const mapa: Record<string,string>={"Cão":"🐶","Gato":"🐱","Coelho":"🐰","Hamster":"🐹","Rato":"🐭","Porquinho-da-índia":"🐹","Ave":"🦜","Réptil":"🦎","Quelônio":"🐢","Serpente":"🐍"}; return mapa[especie||""]||"🐾"; }

function FilaEspera() {
  const navigate=useNavigate();
  const [clinicaId,setClinicaId]=useState("");
  const [carregando,setCarregando]=useState(true);
  const [erroCarregamento,setErroCarregamento]=useState("");
  const [tutores, setTutores] = useState<Tutor[]>([]);
  const [animais, setAnimais] = useState<Animal[]>([]);
  const [fila, setFila] = useState<ItemFila[]>([]);
  const [tutorId, setTutorId] = useState("");
  const [buscaTutor, setBuscaTutor] = useState("");
  const [buscaTutorAberta, setBuscaTutorAberta] = useState(false);
  const [animalId, setAnimalId] = useState("");
  const [motivo, setMotivo] = useState("");

  async function carregarFila(cid:string){
    const {data,error}=await (supabaseBanco as any).rpc("oricse_fila_tela",{p_clinica:cid});
    if(error)throw error;
    setTutores(data?.tutores||[]);setAnimais(data?.animais||[]);setFila(data?.fila||[]);
    return data;
  }
  useEffect(()=>{let ativo=true;(async()=>{try{
    const {data:cidBanco,error}=await (supabaseBanco as any).rpc("oricse_clinica_ativa_obter");
    if(error)throw error;
    const contextoAdmin=lerContextoAdminClinica();
    // A escolha do Admin pode ainda estar em memória enquanto a persistência sincroniza.
    // O backend valida a permissão e registra a escolha antes de consultar qualquer paciente.
    let cid=cidBanco as string|null;
    if(!cid && contextoAdmin?.clinicaId){
      const {data:registrada,error:erroRegistro}=await (supabaseBanco as any).rpc("oricse_clinica_ativa_definir",{p_clinica:contextoAdmin.clinicaId});
      if(erroRegistro)throw erroRegistro;
      cid=registrada;
    }
    if(!cid)throw Error("Escolha uma clínica na página Início antes de abrir a fila.");
    if(ativo)setErroCarregamento("");
    if(!ativo)return;
    setClinicaId(cid);
    await carregarFila(cid);
    // O Supabase é a fonte única. Não reimportar registros antigos durante a abertura da tela.
  }catch(e){if(ativo){const msg=e instanceof Error?e.message:"Falha ao carregar fila de espera";setErroCarregamento(msg);toast.error(msg);}}
  finally{if(ativo)setCarregando(false)}})();return()=>{ativo=false};},[]);

  const tutorSelecionado = useMemo(() => tutores.find((t)=>t.id===tutorId), [tutores,tutorId]);
  const codigoTutorItem = (item: ItemFila) => codigoTutor(tutores.find((tutor) => tutor.id === item.tutorId) || { id: item.tutorId, nome: item.tutorNome });
  const tutoresFiltrados = useMemo(() => {
    const termo=normalizar(buscaTutor), digitos=somenteDigitos(buscaTutor);
    const lista=[...tutores].sort((a,b)=>String(a.nome || "").localeCompare(String(b.nome || ""),"pt-BR"));
    if(!termo) return lista.slice(0,8);
    return lista.filter((t)=>normalizar(t.nome).includes(termo)||normalizar(codigoTutor(t)).includes(termo)||(!!digitos&&[t.cpf,t.cpfCnpj].some((documento)=>somenteDigitos(documento).includes(digitos)))).slice(0,12);
  }, [tutores,buscaTutor]);
  const animaisDoTutor = useMemo(() => animais.filter((a)=>a.tutorId===tutorId).sort((a,b)=>String(a.nome || "").localeCompare(String(b.nome || ""),"pt-BR")), [animais,tutorId]);
  const aguardando = useMemo(() => fila.filter((i)=>i.status==="Aguardando").sort((a,b)=>new Date(a.chegadaEm).getTime()-new Date(b.chegadaEm).getTime()), [fila]);
  const chamados = useMemo(() => fila.filter((i)=>i.status==="Chamado").sort((a,b)=>new Date(b.chamadoEm||b.chegadaEm).getTime()-new Date(a.chamadoEm||a.chegadaEm).getTime()), [fila]);

  async function operar(acao:string,params:Record<string,unknown>={}){
    if(!clinicaId)return toast.error("Clínica não identificada.");
    const {error}=await (supabaseBanco as any).rpc("oricse_fila_operar",{p_clinica:clinicaId,p_acao:acao,...params});
    if(error){toast.error(error.message);return false;}
    await carregarFila(clinicaId);
    return true;
  }
  function selecionarTutor(tutor:Tutor){setTutorId(tutor.id);setAnimalId("");setBuscaTutor(tutor.nome);setBuscaTutorAberta(false);}
  function limparTutor(){setTutorId("");setAnimalId("");setBuscaTutor("");setBuscaTutorAberta(false);}
  async function adicionarFila(){
    if(!tutorId||!animalId)return toast.error("Selecione tutor e animal.");
    const sucesso=await operar("adicionar",{p_tutor:tutorId,p_animal:animalId,p_motivo:motivo.trim()});
    if(sucesso){limparTutor();setMotivo("");toast.success("Paciente registrado na fila.");}
  }
  async function chamar(id:string){const item=fila.find(i=>i.id===id);if(!item)return;const sucesso=await operar("chamar",{p_item:id});if(sucesso)void navigate({to:"/animal",search:{animalId:item.animalId} as never});}
  async function voltarParaFila(id:string){await operar("voltar",{p_item:id});}
  async function remover(id:string){const item=fila.find(i=>i.id===id);if(!item||!window.confirm(`Remover ${item.animalNome} da fila?`))return;await operar("remover",{p_item:id});}

  const campo="min-h-11 w-full rounded-xl border bg-white px-3 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10";

  return <main className="mx-auto min-h-screen w-full max-w-[1500px] px-4 pb-28 pt-6 sm:px-6">
    <Link to="/recepcao" className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft size={18}/> Voltar para Recepção</Link>
    <div className="mt-4 flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-semibold uppercase tracking-wider text-primary">Recepção</p><h1 className="mt-1 text-3xl font-bold">Fila de espera</h1><p className="mt-1 text-muted-foreground">Pacientes que chegaram sem horário marcado e aguardam ser chamados.</p></div><div className="rounded-full bg-primary/10 px-4 py-2 text-sm font-bold text-primary">{erroCarregamento?"Indisponível":carregando?"Carregando…":`${aguardando.length} aguardando`}</div></div>

    {erroCarregamento&&<div role="alert" className="mt-5 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm"><strong>Não foi possível carregar a fila.</strong><p className="mt-1">{erroCarregamento}</p><Link to="/inicio" className="mt-2 inline-block font-semibold underline">Selecionar clínica no Início</Link></div>}
    <section className="mt-6 rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex items-center gap-2"><Plus size={19} className="text-primary"/><h2 className="text-lg font-bold">Adicionar à fila</h2></div>
      <div className="mt-4 grid gap-3 lg:grid-cols-[1.2fr_1.2fr_1.5fr_auto] lg:items-end">
        <div className="relative text-sm font-semibold"><span>Tutor</span><div className="relative mt-1"><Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/><input value={buscaTutor} onFocus={()=>setBuscaTutorAberta(true)} onChange={(e)=>{setBuscaTutor(e.target.value); if(tutorId){setTutorId("");setAnimalId("");} setBuscaTutorAberta(true);}} placeholder="Digite nome, CPF ou ID do tutor" className={`${campo} pl-9 pr-9`}/>{(buscaTutor||tutorId)&&<button type="button" onClick={limparTutor} aria-label="Limpar tutor" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted"><X size={15}/></button>}</div>
          {buscaTutorAberta&&!tutorSelecionado&&<div className="absolute z-40 mt-1 max-h-72 w-full overflow-auto rounded-xl border bg-white p-1 shadow-xl">{tutoresFiltrados.length?tutoresFiltrados.map((t)=><button key={t.id} type="button" onMouseDown={(e)=>e.preventDefault()} onClick={()=>selecionarTutor(t)} className="block w-full rounded-lg px-3 py-2 text-left hover:bg-primary/5"><div className="font-semibold text-foreground">{t.nome}</div><div className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] font-normal text-muted-foreground">{codigoTutor(t)&&<span>{codigoTutor(t)}</span>}{t.cpf&&<span>CPF {t.cpf}</span>}{t.telefone&&<span>{t.telefone}</span>}</div></button>):<div className="px-3 py-3 text-xs font-normal text-muted-foreground">Nenhum tutor encontrado.</div>}</div>}
          {tutorSelecionado&&<div className="mt-1 truncate text-[11px] font-normal text-muted-foreground">Selecionado: {codigoTutor(tutorSelecionado)?`${codigoTutor(tutorSelecionado)} · `:""}{tutorSelecionado.nome}{tutorSelecionado.cpf?` · CPF ${tutorSelecionado.cpf}`:""}</div>}
        </div>
        <label className="text-sm font-semibold">Animal<select value={animalId} onChange={(e)=>setAnimalId(e.target.value)} disabled={!tutorId} className={`${campo} mt-1 disabled:opacity-50`}><option value="">{tutorId?"Selecione o animal":"Selecione o tutor primeiro"}</option>{animaisDoTutor.map((a)=><option key={a.id} value={a.id}>{emojiEspecie(a.especie)} {a.nome}</option>)}</select></label>
        <label className="text-sm font-semibold">Motivo da chegada <span className="font-normal text-muted-foreground">(opcional)</span><input value={motivo} onChange={(e)=>setMotivo(e.target.value)} placeholder="Ex.: vômito, retorno, vacina..." className={`${campo} mt-1`}/></label>
        <button type="button" onClick={adicionarFila} disabled={carregando||!!erroCarregamento||!clinicaId} className="min-h-11 rounded-xl bg-primary px-5 font-bold text-primary-foreground">Adicionar</button>
      </div>
      {carregando&&<p className="mt-3 text-sm text-muted-foreground">Carregando tutores e fila…</p>}{!carregando&&tutores.length===0&&<p className="mt-3 text-sm text-muted-foreground">Nenhum tutor cadastrado. <Link to="/tutores" className="font-semibold text-primary underline">Cadastrar tutor</Link></p>}
    </section>

    <section className="mt-5 min-w-0 overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2"><Clock3 size={19} className="text-primary"/><h2 className="font-bold">Fila de espera</h2></div>
        <span className="text-sm text-muted-foreground">Ordem de chegada</span>
      </div>
      {erroCarregamento
        ? <div className="p-5 text-sm text-destructive">Não foi possível consultar a fila. Verifique a clínica ativa.</div>
        : aguardando.length===0
          ? <div className="p-8 text-center text-sm text-muted-foreground">Nenhum paciente aguardando no momento.</div>
          : <div className="divide-y">
            {aguardando.map((item,index)=><article key={item.id} className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2 sm:px-4">
              <span className="shrink-0 text-sm font-black text-primary">#{index+1}</span>
              <div className="min-w-[150px] flex-[1_1_210px]">
                <p className="truncate text-sm font-bold leading-5">{emojiEspecie(item.especie)} {item.animalNome}</p>
                <p className="truncate text-xs leading-4 text-muted-foreground">{item.tutorNome}{codigoTutorItem(item)&&<span className="ml-1 font-mono">{codigoTutorItem(item)}</span>}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2 text-xs tabular-nums text-muted-foreground">
                <span title="Chegada">🕒 {hora(item.chegadaEm)}</span><span title="Tempo de espera">{tempoEspera(item.chegadaEm)}</span>
              </div>
              {item.motivo&&<span title={item.motivo} className="max-w-[140px] truncate text-xs text-muted-foreground">{item.motivo}</span>}
              <span className="shrink-0 rounded-full border border-amber-300 bg-amber-100 px-2 py-1 text-[11px] font-bold !text-amber-950">Aguardando</span>
              <div className="ml-auto flex shrink-0 items-center gap-1.5">
                <button type="button" onClick={()=>void chamar(item.id)} className="inline-flex min-h-9 shrink-0 items-center justify-center gap-1 rounded-md border border-[#155e75] bg-[#155e75] px-3 py-1.5 text-xs font-extrabold !text-white hover:bg-[#164e63] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#155e75]"><Play size={13}/> Chamar</button>
                <button type="button" onClick={()=>void remover(item.id)} aria-label="Remover da fila" title="Remover da fila" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#9f1239] bg-white !text-[#9f1239] hover:bg-[#fff1f2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9f1239]"><X size={15}/></button>
              </div>
            </article>)}
          </div>}
    </section>

    {chamados.length>0&&<section className="mt-5 overflow-hidden rounded-2xl border bg-card shadow-sm"><div className="border-b px-4 py-3 sm:px-5"><h2 className="font-bold">Chamados recentemente</h2></div><div className="divide-y">{chamados.slice(0,20).map((item)=><div key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5"><div><div className="font-semibold">{emojiEspecie(item.especie)} {item.animalNome} <span className="font-normal text-muted-foreground">· {item.tutorNome}{codigoTutorItem(item) && <span className="ml-1 font-mono text-primary">{codigoTutorItem(item)}</span>}</span></div><div className="text-xs text-muted-foreground">Chegou {hora(item.chegadaEm)} · chamado {item.chamadoEm?hora(item.chamadoEm):"agora"}{item.motivo?` · ${item.motivo}`:""}</div></div><div className="flex gap-2"><span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">Chamado</span><button type="button" onClick={()=>voltarParaFila(item.id)} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold"><RotateCcw size={13}/> Voltar à fila</button><Link to="/animal" search={{animalId:item.animalId} as any} className="rounded-lg border px-3 py-1.5 text-xs font-semibold">Abrir ficha</Link></div></div>)}</div></section>}
  </main>;
}