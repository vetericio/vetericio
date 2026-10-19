import { oricseStorage, oricseSession } from "@/lib/oricse-storage";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Clock3, Play, Plus, RotateCcw, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabaseBanco } from "@/integrations/supabase/client";
import { lerContextoAdminClinica } from "@/lib/admin-clinic-context";
import { codigoPublicoTutor, lerNomeClinicaLocal, migrarCodigosPublicosTutores } from "@/lib/codigo-tutor";

export const Route = createFileRoute("/fila-espera")({ component: FilaEspera });

type Tutor = { id: string; nome: string; telefone?: string; email?: string; cpf?: string; cpfCnpj?: string; codigoPublico?: string; codigo_publico?: string; codigo?: string };
type Animal = { id: string; tutorId: string; nome: string; especie?: string; raca?: string };
type StatusFila = "Aguardando" | "Chamado";
type ItemFila = { id: string; tutorId: string; animalId: string; tutorNome: string; animalNome: string; especie?: string; motivo?: string; chegadaEm: string; status: StatusFila; chamadoEm?: string };

const TUTORES_KEY = "oricse-tutores-v1";
const ANIMAIS_KEY = "oricse-animais-v1";
const FILA_KEY = "oricse-fila-espera-v1";
const COLUNAS_FILA = "72px minmax(240px,1.45fr) 140px 120px minmax(180px,1.1fr) 140px 190px";

function lerLocal<T>(chave: string): T[] { if (typeof window === "undefined") return []; try { const valor = JSON.parse(oricseStorage.getItem(chave) || "[]"); return Array.isArray(valor) ? valor.filter((item): item is T => Boolean(item) && typeof item === "object" && !Array.isArray(item)) : []; } catch { return []; } }
function textoOpcional(valor: unknown) { return typeof valor === "string" ? valor : undefined; }
function lerTutores() { const tutores = migrarCodigosPublicosTutores(lerLocal<Tutor>(TUTORES_KEY).filter((tutor) => typeof tutor.id === "string" && typeof tutor.nome === "string"), lerNomeClinicaLocal()); return tutores.map((tutor) => ({ ...tutor, telefone: textoOpcional(tutor.telefone), email: textoOpcional(tutor.email), cpf: textoOpcional(tutor.cpf || tutor.cpfCnpj), codigoPublico: textoOpcional(tutor.codigoPublico), codigo_publico: textoOpcional(tutor.codigo_publico) })); }
function lerAnimais() { return lerLocal<Animal>(ANIMAIS_KEY).filter((animal) => typeof animal.id === "string" && typeof animal.tutorId === "string" && typeof animal.nome === "string").map((animal) => ({ ...animal, especie: textoOpcional(animal.especie), raca: textoOpcional(animal.raca) })); }
function lerFila() { return lerLocal<ItemFila>(FILA_KEY).filter((item) => typeof item.id === "string" && typeof item.tutorId === "string" && typeof item.animalId === "string" && typeof item.tutorNome === "string" && typeof item.animalNome === "string" && typeof item.chegadaEm === "string" && (item.status === "Aguardando" || item.status === "Chamado")).map((item) => ({ ...item, motivo: textoOpcional(item.motivo), especie: textoOpcional(item.especie), chamadoEm: textoOpcional(item.chamadoEm) })); }
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

    <section className="mt-5 overflow-hidden rounded-2xl border bg-card shadow-sm"><div className="flex items-center justify-between border-b px-5 py-3"><div className="flex items-center gap-2"><Clock3 size={19} className="text-primary"/><h2 className="font-bold">Fila de espera</h2></div><span className="text-sm text-muted-foreground">Ordem de chegada</span></div>
      {erroCarregamento?<div className="px-5 py-10 text-center text-sm text-destructive">Não foi possível consultar a fila. Verifique a clínica ativa.</div>:aguardando.length===0?<div className="px-5 py-10 text-center text-sm text-muted-foreground">Nenhum paciente aguardando no momento.</div>:<><div className="hidden border-b bg-slate-50/70 px-5 py-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground lg:grid" style={{gridTemplateColumns:COLUNAS_FILA,columnGap:"16px"}}><div>Posição</div><div>Paciente / tutor</div><div>Chegada</div><div>Espera</div><div>Motivo</div><div>Status</div><div>Ações</div></div><div className="divide-y">{aguardando.map((item,index)=><div key={item.id} className="grid gap-3 px-4 py-3 lg:items-center lg:px-5"><div className="lg:hidden"><div className="text-[10px] font-bold uppercase text-muted-foreground">Posição</div><div className="text-sm font-black text-primary">#{index+1}</div></div><div className="hidden lg:grid lg:col-span-full" style={{gridTemplateColumns:COLUNAS_FILA,columnGap:"16px"}}><div className="self-center text-sm font-black text-primary">#{index+1}</div><div className="min-w-0 self-center"><div className="truncate text-base font-bold">{emojiEspecie(item.especie)} {item.animalNome}</div><div className="truncate text-xs text-muted-foreground">{item.tutorNome}{codigoTutorItem(item) && <span className="ml-1 font-mono text-primary">{codigoTutorItem(item)}</span>}</div></div><div className="self-center text-sm font-semibold tabular-nums">{hora(item.chegadaEm)}</div><div className="self-center text-sm tabular-nums">{tempoEspera(item.chegadaEm)}</div><div className="min-w-0 self-center truncate text-sm">{item.motivo||"Sem motivo informado"}</div><div className="self-center"><span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">Aguardando</span></div><div className="flex items-center gap-2 self-center"><button type="button" onClick={()=>chamar(item.id)} className="inline-flex min-w-[118px] items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"><Play size={14}/> Chamar</button><button type="button" onClick={()=>remover(item.id)} aria-label="Remover da fila" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border text-muted-foreground hover:text-destructive"><X size={15}/></button></div></div><div className="grid gap-3 lg:hidden sm:grid-cols-2"><div><div className="text-[10px] font-bold uppercase text-muted-foreground">Paciente / tutor</div><div className="font-bold">{emojiEspecie(item.especie)} {item.animalNome}</div><div className="text-xs text-muted-foreground">{item.tutorNome}{codigoTutorItem(item) && <span className="ml-1 font-mono text-primary">{codigoTutorItem(item)}</span>}</div></div><div><div className="text-[10px] font-bold uppercase text-muted-foreground">Chegada</div><div className="text-sm font-semibold">{hora(item.chegadaEm)}</div></div><div><div className="text-[10px] font-bold uppercase text-muted-foreground">Espera</div><div className="text-sm">{tempoEspera(item.chegadaEm)}</div></div><div><div className="text-[10px] font-bold uppercase text-muted-foreground">Motivo</div><div className="text-sm">{item.motivo||"Sem motivo informado"}</div></div><div><div className="text-[10px] font-bold uppercase text-muted-foreground">Status</div><span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">Aguardando</span></div><div className="flex items-end gap-2"><button type="button" onClick={()=>chamar(item.id)} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"><Play size={14}/> Chamar</button><button type="button" onClick={()=>remover(item.id)} aria-label="Remover da fila" className="inline-flex items-center justify-center rounded-lg border px-2.5 py-2 text-muted-foreground hover:text-destructive"><X size={15}/></button></div></div></div>)}</div></>}
    </section>

    {chamados.length>0&&<section className="mt-5 overflow-hidden rounded-2xl border bg-card shadow-sm"><div className="border-b px-4 py-3 sm:px-5"><h2 className="font-bold">Chamados recentemente</h2></div><div className="divide-y">{chamados.slice(0,20).map((item)=><div key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5"><div><div className="font-semibold">{emojiEspecie(item.especie)} {item.animalNome} <span className="font-normal text-muted-foreground">· {item.tutorNome}{codigoTutorItem(item) && <span className="ml-1 font-mono text-primary">{codigoTutorItem(item)}</span>}</span></div><div className="text-xs text-muted-foreground">Chegou {hora(item.chegadaEm)} · chamado {item.chamadoEm?hora(item.chamadoEm):"agora"}{item.motivo?` · ${item.motivo}`:""}</div></div><div className="flex gap-2"><span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">Chamado</span><button type="button" onClick={()=>voltarParaFila(item.id)} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold"><RotateCcw size={13}/> Voltar à fila</button><Link to="/animal" search={{animalId:item.animalId} as any} className="rounded-lg border px-3 py-1.5 text-xs font-semibold">Abrir ficha</Link></div></div>)}</div></section>}
  </main>;
}