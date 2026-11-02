import { createFileRoute, useLocation } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import type { FormEvent } from "react";
import { toast } from "sonner";
import { usePermissoes } from "@/hooks/usePermissoes";
import { supabaseBanco } from "@/integrations/supabase/client";
import { digitarCentavos, centavosDoCampo } from "@/lib/moeda-centavos";

export const Route = createFileRoute("/banho-tosa")({ component: BanhoTosa });
type Tutor = {id:string;nome:string};
type Animal = {id:string;nome:string;tutor_id:string;especie:string};
type Servico = {id:string;nome:string;duracao_min:number;preco_centavos:number;ativo:boolean};
type Atendimento = {id:string;animal_id:string;tutor_id:string;servico_id:string|null;servico_nome:string;inicio:string;fim:string;status:string;profissional:string;observacoes:string;valor_centavos:number;pago:boolean;avaliacao_entrada:string;restricoes:string;checklist:Record<string,boolean>;entrada_em:string|null;inicio_real_em:string|null;pronto_em:string|null;entregue_em:string|null;observacoes_saida:string};
type Pagamento = {id:string;agendamento_banho_tosa_id:string;valor_centavos:number;forma_pagamento:string;registrado_em:string};
type Extra = {id:string;agendamento_id:string;descricao:string;quantidade:number;valor_unitario_centavos:number};
const etapas = ["agendado","recebido","em_execucao","pronto","entregue"];
const verificacoes = ["Conferência da pele e pelagem","Conferência de olhos e ouvidos","Banho realizado","Secagem concluída","Escovação final","Perfume/acessórios autorizados","Tutor avisado","Conferência antes da entrega"];
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
 const abaDaUrl=(hash:string):Aba=>abas.find(a=>a.id===hash.replace(/^#/, ""))?.id||"painel";
 const [aba,setAba]=useState<Aba>(()=>typeof window!=="undefined"?abaDaUrl(window.location.hash):"painel");
 useEffect(()=>setAba(abaDaUrl(location.hash)),[location.hash]);
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
 const [visaoAgenda,setVisaoAgenda]=useState<"dia"|"semana"|"mes">("semana");
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
 const ativos=atendimentos.filter(a=>!["entregue","cancelado"].includes(a.status));
 const encerrados=atendimentos.filter(a=>["entregue","cancelado"].includes(a.status));
 const detalhe=atendimentos.find(a=>a.id===detalheId);
 async function agendar(e:FormEvent){
  e.preventDefault();if(!clinicaId||!podeOperar||salvando)return;
  const animal=nomesAnimais.get(animalId),servico=selecionado;
  const comeco=new Date(inicio);
  if(!animal||!servico||!Number.isFinite(comeco.getTime()))return toast.error("Selecione animal, serviço e horário.");
  const fim=new Date(comeco.getTime()+servico.duracao_min*60000);
  if(profissional.trim()){
    const conflito=atendimentos.some(a=>a.status!=="cancelado" && a.profissional.trim().toLocaleLowerCase("pt-BR")===profissional.trim().toLocaleLowerCase("pt-BR") && comeco.getTime()<new Date(a.fim).getTime() && fim.getTime()>new Date(a.inicio).getTime());
    if(conflito)return toast.error("Este profissional já possui atendimento nesse horário. Escolha outro horário ou profissional.");
  }
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
   <button type="button" className="mt-2 rounded-lg border px-3 py-2 text-sm font-semibold" onClick={()=>{setDetalheId(a.id);setAvaliacao(a.avaliacao_entrada||"");setRestricoes(a.restricoes||"");setSaida(a.observacoes_saida||"");}}>Abrir ficha completa</button>
   {podeOperar&& !["entregue","cancelado"].includes(a.status)&&<div className="mt-3 flex flex-wrap gap-2">
    {etapas.filter(x=>etapas.indexOf(x)>etapas.indexOf(a.status)).slice(0,1).map(x=><button key={x} className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground" onClick={()=>void mudarStatus(a,x)}>Avançar para {x.replaceAll("_"," ")}</button>)}
    <button className="rounded-lg border px-3 py-2 text-sm" onClick={()=>void mudarStatus(a,"cancelado")}>Cancelar</button>
   </div>}
  </article>
 }
 if(carregandoPermissoes)return <main className="p-6">Carregando permissões…</main>;
 return <main className="mx-auto max-w-7xl space-y-5 p-4 pb-20 sm:p-6">
  <header className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold text-primary">ORICSE · Petshop</p><h1 className="text-3xl font-bold">Banho e tosa</h1><p className="text-muted-foreground">Agendamentos, atendimento, equipe e serviços</p></div><button onClick={()=>void carregar()} className="rounded-xl border px-4 py-2">Atualizar</button></header>
  {detalhe&&<section className={card+" space-y-4"} aria-label="Ficha completa do atendimento">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-xl font-bold">Ficha de atendimento · {nomesAnimais.get(detalhe.animal_id)?.nome||"Animal"}</h2><p className="text-sm text-muted-foreground">{detalhe.servico_nome} · {nomesTutores.get(detalhe.tutor_id)} · {dataLocal(detalhe.inicio)}</p></div><button type="button" onClick={()=>setDetalheId("")} className="rounded-lg border px-3 py-2">Fechar ficha</button></div>
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
        <button disabled={salvando||!pode("caixa.comandas")&&!pode("caixa.financeiro.gerenciar")&&!adminGlobal} className="rounded-xl bg-primary px-4 py-3 text-primary-foreground disabled:opacity-50">Registrar recebimento</button>
      </form>
    </div>
    <label className="block text-sm font-semibold">Observações da entrega<textarea className={campo} value={saida} onChange={e=>setSaida(e.target.value)} placeholder="Orientações ao tutor e observações finais…"/></label>
    <button type="button" disabled={!podeOperar} onClick={()=>void salvarFicha(detalhe,{observacoes_saida:saida})} className="rounded-xl border px-4 py-2">Salvar observações de saída</button>
  </section>}
  {erro&&<div role="alert" className="rounded-xl border border-destructive p-4 text-destructive">{erro}</div>}
  {carregando?<p>Carregando registros…</p>:<>
   {aba==="painel"&&<section className="space-y-4"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[["Agendados hoje",doDia.length],["Em atendimento",ativos.filter(x=>x.status==="em_execucao").length],["Prontos",ativos.filter(x=>x.status==="pronto").length],["Serviços cadastrados",servicos.filter(x=>x.ativo).length]].map(([nome,valor])=><div key={String(nome)} className={card}><p className="text-sm text-muted-foreground">{nome}</p><p className="text-3xl font-bold">{valor}</p></div>)}</div><h2 className="font-bold text-xl">Próximos serviços</h2>{ativos.slice(0,10).map(registro)}</section>}
   {aba==="agenda"&&<section className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <CalendarDays className="h-5 w-5 text-primary"/>
        <button type="button" aria-label="Período anterior" className="rounded-xl border p-2.5 hover:bg-muted" onClick={()=>navegarAgenda(-1)}><ChevronLeft size={18}/></button>
        <input aria-label="Data da agenda" type="date" className="min-h-10 rounded-xl border bg-background px-3" value={data} onChange={e=>e.target.value&&setData(e.target.value)}/>
        <button type="button" aria-label="Próximo período" className="rounded-xl border p-2.5 hover:bg-muted" onClick={()=>navegarAgenda(1)}><ChevronRight size={18}/></button>
        <button type="button" className="rounded-xl border px-3 py-2 text-sm hover:bg-muted" onClick={()=>setData(hoje())}>Hoje</button>
      </div>
      <div className="flex rounded-xl border bg-muted/30 p-1" role="group" aria-label="Visualização da agenda">
        {([["dia","Dia"],["semana","Semana"],["mes","Mês"]] as const).map(([id,nome])=><button key={id} type="button" aria-pressed={visaoAgenda===id} onClick={()=>setVisaoAgenda(id)} className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${visaoAgenda===id?"bg-primary text-primary-foreground shadow-sm":"hover:bg-muted"}`}>{nome}</button>)}
      </div>
      <p className="text-sm text-muted-foreground">{atendimentos.filter(a=>a.status!=="cancelado"&&datasAgenda.includes(a.inicio.slice(0,10))).length} agendamento(s) no período</p>
    </div>
    {visaoAgenda==="dia" ? (doDia.length?doDia.map(registro):<p className={card}>Nenhum agendamento para esta data.</p>) :
      <div className="overflow-x-auto rounded-2xl border bg-card p-3 shadow-sm sm:p-4">
        <div className="grid min-w-[770px] grid-cols-7 gap-2">
          {["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map((nome,i)=><div key={nome} className={`py-2 text-center text-xs font-semibold uppercase tracking-wide ${i===0?"text-rose-600":"text-muted-foreground"}`}>{nome}</div>)}
          {datasAgenda.map(d=>{
            const diaData=new Date(d+"T12:00:00");
            const lista=atendimentos.filter(a=>a.status!=="cancelado"&&a.inicio.slice(0,10)===d).sort((a,b)=>a.inicio.localeCompare(b.inicio));
            const mesAtual=d.slice(0,7)===data.slice(0,7);
            return <button key={d} type="button" onClick={()=>{setData(d);setVisaoAgenda("dia")}} className={`flex min-h-40 flex-col rounded-xl border p-2.5 text-left transition-colors hover:border-primary/50 hover:bg-muted/20 ${d===hoje()?"ring-2 ring-primary/30":""} ${diaData.getDay()===0?"bg-rose-50/30 dark:bg-rose-950/10":"bg-background"} ${visaoAgenda==="mes"&&!mesAtual?"opacity-45":""}`}>
              <div className="w-full border-b border-border/60 pb-2"><span className="text-lg font-semibold">{diaData.getDate()}</span><span className="ml-2 text-[10px] uppercase text-muted-foreground">{["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"][diaData.getDay()]}</span></div>
              <p className="mt-2 text-xs text-muted-foreground">{lista.length?lista.length+" agendamento(s)":"Sem agendamentos"}</p>
              <div className="mt-2 w-full space-y-1.5">{lista.slice(0,3).map(a=><div key={a.id} className="rounded-lg border border-primary/15 bg-primary/5 p-2"><p className="truncate text-xs font-semibold">{nomesAnimais.get(a.animal_id)?.nome||"Animal"}</p><p className="truncate text-[11px] text-muted-foreground">{new Date(a.inicio).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})} · {a.servico_nome}</p></div>)}{lista.length>3&&<span className="text-xs text-muted-foreground">+{lista.length-3} outros</span>}</div>
            </button>;
          })}
        </div>
      </div>}
  </section>}
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
