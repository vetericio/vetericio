import { createFileRoute, useLocation } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";
import { usePermissoes } from "@/hooks/usePermissoes";
import { supabaseBanco } from "@/integrations/supabase/client";
import { digitarCentavos, centavosDoCampo } from "@/lib/moeda-centavos";

export const Route = createFileRoute("/banho-tosa")({ component: BanhoTosa });
type Tutor = {id:string;nome:string};
type Animal = {id:string;nome:string;tutor_id:string;especie:string};
type Servico = {id:string;nome:string;duracao_min:number;preco_centavos:number;ativo:boolean};
type Atendimento = {id:string;animal_id:string;tutor_id:string;servico_id:string|null;servico_nome:string;inicio:string;fim:string;status:string;profissional:string;observacoes:string;valor_centavos:number;pago:boolean};
const etapas = ["agendado","recebido","em_execucao","pronto","entregue"];
const abas = [{id:"painel",nome:"Painel"},{id:"agenda",nome:"Agenda"},{id:"novo",nome:"Novo agendamento"},{id:"fila",nome:"Fila de serviços"},{id:"servicos",nome:"Serviços e preços"},{id:"historico",nome:"Histórico"}] as const;
type Aba = typeof abas[number]["id"];
const dinheiro=(c:number)=> (c/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const dataLocal=(v:string)=>new Date(v).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"});
const hoje=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`};
const isoLocal=()=>{const d=new Date();return `${hoje()}T${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`};
const card="rounded-2xl border bg-card p-4 shadow-sm";
const campo="mt-1 w-full min-h-11 rounded-xl border bg-background px-3 text-foreground";
function BanhoTosa(){
 const {clinicaId,carregando:carregandoPermissoes,adminGlobal,pode}=usePermissoes();
 const location=useLocation();
 const abaDaUrl=(hash:string):Aba=>abas.find(a=>a.id===hash.slice(1))?.id||"painel";
 const [aba,setAba]=useState<Aba>(()=>typeof window!=="undefined"?abaDaUrl(window.location.hash):"painel");
 useEffect(()=>setAba(abaDaUrl(location.hash)),[location.hash]);
 const [carregando,setCarregando]=useState(true),[salvando,setSalvando]=useState(false);
 const [erro,setErro]=useState("");
 const [tutores,setTutores]=useState<Tutor[]>([]),[animais,setAnimais]=useState<Animal[]>([]);
 const [servicos,setServicos]=useState<Servico[]>([]),[atendimentos,setAtendimentos]=useState<Atendimento[]>([]);
 const [data,setData]=useState(hoje);
 const [animalId,setAnimalId]=useState(""),[servicoId,setServicoId]=useState(""),[inicio,setInicio]=useState(isoLocal),[profissional,setProfissional]=useState(""),[obs,setObs]=useState("");
 const [nomeServico,setNomeServico]=useState(""),[duracao,setDuracao]=useState("60"),[preco,setPreco]=useState("");
 const db=supabaseBanco as any;
 const podeOperar=adminGlobal||pode("hotelzinho.operar")||pode("recepcao.agenda");
 const nomesAnimais=useMemo(()=>new Map(animais.map(a=>[a.id,a])),[animais]);
 const nomesTutores=useMemo(()=>new Map(tutores.map(t=>[t.id,t.nome])),[tutores]);
 async function carregar(){
  if(!clinicaId)return;
  setCarregando(true);setErro("");
  try{
   const [ts,as,ss,ag]=await Promise.all([
    db.from("tutores").select("id,nome").eq("clinica_id",clinicaId).order("nome"),
    db.from("oricse_animais").select("id,nome,tutor_id,especie").eq("clinica_id",clinicaId).order("nome"),
    db.from("oricse_banho_tosa_servicos").select("*").eq("clinica_id",clinicaId).order("nome"),
    db.from("oricse_banho_tosa_agendamentos").select("*").eq("clinica_id",clinicaId).order("inicio",{ascending:false}).limit(500),
   ]);
   const falha=[ts,as,ss,ag].find(x=>x.error);
   if(falha)throw falha.error;
   setTutores(ts.data||[]);setAnimais(as.data||[]);setServicos(ss.data||[]);setAtendimentos(ag.data||[]);
  }catch(e){setErro(e instanceof Error?e.message:"Erro ao carregar dados");}
  finally{setCarregando(false);}
 }
 useEffect(()=>{if(!carregandoPermissoes&&clinicaId)void carregar();else if(!carregandoPermissoes){setCarregando(false);setErro("Selecione uma clínica.");}},[clinicaId,carregandoPermissoes]);
 const selecionado=servicos.find(s=>s.id===servicoId);
 const doDia=atendimentos.filter(a=>a.inicio.slice(0,10)===data||new Date(a.inicio).toLocaleDateString("en-CA")===data).sort((a,b)=>a.inicio.localeCompare(b.inicio));
 const ativos=atendimentos.filter(a=>!["entregue","cancelado"].includes(a.status));
 const encerrados=atendimentos.filter(a=>["entregue","cancelado"].includes(a.status));
 async function agendar(e:FormEvent){
  e.preventDefault();if(!clinicaId||!podeOperar||salvando)return;
  const animal=nomesAnimais.get(animalId),servico=selecionado;
  const comeco=new Date(inicio);
  if(!animal||!servico||!Number.isFinite(comeco.getTime()))return toast.error("Selecione animal, serviço e horário.");
  const fim=new Date(comeco.getTime()+servico.duracao_min*60000);
  setSalvando(true);
  const {error}=await db.from("oricse_banho_tosa_agendamentos").insert({clinica_id:clinicaId,animal_id:animal.id,tutor_id:animal.tutor_id,servico_id:servico.id,servico_nome:servico.nome,inicio:comeco.toISOString(),fim:fim.toISOString(),profissional,observacoes:obs,valor_centavos:servico.preco_centavos});
  setSalvando(false);if(error)return toast.error(error.message);
  setAnimalId("");setServicoId("");setObs("");toast.success("Agendamento criado.");await carregar();
 }
 async function cadastrarServico(e:FormEvent){
  e.preventDefault();if(!clinicaId||!podeOperar||salvando)return;
  const minutos=Number(duracao),valor=centavosDoCampo(preco);
  if(!nomeServico.trim()||!Number.isInteger(minutos)||minutos<10||minutos>480)return toast.error("Informe nome e duração válida (10 a 480 min).");
  setSalvando(true);
  const {error}=await db.from("oricse_banho_tosa_servicos").insert({clinica_id:clinicaId,nome:nomeServico.trim(),duracao_min:minutos,preco_centavos:valor});
  setSalvando(false);if(error)return toast.error(error.message);
  setNomeServico("");setPreco("");toast.success("Serviço cadastrado.");await carregar();
 }
 async function mudarStatus(item:Atendimento,status:string){
  if(!podeOperar)return;
  const {error}=await db.from("oricse_banho_tosa_agendamentos").update({status,atualizado_em:new Date().toISOString()}).eq("id",item.id).eq("clinica_id",clinicaId);
  if(error)return toast.error(error.message);
  toast.success("Status atualizado.");await carregar();
 }
 function registro(a:Atendimento){
  const pet=nomesAnimais.get(a.animal_id);
  return <article key={a.id} className={card}>
   <div className="flex flex-wrap justify-between gap-2"><div><h3 className="font-semibold">{pet?.nome||"Animal"} · {a.servico_nome}</h3><p className="text-sm text-muted-foreground">{nomesTutores.get(a.tutor_id)||"Tutor"} · {dataLocal(a.inicio)} · {a.profissional||"Sem profissional definido"}</p></div><div className="text-right"><strong>{dinheiro(a.valor_centavos)}</strong><p className="text-sm">{a.status.replaceAll("_"," ")}</p></div></div>
   {a.observacoes&&<p className="mt-2 text-sm">{a.observacoes}</p>}
   {podeOperar&& !["entregue","cancelado"].includes(a.status)&&<div className="mt-3 flex flex-wrap gap-2">
    {etapas.filter(x=>etapas.indexOf(x)>etapas.indexOf(a.status)).slice(0,1).map(x=><button key={x} className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground" onClick={()=>void mudarStatus(a,x)}>Avançar para {x.replaceAll("_"," ")}</button>)}
    <button className="rounded-lg border px-3 py-2 text-sm" onClick={()=>void mudarStatus(a,"cancelado")}>Cancelar</button>
   </div>}
  </article>
 }
 if(carregandoPermissoes)return <main className="p-6">Carregando permissões…</main>;
 return <main className="mx-auto max-w-7xl space-y-5 p-4 pb-20 sm:p-6">
  <header className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold text-primary">ORICSE · Petshop</p><h1 className="text-3xl font-bold">Banho e tosa</h1><p className="text-muted-foreground">Agendamentos, atendimento, equipe e serviços</p></div><button onClick={()=>void carregar()} className="rounded-xl border px-4 py-2">Atualizar</button></header>
  {erro&&<div role="alert" className="rounded-xl border border-destructive p-4 text-destructive">{erro}</div>}
  {carregando?<p>Carregando registros…</p>:<>
   {aba==="painel"&&<section className="space-y-4"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[["Agendados hoje",doDia.length],["Em atendimento",ativos.filter(x=>x.status==="em_execucao").length],["Prontos",ativos.filter(x=>x.status==="pronto").length],["Serviços cadastrados",servicos.filter(x=>x.ativo).length]].map(([nome,valor])=><div key={String(nome)} className={card}><p className="text-sm text-muted-foreground">{nome}</p><p className="text-3xl font-bold">{valor}</p></div>)}</div><h2 className="font-bold text-xl">Próximos serviços</h2>{ativos.slice(0,10).map(registro)}</section>}
   {aba==="agenda"&&<section className="space-y-3"><label className="block font-medium">Data<input type="date" className={campo} value={data} onChange={e=>setData(e.target.value)}/></label>{doDia.length?doDia.map(registro):<p className={card}>Nenhum agendamento para esta data.</p>}</section>}
   {aba==="novo"&&<form onSubmit={agendar} className={card+" grid gap-4 sm:grid-cols-2"}>
    <label>Animal<select required className={campo} value={animalId} onChange={e=>setAnimalId(e.target.value)}><option value="">Selecione</option>{animais.map(a=><option key={a.id} value={a.id}>{a.nome} — {nomesTutores.get(a.tutor_id)||"Tutor"}</option>)}</select></label>
    <label>Serviço<select required className={campo} value={servicoId} onChange={e=>setServicoId(e.target.value)}><option value="">Selecione</option>{servicos.filter(x=>x.ativo).map(x=><option key={x.id} value={x.id}>{x.nome} · {dinheiro(x.preco_centavos)}</option>)}</select></label>
    <label>Data e horário<input required type="datetime-local" className={campo} value={inicio} onChange={e=>setInicio(e.target.value)}/></label>
    <label>Profissional<input className={campo} value={profissional} onChange={e=>setProfissional(e.target.value)}/></label>
    <label className="sm:col-span-2">Observações<textarea className={campo} value={obs} onChange={e=>setObs(e.target.value)}/></label>
    <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-3"><strong>{selecionado?`${selecionado.duracao_min} min · ${dinheiro(selecionado.preco_centavos)}`:"Selecione um serviço"}</strong><button disabled={!podeOperar||salvando} className="rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-50">Agendar serviço</button></div>
   </form>}
   {aba==="fila"&&<section className="space-y-3">{ativos.length?ativos.map(registro):<p className={card}>Nenhum atendimento ativo.</p>}</section>}
   {aba==="servicos"&&<section className="space-y-4"><form onSubmit={cadastrarServico} className={card+" grid gap-3 sm:grid-cols-4"}><label className="sm:col-span-2">Nome do serviço<input required className={campo} value={nomeServico} onChange={e=>setNomeServico(e.target.value)} placeholder="Banho, tosa higiênica…"/></label><label>Duração (min)<input required type="number" min="10" max="480" className={campo} value={duracao} onChange={e=>setDuracao(e.target.value)}/></label><label>Preço (R$)<input inputMode="numeric" className={campo} value={preco} onChange={e=>setPreco(digitarCentavos(e.target.value))} placeholder="0,00"/></label><button disabled={!podeOperar||salvando} className="rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground sm:col-span-4 disabled:opacity-50">Cadastrar serviço</button></form><div className="grid gap-2 sm:grid-cols-2">{servicos.map(x=><div key={x.id} className={card}><strong>{x.nome}</strong><p className="text-sm text-muted-foreground">{x.duracao_min} minutos · {dinheiro(x.preco_centavos)} · {x.ativo?"Ativo":"Inativo"}</p></div>)}</div></section>}
   {aba==="historico"&&<section className="space-y-3">{encerrados.length?encerrados.map(registro):<p className={card}>Ainda não há atendimentos concluídos.</p>}</section>}
  </>}
 </main>;
}
