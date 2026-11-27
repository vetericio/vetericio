import { useDemoAlvorada } from "@/lib/demo-alvorada-context";
import { AVISO_DEMO_COBRANCA } from "@/lib/demo-alvorada";
import { createFileRoute, useLocation } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { AgendaDayBoard, AgendaErrorBoundary } from "@/components/agenda/AgendaDayBoard";
import { PainelPacotesBanhoTosa, SelecionarPacoteBanho } from "@/components/PacotesBanhoTosa";
import type { FormEvent } from "react";
import { toast } from "sonner";
import { usePermissoes } from "@/hooks/usePermissoes";
import { supabaseBanco } from "@/integrations/supabase/client";
import { digitarCentavos, centavosDoCampo } from "@/lib/moeda-centavos";

export const Route = createFileRoute("/banho-tosa")({ component: BanhoTosa });
type Tutor = {id:string;nome:string};
type Animal = {id:string;nome:string;tutor_id:string;especie:string};
type Servico = {id:string;nome:string;duracao_min:number;preco_centavos:number;ativo:boolean};
type Atendimento = {id:string;animal_id:string;tutor_id:string;servico_id:string|null;servico_nome:string;inicio:string;fim:string;status:string;profissional:string;observacoes:string;valor_centavos:number;pago:boolean;avaliacao_entrada:string;restricoes:string;checklist:Record<string,boolean>;entrada_em:string|null;inicio_real_em:string|null;pronto_em:string|null;entregue_em:string|null;observacoes_saida:string;serie_id?:string|null;serie_excecao?:boolean;pacote_id?:string|null};
type Pagamento = {id:string;agendamento_banho_tosa_id:string;valor_centavos:number;forma_pagamento:string;registrado_em:string};
type Extra = {id:string;agendamento_id:string;descricao:string;quantidade:number;valor_unitario_centavos:number};
const etapas = ["agendado","recebido","em_execucao","pronto","entregue"];
const verificacoes = ["Conferência da pele e pelagem","Conferência de olhos e ouvidos","Banho realizado","Secagem concluída","Escovação final","Perfume/acessórios autorizados","Tutor avisado","Conferência antes da entrega"];
const abas = [{id:"painel",nome:"Painel"},{id:"agenda",nome:"Agenda"},{id:"fila",nome:"Fila de serviços"},{id:"historico",nome:"Histórico"},{id:"pacotes",nome:"Pacotes"}] as const;
type Aba = typeof abas[number]["id"];
const dinheiro=(c:number)=> (c/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const dataLocal=(v:string)=>new Date(v).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"});
const hoje=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`};
const isoLocal=()=>{const d=new Date();return `${hoje()}T${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`};
const card="rounded-2xl border bg-card p-4 shadow-sm";
const campo="mt-1 w-full min-h-11 rounded-xl border bg-background px-3 text-foreground";
function BanhoTosa(){
  const demoAlvorada = useDemoAlvorada();
 const {clinicaId,carregando:carregandoPermissoes,adminGlobal,pode}=usePermissoes();
 const location=useLocation();
 const abaDaUrl=(hash:string):Aba=>hash.replace(/^#/, "")==="novo"?"agenda":abas.find(a=>a.id===hash.replace(/^#/, ""))?.id||"painel";
 const [aba,setAba]=useState<Aba>(()=>typeof window!=="undefined"?abaDaUrl(window.location.hash):"painel");
 const [mostrarNovoAgendamento,setMostrarNovoAgendamento]=useState(() => typeof window !== "undefined" && window.location.hash === "#novo");
 useEffect(()=>{setAba(abaDaUrl(location.hash));if(location.hash==="#novo")setMostrarNovoAgendamento(true);},[location.hash]);
 useEffect(()=>{if(location.hash.replace(/^#/,"")==="novo"){const qs=new URLSearchParams(typeof window!=="undefined"?window.location.search:"");const prof=qs.get("profissional"),hora=qs.get("inicio");if(prof)setProfissional(prof);if(hora&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(hora)){setInicio(hora);setPacoteId("");}}},[location.hash,location.search]);
 const [carregando,setCarregando]=useState(true),[salvando,setSalvando]=useState(false);
 const [erro,setErro]=useState("");
 const [tutores,setTutores]=useState<Tutor[]>([]),[animais,setAnimais]=useState<Animal[]>([]);
 const [servicos,setServicos]=useState<Servico[]>([]),[atendimentos,setAtendimentos]=useState<Atendimento[]>([]);
 const [extras,setExtras]=useState<Extra[]>([]);
 const [pagamentos,setPagamentos]=useState<Pagamento[]>([]);
 const [valorPagamento,setValorPagamento]=useState(""),[formaPagamento,setFormaPagamento]=useState("Pix");
 const [detalheId,setDetalheId]=useState("");
 const [avaliacao,setAvaliacao]=useState(""),[restricoes,setRestricoes]=useState(""),[saida,setSaida]=useState("");
 const [extraNome,setExtraNome]=useState(""),[extraQuantidade,setExtraQuantidade]=useState("1"),[extraPreco,setExtraPreco]=useState("");
 const [data,setData]=useState(hoje);
 const [visaoAgenda,setVisaoAgenda]=useState<"dia"|"semana"|"mes">("dia");
 const [filtroProfissional,setFiltroProfissional]=useState("todos");
 const [animalId,setAnimalId]=useState(""),[servicoId,setServicoId]=useState(""),[inicio,setInicio]=useState(isoLocal),[profissional,setProfissional]=useState(""),[obs,setObs]=useState("");
 const [pacoteId,setPacoteId]=useState("");
 const [vinculoPacote,setVinculoPacote]=useState({agendamentoId:"",pacoteId:""});
 const [repeticoesBanho,setRepeticoesBanho]=useState(1);
 const [frequenciaBanho,setFrequenciaBanho]=useState(7);
 const [edicaoBanho,setEdicaoBanho]=useState<{item:Atendimento;inicio:string;profissional:string;obs:string;serie:boolean}|null>(null);
 const db=supabaseBanco as any;
 const podeOperar=adminGlobal||pode("hotelzinho.operar")||pode("recepcao.agenda");
 const podeVenderPacote=!demoAlvorada&&podeOperar&&(adminGlobal||pode("caixa.comandas")||pode("caixa.financeiro.gerenciar"));
 const nomesAnimais=useMemo(()=>new Map(animais.map(a=>[a.id,a])),[animais]);
 const nomesTutores=useMemo(()=>new Map(tutores.map(t=>[t.id,t.nome])),[tutores]);
 async function carregar(){
  if(!clinicaId)return;
  setCarregando(true);setErro("");
  try{
   const [ts,as,ss,ag,ex,pg]=await Promise.all([
    db.from("tutores").select("id,nome").eq("clinica_id",clinicaId).order("nome"),
    db.from("oricse_animais").select("id,nome,tutor_id,especie").eq("clinica_id",clinicaId).order("nome"),
    db.from("oricse_banho_tosa_servicos").select("*").eq("clinica_id",clinicaId).order("nome"),
    db.from("oricse_banho_tosa_agendamentos").select("*").eq("clinica_id",clinicaId).order("inicio",{ascending:false}).limit(500),
    db.from("oricse_banho_tosa_extras").select("*").eq("clinica_id",clinicaId).limit(1000),
    db.from("oricse_caixa_lancamentos").select("id,agendamento_banho_tosa_id,valor_centavos,forma_pagamento,registrado_em").eq("clinica_id",clinicaId).eq("setor","Banho e tosa").eq("status","pago").limit(1000),
   ]);
   const falha=[ts,as,ss,ag,ex,pg].find(x=>x.error);
   if(falha)throw falha.error;
   setTutores(ts.data||[]);setAnimais(as.data||[]);setServicos(ss.data||[]);setAtendimentos(ag.data||[]);setExtras(ex.data||[]);setPagamentos(pg.data||[]);
  }catch(e){setErro(e instanceof Error?e.message:"Erro ao carregar dados");}
  finally{setCarregando(false);}
 }
 useEffect(()=>{if(!carregandoPermissoes&&clinicaId)void carregar();else if(!carregandoPermissoes){setCarregando(false);setErro("Selecione uma clínica.");}},[clinicaId,carregandoPermissoes]);
 const selecionado=servicos.find(s=>s.id===servicoId);
 const doDia=atendimentos.filter(a=>a.inicio.slice(0,10)===data||new Date(a.inicio).toLocaleDateString("en-CA")===data).sort((a,b)=>a.inicio.localeCompare(b.inicio));
 const datasAgenda=useMemo(()=>{
  const [ano,mes,diaMes]=data.split("-").map(Number);
  const referencia=new Date(ano,mes-1,diaMes);
  if(visaoAgenda==="dia")return [data];
  const inicio=new Date(referencia);
  if(visaoAgenda==="semana")inicio.setDate(inicio.getDate()-inicio.getDay());
  else{inicio.setDate(1);inicio.setDate(inicio.getDate()-inicio.getDay());}
  const fim=new Date(inicio);
  if(visaoAgenda==="semana")fim.setDate(inicio.getDate()+6);
  else{const ultimo=new Date(ano,mes,0);fim.setTime(ultimo.getTime());fim.setDate(fim.getDate()+6-fim.getDay());}
  const quantidade=Math.round((Date.UTC(fim.getFullYear(),fim.getMonth(),fim.getDate())-Date.UTC(inicio.getFullYear(),inicio.getMonth(),inicio.getDate()))/86400000)+1;
  return Array.from({length:quantidade},(_,i)=>{const d=new Date(inicio.getFullYear(),inicio.getMonth(),inicio.getDate()+i);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;});
 },[data,visaoAgenda]);
 function navegarAgenda(delta:number){
  const [ano,mes,diaMes]=data.split("-").map(Number);
  const d=new Date(ano,mes-1,diaMes);
  if(visaoAgenda==="mes"){const proximo=new Date(ano,mes-1+delta,1);const ultimo=new Date(proximo.getFullYear(),proximo.getMonth()+1,0).getDate();proximo.setDate(Math.min(diaMes,ultimo));setData(`${proximo.getFullYear()}-${String(proximo.getMonth()+1).padStart(2,"0")}-${String(proximo.getDate()).padStart(2,"0")}`);}
  else{d.setDate(d.getDate()+delta*(visaoAgenda==="semana"?7:1));setData(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`);}
 }
 const profissionaisAgenda=useMemo(()=>[...new Set(atendimentos.map(a=>a.profissional.trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pt-BR")),[atendimentos]);
 const ativos=atendimentos.filter(a=>!["entregue","cancelado"].includes(a.status));
 const encerrados=atendimentos.filter(a=>["entregue","cancelado"].includes(a.status));
 const detalhe=atendimentos.find(a=>a.id===detalheId);
 const podeEditarHorarioBanho=(a:Atendimento)=>podeOperar&&a.status==="agendado"&&Date.parse(a.inicio)>Date.now()&&!a.pago&&!a.pacote_id&&!pagamentos.some(p=>p.agendamento_banho_tosa_id===a.id);
 function horaGradeBanho(iso:string){
  const data=new Date(iso);
  const d=data.toLocaleDateString("sv-SE",{timeZone:"America/Sao_Paulo"});
  const h=data.toLocaleTimeString("pt-BR",{timeZone:"America/Sao_Paulo",hour:"2-digit",minute:"2-digit",hourCycle:"h23"});
  return d+"T"+h;
 }
 function abrirEdicaoBanho(item:Atendimento){
  setEdicaoBanho({item,inicio:horaGradeBanho(item.inicio),profissional:item.profissional,obs:item.observacoes||"",serie:false});
 }
 async function salvarEdicaoBanho(e:FormEvent){
  e.preventDefault();
  const f=edicaoBanho;
  if(!f||!clinicaId||salvando||!podeEditarHorarioBanho(f.item))return;
  const [data,hora]=f.inicio.split("T");
  setSalvando(true);
  try {
    const {data:total,error}=await db.rpc("oricse_banho_salvar_serie",{
      p_clinica:clinicaId,p_data:data,p_hora:hora,p_profissional:f.profissional,p_obs:f.obs,
      p_editar:f.item.id,p_inicio_anterior:f.item.inicio,p_toda_serie:f.serie,
    });
    if(error)throw error;
    toast.success(f.serie?`${total} horários atualizados na série.`:"Horário atualizado.");
    setEdicaoBanho(null);await carregar();
  } catch(error){toast.error(error&&typeof error==="object"&&"message" in error?String(error.message):"Não foi possível alterar o horário.");}
  finally{setSalvando(false);}
 }
 async function agendar(e:FormEvent){
  e.preventDefault();if(!clinicaId||!podeOperar||salvando)return;
  const animal=nomesAnimais.get(animalId),servico=selecionado;
  const comeco=new Date(inicio);
  if(!animal||!servico||!Number.isFinite(comeco.getTime()))return toast.error("Selecione animal, serviço e horário.");
  if(repeticoesBanho>1){
   const [data,hora]=inicio.split("T");
   setSalvando(true);
   try {
    const {data:total,error}=await db.rpc("oricse_banho_salvar_serie",{
      p_clinica:clinicaId,p_data:data,p_hora:hora,p_profissional:profissional,p_obs:obs,
      p_animal:animal.id,p_servico:servico.id,p_repeticoes:repeticoesBanho,p_passo_dias:frequenciaBanho,
    });
    if(error)throw error;
    setAnimalId("");setServicoId("");setObs("");setRepeticoesBanho(1);setPacoteId("");
    toast.success(`${total} horários da série criados, sem cobrança.`);await carregar();
   }catch(error){toast.error(error&&typeof error==="object"&&"message" in error?String(error.message):"Não foi possível criar a série.");}
   finally{setSalvando(false);}
   return;
  }
  const fim=new Date(comeco.getTime()+servico.duracao_min*60000);
  if(profissional.trim()){
    const conflito=atendimentos.some(a=>a.status!=="cancelado" && a.profissional.trim().toLocaleLowerCase("pt-BR")===profissional.trim().toLocaleLowerCase("pt-BR") && comeco.getTime()<new Date(a.fim).getTime() && fim.getTime()>new Date(a.inicio).getTime());
    if(conflito)return toast.error("Este profissional já possui atendimento nesse horário. Escolha outro horário ou profissional.");
  }
  setSalvando(true);
  const {error}=await db.from("oricse_banho_tosa_agendamentos").insert({clinica_id:clinicaId,animal_id:animal.id,tutor_id:animal.tutor_id,servico_id:servico.id,servico_nome:servico.nome,inicio:comeco.toISOString(),fim:fim.toISOString(),profissional,observacoes:obs,valor_centavos:servico.preco_centavos,...(pacoteId&&!demoAlvorada?{pacote_id:pacoteId}:{})});
  setSalvando(false);if(error)return toast.error(error.message);
  setAnimalId("");setServicoId("");setPacoteId("");setObs("");toast.success("Agendamento criado.");await carregar();
 }
 async function mudarStatus(item:Atendimento,status:string){
  if(!podeOperar)return;
  const {error}=await db.from("oricse_banho_tosa_agendamentos").update({status,atualizado_em:new Date().toISOString(),...(status==="recebido"?{entrada_em:new Date().toISOString()}:{}),...(status==="em_execucao"?{inicio_real_em:new Date().toISOString()}:{}),...(status==="pronto"?{pronto_em:new Date().toISOString()}:{}),...(status==="entregue"?{entregue_em:new Date().toISOString()}:{} )}).eq("id",item.id).eq("clinica_id",clinicaId);
  if(error)return toast.error(error.message);
  toast.success("Status atualizado.");await carregar();
 }
 async function salvarFicha(item:Atendimento,campos:Record<string,unknown>){
  if(!podeOperar||!clinicaId)return;
  const {error}=await db.from("oricse_banho_tosa_agendamentos").update({...campos,atualizado_em:new Date().toISOString()}).eq("clinica_id",clinicaId).eq("id",item.id);
  if(error)return toast.error(error.message);
  toast.success("Ficha atualizada.");await carregar();
 }
 async function adicionarExtra(e:FormEvent){
  e.preventDefault();if(!detalhe||!clinicaId||!podeOperar)return;
  const quantidade=Number(extraQuantidade.replace(",",".")),centavos=centavosDoCampo(extraPreco);
  if(!extraNome.trim()||!Number.isFinite(quantidade)||quantidade<=0)return toast.error("Informe produto ou serviço e quantidade válida.");
  const {error}=await db.from("oricse_banho_tosa_extras").insert({clinica_id:clinicaId,agendamento_id:detalhe.id,descricao:extraNome.trim(),quantidade,valor_unitario_centavos:centavos});
  if(error)return toast.error(error.message);
  setExtraNome("");setExtraPreco("");setExtraQuantidade("1");toast.success("Extra registrado na ficha.");await carregar();
 }
 async function registrarPagamento(e:FormEvent){
  e.preventDefault();
    if (demoAlvorada) return void toast.info(AVISO_DEMO_COBRANCA);
  if(!detalhe||!clinicaId||salvando)return;
  const total=detalhe.valor_centavos+extras.filter(x=>x.agendamento_id===detalhe.id).reduce((n,x)=>n+Math.round(x.quantidade*x.valor_unitario_centavos),0);
  const pago=pagamentos.filter(x=>x.agendamento_banho_tosa_id===detalhe.id).reduce((n,x)=>n+x.valor_centavos,0);
  const valor=centavosDoCampo(valorPagamento);
  if(valor<=0||valor>total-pago)return toast.error("Informe um valor maior que zero e até o saldo em aberto.");
  setSalvando(true);
  const {error}=await db.from("oricse_caixa_lancamentos").insert({clinica_id:clinicaId,setor:"Banho e tosa",origem_tipo:"banho_tosa_pagamento",origem_id:crypto.randomUUID(),agendamento_banho_tosa_id:detalhe.id,tipo:"entrada",status:"pago",descricao:`Banho e tosa · ${detalhe.servico_nome}`,valor_centavos:valor,forma_pagamento:formaPagamento});
  setSalvando(false);
  if(error)return toast.error(error.message);
  setValorPagamento("");toast.success("Pagamento registrado e disponível no Financeiro.");await carregar();
 }
 function registro(a:Atendimento){
  const pet=nomesAnimais.get(a.animal_id);
  const totalExtras=extras.filter(x=>x.agendamento_id===a.id).reduce((t,x)=>t+Math.round(x.quantidade*x.valor_unitario_centavos),0);
  return <article key={a.id} className={card}>
   <div className="flex flex-wrap justify-between gap-2"><div><h3 className="font-semibold">{pet?.nome||"Animal"} · {a.servico_nome}</h3><p className="text-sm text-muted-foreground">{nomesTutores.get(a.tutor_id)||"Tutor"} · {dataLocal(a.inicio)} · {a.profissional||"Sem profissional definido"}</p></div><div className="text-right"><strong>{dinheiro(a.valor_centavos+totalExtras)}</strong><p className="text-sm">{a.status.replaceAll("_"," ")}</p></div></div>
   {a.observacoes&&<p className="mt-2 text-sm">{a.observacoes}</p>}
   {a.serie_id&&<p className="mt-1 text-xs font-semibold text-primary">{a.serie_excecao?"Exceção da série":"Série de horários"}</p>}
   {podeEditarHorarioBanho(a)&&<button type="button" className="mr-2 mt-2 rounded-lg border px-3 py-2 text-sm font-semibold" onClick={()=>abrirEdicaoBanho(a)}>Editar horário</button>}
   {a.pacote_id&&<p className="mt-1 text-sm font-semibold">Serviço coberto por pacote</p>}
   <button type="button" className="mt-2 rounded-lg border px-3 py-2 text-sm font-semibold" onClick={()=>{setVinculoPacote({agendamentoId:a.id,pacoteId:""});setDetalheId(a.id);setAvaliacao(a.avaliacao_entrada||"");setRestricoes(a.restricoes||"");setSaida(a.observacoes_saida||"");}}>Abrir ficha completa</button>
   {podeOperar&& !["entregue","cancelado"].includes(a.status)&&<div className="mt-3 flex flex-wrap gap-2">
    {etapas.filter(x=>etapas.indexOf(x)>etapas.indexOf(a.status)).slice(0,1).map(x=><button key={x} className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground" onClick={()=>void mudarStatus(a,x)}>Avançar para {x.replaceAll("_"," ")}</button>)}
    {(!a.pacote_id||a.status!=="pronto")&&<button className="rounded-lg border px-3 py-2 text-sm" onClick={()=>void mudarStatus(a,"cancelado")}>Cancelar</button>}
   </div>}
  </article>
 }
 if(carregandoPermissoes)return <main className="p-6">Carregando permissões…</main>;
 return <main className="mx-auto max-w-7xl space-y-5 p-4 pb-20 sm:p-6">
  <header className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold text-primary">ORICSE · Petshop</p><h1 className="text-3xl font-bold">Banho e tosa</h1><p className="text-muted-foreground">Agendamentos, atendimento, equipe e serviços</p></div><button onClick={()=>void carregar()} className="rounded-xl border px-4 py-2">Atualizar</button></header>
  {edicaoBanho&&<div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/35 p-4">
   <form role="dialog" aria-modal="true" aria-label="Editar horário de banho e tosa" onSubmit={salvarEdicaoBanho} className="max-h-[90vh] w-full max-w-lg space-y-3 overflow-auto rounded-2xl border bg-card p-5">
    <h2 className="text-xl font-bold">Editar horário de banho e tosa</h2>
    <p className="text-sm text-muted-foreground">{nomesAnimais.get(edicaoBanho.item.animal_id)?.nome||"Animal"} · {edicaoBanho.item.servico_nome}</p>
    {edicaoBanho.item.serie_id&&!edicaoBanho.item.serie_excecao&&<label className="block text-sm font-semibold">Aplicar alterações a
      <select aria-label="Aplicar alterações a" className={campo} value={edicaoBanho.serie?"serie":"um"} onChange={e=>setEdicaoBanho(atual=>{
        if(!atual)return null;
        if(e.target.value!=="serie")return {...atual,serie:false};
        return {...atual,serie:true,inicio:horaGradeBanho(atual.item.inicio).slice(0,10)+atual.inicio.slice(10)};
      })}><option value="um">Apenas este horário</option><option value="serie">Toda a série futura</option></select>
    </label>}
    {edicaoBanho.serie
      ? <label className="block text-sm font-semibold">Hora (Brasília)<input className={campo} required type="time" value={edicaoBanho.inicio.slice(11,16)} onChange={e=>setEdicaoBanho(f=>f?{...f,inicio:f.inicio.slice(0,11)+e.target.value}:null)}/></label>
      : <label className="block text-sm font-semibold">Data e hora (Brasília)<input className={campo} required type="datetime-local" value={edicaoBanho.inicio} onChange={e=>setEdicaoBanho(f=>f?{...f,inicio:e.target.value}:null)}/></label>}
    <label className="block text-sm font-semibold">Profissional<input className={campo} maxLength={160} value={edicaoBanho.profissional} onChange={e=>setEdicaoBanho(f=>f?{...f,profissional:e.target.value}:null)}/></label>
    <label className="block text-sm font-semibold">Observações<textarea className={campo} maxLength={2000} value={edicaoBanho.obs} onChange={e=>setEdicaoBanho(f=>f?{...f,obs:e.target.value}:null)}/></label>
    <p className="text-xs text-muted-foreground">Pagamentos e pacotes não são alterados. Horários vinculados a pacotes ou pagos ficam fora da edição em série.</p>
    <div className="flex justify-end gap-2"><button type="button" onClick={()=>setEdicaoBanho(null)} disabled={salvando} className="rounded-xl border px-4 py-2 text-sm">Fechar</button><button disabled={salvando} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">{edicaoBanho.serie?"Salvar série":"Salvar horário"}</button></div>
   </form>
  </div>}
  {detalhe&&<section className={card+" space-y-4"} aria-label="Ficha completa do atendimento">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-xl font-bold">Ficha de atendimento · {nomesAnimais.get(detalhe.animal_id)?.nome||"Animal"}</h2><p className="text-sm text-muted-foreground">{detalhe.servico_nome} · {nomesTutores.get(detalhe.tutor_id)} · {dataLocal(detalhe.inicio)}</p></div><button type="button" onClick={()=>setDetalheId("")} className="rounded-lg border px-3 py-2">Fechar ficha</button></div>
    {detalhe.pacote_id ? <p className="rounded-xl border p-3 text-sm font-semibold">Serviço coberto por pacote; só os extras podem ter cobrança aqui.</p> :
      !demoAlvorada&&podeOperar&&["agendado","recebido","em_execucao"].includes(detalhe.status)&&detalhe.servico_id&&!pagamentos.some(x=>x.agendamento_banho_tosa_id===detalhe.id)&&
      <div className="space-y-2 rounded-xl border p-3">
        <SelecionarPacoteBanho clinicaId={clinicaId} animalId={detalhe.animal_id} servicoId={detalhe.servico_id} inicio={detalhe.inicio}
          valor={vinculoPacote.agendamentoId===detalhe.id?vinculoPacote.pacoteId:""} onMudar={id=>setVinculoPacote({agendamentoId:detalhe.id,pacoteId:id})} />
        <button type="button" disabled={salvando||vinculoPacote.agendamentoId!==detalhe.id||!vinculoPacote.pacoteId}
          onClick={async()=>{if(salvando||!vinculoPacote.pacoteId)return;setSalvando(true);try{await salvarFicha(detalhe,{pacote_id:vinculoPacote.pacoteId});}finally{setSalvando(false);}}}
          className="rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-50">Reservar sessão deste pacote</button>
      </div>}
    <div className="grid gap-3 sm:grid-cols-2">
     <label className="text-sm font-semibold">Avaliação na entrada<textarea className={campo} rows={3} value={avaliacao} onChange={e=>setAvaliacao(e.target.value)} placeholder="Pele, pelagem, comportamento, feridas, nós, parasitas…"/></label>
     <label className="text-sm font-semibold">Restrições e cuidados especiais<textarea className={campo} rows={3} value={restricoes} onChange={e=>setRestricoes(e.target.value)} placeholder="Sensibilidades, produtos proibidos, sinais de atenção…"/></label>
    </div>
    <button type="button" disabled={!podeOperar} onClick={()=>void salvarFicha(detalhe,{avaliacao_entrada:avaliacao,restricoes})} className="rounded-xl bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50">Salvar avaliação</button>
    <div><h3 className="font-bold">Checklist operacional</h3><p className="mt-1 text-sm text-muted-foreground">Checklist opcional, para registro dos cuidados realizados. Não impede a entrega.</p><div className="mt-2 grid gap-2 sm:grid-cols-2">{verificacoes.map(texto=><label key={texto} className="flex items-center gap-2 rounded-xl border p-3 text-sm"><input type="checkbox" checked={Boolean(detalhe.checklist?.[texto])} disabled={!podeOperar} onChange={e=>void salvarFicha(detalhe,{checklist:{...(detalhe.checklist||{}),[texto]:e.target.checked}})}/>{texto}</label>)}</div></div>
    <div><h3 className="font-bold">Produtos e serviços adicionais</h3>
      <form onSubmit={adicionarExtra} className="mt-2 grid gap-2 sm:grid-cols-4">
       <input aria-label="Produto ou serviço extra" required placeholder="Produto ou serviço" className={campo+" sm:col-span-2"} value={extraNome} onChange={e=>setExtraNome(e.target.value)}/>
       <input aria-label="Quantidade" type="number" step="0.001" min="0.001" required className={campo} value={extraQuantidade} onChange={e=>setExtraQuantidade(e.target.value)}/>
       <input aria-label="Valor em reais" inputMode="numeric" placeholder="0,00" className={campo} value={extraPreco} onChange={e=>setExtraPreco(digitarCentavos(e.target.value))}/>
       <button disabled={!podeOperar} className="rounded-xl border px-3 py-2 sm:col-span-4">+ Adicionar à ficha</button>
      </form>
      <div className="mt-3 space-y-1">{extras.filter(x=>x.agendamento_id===detalhe.id).map(x=><div key={x.id} className="flex justify-between gap-3 rounded-lg bg-secondary/40 p-2 text-sm"><span>{x.quantidade} × {x.descricao}</span><strong>{dinheiro(Math.round(x.quantidade*x.valor_unitario_centavos))}</strong></div>)}</div>
      <p className="mt-2 font-bold">Total do atendimento: {dinheiro(detalhe.valor_centavos+extras.filter(x=>x.agendamento_id===detalhe.id).reduce((t,x)=>t+Math.round(x.quantidade*x.valor_unitario_centavos),0))}</p>
      <p className="text-xs text-muted-foreground">Cobrança prevista; não equivale a pagamento recebido.</p>
      <p className="mt-2 text-sm font-semibold">Recebido: {dinheiro(pagamentos.filter(x=>x.agendamento_banho_tosa_id===detalhe.id).reduce((n,x)=>n+x.valor_centavos,0))}</p>
      <form onSubmit={registrarPagamento} className="mt-2 flex flex-wrap items-end gap-2">
        <label className="text-sm">Pagamento (R$)<input className={campo} inputMode="numeric" placeholder="0,00" value={valorPagamento} onChange={e=>setValorPagamento(digitarCentavos(e.target.value))}/></label>
        <label className="text-sm">Forma<select className={campo} value={formaPagamento} onChange={e=>setFormaPagamento(e.target.value)}>{["Pix","Dinheiro","Débito","Crédito","Transferência"].map(x=><option key={x}>{x}</option>)}</select></label>
        <button disabled={demoAlvorada||salvando||!pode("caixa.comandas")&&!pode("caixa.financeiro.gerenciar")&&!adminGlobal} className="rounded-xl bg-primary px-4 py-3 text-primary-foreground disabled:opacity-50">Registrar recebimento</button>
      </form>
    </div>
    <label className="block text-sm font-semibold">Observações da entrega<textarea className={campo} value={saida} onChange={e=>setSaida(e.target.value)} placeholder="Orientações ao tutor e observações finais…"/></label>
    <button type="button" disabled={!podeOperar} onClick={()=>void salvarFicha(detalhe,{observacoes_saida:saida})} className="rounded-xl border px-4 py-2">Salvar observações de saída</button>
  </section>}
  {erro&&<div role="alert" className="rounded-xl border border-destructive p-4 text-destructive">{erro}</div>}
  {carregando?<p>Carregando registros…</p>:<>
   {aba==="painel"&&<section className="space-y-4"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[["Agendados hoje",doDia.length],["Em atendimento",ativos.filter(x=>x.status==="em_execucao").length],["Prontos",ativos.filter(x=>x.status==="pronto").length],["Serviços cadastrados",servicos.filter(x=>x.ativo).length]].map(([nome,valor])=><div key={String(nome)} className={card}><p className="text-sm text-muted-foreground">{nome}</p><p className="text-3xl font-bold">{valor}</p></div>)}</div><h2 className="font-bold text-xl">Próximos serviços</h2>{ativos.slice(0,10).map(registro)}</section>}
   {aba==="agenda"&&<section className="space-y-4"><div className="flex justify-end"><button type="button" onClick={()=>setMostrarNovoAgendamento(v=>!v)} className="rounded-xl bg-primary px-4 py-2.5 font-semibold text-primary-foreground">{mostrarNovoAgendamento?"Fechar novo agendamento":"+ Novo agendamento"}</button></div><AgendaErrorBoundary><AgendaDayBoard mode="banho"/></AgendaErrorBoundary></section>}
   {aba==="agenda" && mostrarNovoAgendamento &&<form onSubmit={agendar} className={card+" grid gap-4 sm:grid-cols-2"}>
    <label>Animal<select required className={campo} value={animalId} onChange={e=>{setAnimalId(e.target.value);setPacoteId("");}}><option value="">Selecione</option>{animais.map(a=><option key={a.id} value={a.id}>{a.nome} — {nomesTutores.get(a.tutor_id)||"Tutor"}</option>)}</select></label>
    <label>Serviço<select required className={campo} value={servicoId} onChange={e=>{setServicoId(e.target.value);setPacoteId("");}}><option value="">Selecione</option>{servicos.filter(x=>x.ativo).map(x=><option key={x.id} value={x.id}>{x.nome} · {dinheiro(x.preco_centavos)}</option>)}</select></label>
    <label>Data e horário<input required type="datetime-local" className={campo} value={inicio} onChange={e=>{setInicio(e.target.value);setPacoteId("");}}/></label>
    <label>Profissional<input className={campo} value={profissional} onChange={e=>setProfissional(e.target.value)}/></label>
    <div className="sm:col-span-2 rounded-xl border p-3">
      <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={repeticoesBanho>1} onChange={e=>{setRepeticoesBanho(e.target.checked?4:1);setPacoteId("");}}/> Repetir serviço</label>
      {repeticoesBanho>1&&<div className="mt-2 grid gap-2 sm:grid-cols-2">
        <label>Frequência<select aria-label="Frequência" className={campo} value={frequenciaBanho} onChange={e=>setFrequenciaBanho(Number(e.target.value))}><option value={7}>Toda semana</option><option value={14}>A cada 2 semanas</option><option value={28}>A cada 4 semanas</option></select></label>
        <label>Total de ocorrências<input className={campo} type="number" min={2} max={24} value={repeticoesBanho} onChange={e=>setRepeticoesBanho(Math.max(2,Number(e.target.value)))}/></label>
        <p className="text-xs text-muted-foreground sm:col-span-2">Usa a hora de Brasília. Inclui o primeiro horário; não gera cobranças nem consome sessões de pacote.</p>
      </div>}
    </div>
    <label className="sm:col-span-2">Observações<textarea className={campo} value={obs} onChange={e=>setObs(e.target.value)}/></label>
    {!demoAlvorada&&podeOperar&&repeticoesBanho===1&&<div className="sm:col-span-2">
      <SelecionarPacoteBanho key={clinicaId} clinicaId={clinicaId} animalId={animalId} servicoId={servicoId} inicio={inicio} valor={pacoteId} onMudar={setPacoteId}/>
    </div>}
    <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-3"><strong>{pacoteId?"Serviço coberto por pacote":selecionado?`${selecionado.duracao_min} min · ${dinheiro(selecionado.preco_centavos)}`:"Selecione um serviço"}</strong><button disabled={!podeOperar||salvando} className="rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-50">Agendar serviço</button></div>
   </form>}
   {aba==="fila"&&<section className="space-y-3">{ativos.length?ativos.map(registro):<p className={card}>Nenhum atendimento ativo.</p>}</section>}
   {aba==="pacotes"&&clinicaId&&!demoAlvorada&&<PainelPacotesBanhoTosa clinicaId={clinicaId} podeVender={podeVenderPacote} animais={animais} tutores={tutores} servicos={servicos}/>}
   {aba==="historico"&&<section className="space-y-3">{encerrados.length?encerrados.map(registro):<p className={card}>Ainda não há atendimentos concluídos.</p>}</section>}
  </>}
 </main>;
}
