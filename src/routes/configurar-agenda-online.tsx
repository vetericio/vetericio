import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarCheck, CheckCircle2, Clock3, RefreshCw, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase, supabaseBanco } from "@/integrations/supabase/client";
import { consultarPoliticasAgendaClinica } from "@/lib/politicas-operacionais.functions";
import { cancelarAgendamentoPolitica } from "@/lib/agenda-politicas.functions";

export const Route = createFileRoute("/configurar-agenda-online")({ component: ConfigurarAgendaOnline });
type Agenda={id:string;nome:string;responsavel:string;inicio:string;fim:string;dias_semana:number[];intervalo_min:number;portal_ativo:boolean;modalidade:"livre"|"aprovacao"|"pagamento";antecedencia_horas:number;tipo:string;timezone:string;portal_regra_dias?:"semanal"|"pares"|"datas";portal_datas_horarios?:Record<string,string[]>};
type Agendamento={id:string;agenda_id:string;animal_referencia:string;inicio:string;fim:string;estado:string;tipo:string;observacoes:string|null;origem:string;criado_em:string};
const dias=[["Dom",0],["Seg",1],["Ter",2],["Qua",3],["Qui",4],["Sex",5],["Sáb",6]] as const;
function textoDatas(mapa:Record<string,string[]>|undefined){return Object.entries(mapa||{}).sort(([a],[b])=>a.localeCompare(b)).map(([d,horas])=>d+": "+horas.join(", ")).join("\n");}
function parseDatas(texto:string){const saida:Record<string,string[]>={};for(const linha of texto.split(/\r?\n/)){if(!linha.trim())continue;const match=linha.trim().match(/^(\d{4}-\d{2}-\d{2})\s*:\s*(.+)$/);if(!match)throw new Error("Use AAAA-MM-DD: 10:00, 11:00 em cada linha.");const [,data,lista]=match;if(new Date(data+"T12:00:00").toISOString().slice(0,10)!==data)throw new Error("Data inválida: "+data);const horas=lista.split(",").map(h=>h.trim());if(!horas.length||horas.some(h=>!/^([01]\d|2[0-3]):[0-5]\d$/.test(h)))throw new Error("Horário inválido na data "+data);saida[data]=[...new Set(horas)].sort();}return saida;}
function hora(v:string){return v?.slice(0,5)||"";}
function dataHora(v:string){return new Date(v).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"});}

function ConfigurarAgendaOnline(){
 const [politica,setPolitica]=useState<Awaited<ReturnType<typeof consultarPoliticasAgendaClinica>>|null>(null);
 const [erroPolitica,setErroPolitica]=useState("");
 const [datasEditadas,setDatasEditadas]=useState<Record<string,string>>({});const [clinica,setClinica]=useState<string|null>(null);const[limiteAgendas,setLimiteAgendas]=useState<number|null>(null);const[agendas,setAgendas]=useState<Agenda[]>([]);const[agendamentos,setAgendamentos]=useState<Agendamento[]>([]);const[carregando,setCarregando]=useState(true);const[salvando,setSalvando]=useState<string|null>(null);const[alterandoEstado,setAlterandoEstado]=useState<string|null>(null);
 const carregar=useCallback(async()=>{
  setCarregando(true);
  const{data:{user}}=await supabase.auth.getUser();if(!user){setCarregando(false);return;}
  const {data:cidSelecionada,error:erroSelecao}=await(supabase as any).rpc("oricse_clinica_ativa_obter");
  if(erroSelecao||!cidSelecionada){toast.error("Selecione uma clínica ativa.");setCarregando(false);return;}
  const{data:vinculo,error}=await(supabase as any).from("clinica_usuarios")
    .select("clinica_id").eq("user_id",user.id).eq("clinica_id",cidSelecionada).eq("ativo",true).maybeSingle();
  if(error||!vinculo?.clinica_id){toast.error("Clínica não identificada.");setCarregando(false);return;}
  setClinica(vinculo.clinica_id);
  try {
    const { data: sessao } = await supabase.auth.getSession();
    if (!sessao.session?.access_token) throw new Error("Sessão expirada.");
    const resultado = await consultarPoliticasAgendaClinica({data:{
      accessToken:sessao.session.access_token,clinicaId:vinculo.clinica_id,
    }});
    setPolitica(resultado);
    setErroPolitica("");
  } catch (e) {
    setPolitica(null);
    setErroPolitica(e instanceof Error ? e.message : "Não foi possível ler a política da clínica.");
  }
  const[a,m,c]=await Promise.all([
   (supabaseBanco as any).from("oricse_agendas_online").select("id,nome,responsavel,inicio,fim,dias_semana,intervalo_min,portal_ativo,modalidade,antecedencia_horas,tipo,timezone,portal_regra_dias,portal_datas_horarios").eq("clinica_id",vinculo.clinica_id).order("nome"),
   (supabaseBanco as any).from("oricse_agendamentos_online").select("id,agenda_id,animal_referencia,inicio,fim,estado,tipo,observacoes,origem,criado_em").eq("clinica_id",vinculo.clinica_id).order("inicio",{ascending:true}),
   (supabaseBanco as any).from("clinicas").select("limite_usuarios").eq("id",vinculo.clinica_id).maybeSingle(),
  ]);
  if(a.error)toast.error("Não foi possível carregar as agendas.");else {setAgendas(a.data||[]);setDatasEditadas(Object.fromEntries((a.data||[]).map((x:Agenda)=>[x.id,textoDatas(x.portal_datas_horarios)])));}
  if(m.error)toast.error("Não foi possível carregar os agendamentos.");else setAgendamentos(m.data||[]);
  setLimiteAgendas(c.error||c.data?.limite_usuarios==null?null:Math.max(0,Number(c.data.limite_usuarios)||0));
  setCarregando(false);
 },[]);
 useEffect(()=>{void carregar();},[carregar]);
 const alterar=(id:string,patch:Partial<Agenda>)=>setAgendas(prev=>prev.map(a=>a.id===id?{...a,...patch}:a));
 async function adicionar(){if(!clinica)return;if(limiteAgendas===null||agendas.length>=limiteAgendas)return void toast.error("Limite de agendas atingido. Solicite mais em atendimento@oricse.com.br ou com seu consultor.");const{data,error}=await(supabaseBanco as any).from("oricse_agendas_online").insert({clinica_id:clinica,nome:"Nova agenda",portal_ativo:false,portal_regra_dias:"semanal",portal_datas_horarios:{},timezone:"America/Sao_Paulo",tipo:"Consulta"}).select("id,nome,responsavel,inicio,fim,dias_semana,intervalo_min,portal_ativo,modalidade,antecedencia_horas,tipo,timezone,portal_regra_dias,portal_datas_horarios").single();if(error)return toast.error(error.message);setAgendas(a=>[...a,data]);toast.success("Agenda criada.");}
 async function salvar(a:Agenda){if(!clinica)return;let datas:Record<string,string[]>={};try{datas=parseDatas(datasEditadas[a.id]||"");if(a.portal_regra_dias==="datas"&&!Object.keys(datas).length)throw new Error("Informe ao menos uma data e seus horários.");}catch(e){toast.error(e instanceof Error?e.message:"Datas inválidas.");return;}setSalvando(a.id);const{error}=await(supabaseBanco as any).from("oricse_agendas_online").update({nome:a.nome,responsavel:a.responsavel,inicio:a.inicio,fim:a.fim,dias_semana:a.dias_semana,intervalo_min:a.intervalo_min,portal_ativo:a.portal_ativo,modalidade:a.modalidade,antecedencia_horas:a.antecedencia_horas,tipo:a.tipo,timezone:a.timezone,portal_regra_dias:a.portal_regra_dias||"semanal",portal_datas_horarios:datas}).eq("id",a.id).eq("clinica_id",clinica);setSalvando(null);if(error)return toast.error(error.message);toast.success("Agenda salva.");}
 async function mudarEstado(id:string,novo:"confirmado"|"cancelado"){
  if(!clinica)return;
  if(novo==="cancelado"){
    if(!politica)return toast.error("Política indisponível. Atualize a agenda antes de cancelar.");
    const motivo=window.prompt("Motivo do cancelamento (mínimo de 8 caracteres):");
    if(motivo===null)return;
    if(motivo.trim().length<8)return toast.error("Informe o motivo do cancelamento.");
    if(!window.confirm("Confirmar cancelamento deste agendamento?"))return;
    setAlterandoEstado(id);
    try{
      const {data:sessao}=await supabase.auth.getSession();
      if(!sessao.session?.access_token)throw new Error("Sessão expirada.");
      const resposta=await cancelarAgendamentoPolitica({data:{
        accessToken:sessao.session.access_token,clinicaId:clinica,agendamentoId:id,motivo:motivo.trim()
      }});
      if(!resposta.ok)throw new Error("Cancelamento não confirmado.");
      setAgendamentos(lista=>lista.map(a=>a.id===id?{...a,estado:"cancelado"}:a));
      toast.success(resposta.aprovacaoGerencial?"Cancelamento excepcional registrado.":"Agendamento cancelado.");
    }catch(e){toast.error(e instanceof Error?e.message:"Não foi possível cancelar.");}
    finally{setAlterandoEstado(null);}
    return;
  }
  setAlterandoEstado(id);
  const{data,error}=await(supabaseBanco as any).from("oricse_agendamentos_online")
    .update({estado:novo}).eq("id",id).eq("clinica_id",clinica).eq("estado","solicitado")
    .select("id").maybeSingle();
  setAlterandoEstado(null);
  if(error||!data)return toast.error(error?.message||"Solicitação já alterada. Atualize a agenda.");
  setAgendamentos(lista=>lista.map(a=>a.id===id?{...a,estado:novo}:a));
  toast.success("Agendamento confirmado.");
 }
 async function copiarConfirmacao(item:Agendamento){
   const template = politica?.comunicacao.confirmacaoConsulta;
   if (!template) return toast.error("Modelo de confirmação não disponível.");
   const inicio = new Date(item.inicio);
   const mensagem = template
     .replaceAll("{{tutor}}","[nome do tutor]")
     .replaceAll("{{paciente}}",item.animal_referencia||"[nome do animal]")
     .replaceAll("{{data}}",inicio.toLocaleDateString("pt-BR"))
     .replaceAll("{{hora}}",inicio.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}));
   try { await navigator.clipboard.writeText(mensagem); toast.success("Mensagem copiada. Confira e envie pelo canal autorizado."); }
   catch { toast.error("Não foi possível copiar a mensagem."); }
 }
 const pendentes=agendamentos.filter(a=>a.estado==="solicitado");const proximos=agendamentos.filter(a=>["confirmado","reservado"].includes(a.estado)&&new Date(a.fim)>=new Date());
 return <main className="mx-auto max-w-5xl space-y-6 p-5"><div><Link to="/recepcao" className="text-sm font-semibold text-muted-foreground">← Voltar à Recepção</Link><div className="mt-4 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-3xl font-black">Agenda online do tutor</h1><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Esta é a agenda publicada no Portal do Tutor. Horários livres são calculados no banco e reservas concorrentes são bloqueadas automaticamente.</p></div><button onClick={()=>void carregar()} className="inline-flex items-center gap-2 rounded-xl border bg-card px-3 py-2 text-sm font-bold"><RefreshCw size={15}/> Atualizar</button></div></div>
 {carregando?<p>Carregando…</p>:!clinica?<p>Entre com uma conta vinculada a uma clínica.</p>:<>
  {erroPolitica && <p role="alert" className="rounded-xl border border-amber-300 p-3 text-sm text-amber-800">As políticas da clínica não puderam ser consultadas: {erroPolitica}. Confira com a administração antes de alterar agendamentos.</p>}
  {politica && <section className="rounded-xl border bg-card p-4">
    <h2 className="text-sm font-semibold">Políticas da clínica</h2>
    <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
      <span>Tolerância: {politica.agenda.toleranciaMinutos} min</span>
      <span>Cancelamento: {politica.agenda.cancelamentoHoras} h de antecedência</span>
      <span>Reagendamento: {politica.agenda.reagendamentoHoras} h</span>
      <span>Sinal: {politica.agenda.exigirSinal ? politica.agenda.percentualSinal+"%" : "não exigido"}</span>
    </div>
    <p className="mt-2 text-xs text-muted-foreground">Esta política é exibida à equipe para conferência. Alterações de estado continuam sujeitas às regras e permissões do agendamento.</p>
  </section>}
  <section className="rounded-2xl border bg-card p-5"><div className="flex items-center gap-2"><CalendarCheck/><h2 className="text-xl font-black">Solicitações e próximos horários</h2></div><p className="mt-1 text-sm text-muted-foreground">Agendas em “Mediante aprovação” entram aqui como solicitação. Agendas livres já chegam confirmadas.</p>
   <div className="mt-4 grid gap-4 lg:grid-cols-2"><div><h3 className="text-sm font-black uppercase tracking-wide text-muted-foreground">Aguardando aprovação · {pendentes.length}</h3><div className="mt-2 space-y-2">{pendentes.length?pendentes.map(a=><AgendamentoCard key={a.id} item={a} agenda={agendas.find(x=>x.id===a.agenda_id)} alterando={alterandoEstado===a.id} onConfirmar={()=>void mudarEstado(a.id,"confirmado")} onCancelar={()=>void mudarEstado(a.id,"cancelado")} onCopiarMensagem={politica?()=>void copiarConfirmacao(a):undefined}/>):<p className="rounded-xl bg-secondary/40 p-4 text-sm text-muted-foreground">Nenhuma solicitação pendente.</p>}</div></div><div><h3 className="text-sm font-black uppercase tracking-wide text-muted-foreground">Próximos confirmados · {proximos.length}</h3><div className="mt-2 space-y-2">{proximos.slice(0,12).map(a=><AgendamentoCard key={a.id} item={a} agenda={agendas.find(x=>x.id===a.agenda_id)} alterando={alterandoEstado===a.id} onCancelar={()=>void mudarEstado(a.id,"cancelado")}/>)||null}{!proximos.length&&<p className="rounded-xl bg-secondary/40 p-4 text-sm text-muted-foreground">Nenhum agendamento futuro.</p>}</div></div></div>
  </section>
  <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-xl font-black">Disponibilidade publicada</h2><p className="text-xs text-muted-foreground">Agendas: <strong>{agendas.length} de {limiteAgendas??"—"}</strong> (uma por usuário contratado). Para solicitar mais, <a className="font-semibold text-primary underline" href="mailto:atendimento@oricse.com.br">atendimento@oricse.com.br</a> ou seu consultor.</p></div><button disabled={limiteAgendas===null||agendas.length>=limiteAgendas} onClick={()=>void adicionar()} className="rounded-xl bg-primary px-4 py-2 font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40">+ Nova agenda</button></div>
  {agendas.map(a=><section key={a.id} className="space-y-4 rounded-2xl border bg-card p-5"><div className="grid gap-3 sm:grid-cols-2"><Campo nome="Nome"><input value={a.nome} onChange={e=>alterar(a.id,{nome:e.target.value})}/></Campo><Campo nome="Responsável"><input value={a.responsavel} onChange={e=>alterar(a.id,{responsavel:e.target.value})}/></Campo><Campo nome="Tipo do atendimento"><input value={a.tipo||"Consulta"} onChange={e=>alterar(a.id,{tipo:e.target.value})}/></Campo><Campo nome="Fuso horário"><input value={a.timezone||"America/Sao_Paulo"} onChange={e=>alterar(a.id,{timezone:e.target.value})}/></Campo><Campo nome="Início"><input type="time" value={hora(a.inicio)} onChange={e=>alterar(a.id,{inicio:e.target.value})}/></Campo><Campo nome="Fim"><input type="time" value={hora(a.fim)} onChange={e=>alterar(a.id,{fim:e.target.value})}/></Campo><Campo nome="Intervalo (minutos)"><input type="number" min={5} max={240} value={a.intervalo_min} onChange={e=>alterar(a.id,{intervalo_min:Number(e.target.value)})}/></Campo><Campo nome="Antecedência mínima (horas)"><input type="number" min={0} max={720} value={a.antecedencia_horas} onChange={e=>alterar(a.id,{antecedencia_horas:Number(e.target.value)})}/></Campo></div><div className="flex flex-wrap gap-3">{dias.map(([nome,n])=><label key={n} className="flex items-center gap-1 text-sm"><input type="checkbox" checked={a.dias_semana.includes(n)} onChange={e=>alterar(a.id,{dias_semana:e.target.checked?[...a.dias_semana,n]:a.dias_semana.filter(d=>d!==n)})}/>{nome}</label>)}</div><div className="rounded-xl border bg-secondary/20 p-4"><label className="block text-sm font-bold">Disponibilidade no Portal do Tutor<select className="mt-1 w-full rounded-xl border bg-background p-3 font-normal" value={a.portal_regra_dias||"semanal"} onChange={e=>alterar(a.id,{portal_regra_dias:e.target.value as Agenda["portal_regra_dias"]})}><option value="semanal">Dias da semana e horários habituais</option><option value="pares">Todos os dias pares (horários habituais)</option><option value="datas">Somente datas e horários específicos</option></select></label>{a.portal_regra_dias==="datas"&&<label className="mt-3 block text-sm font-bold">Datas e horários liberados<textarea spellCheck={false} rows={5} className="mt-1 w-full rounded-xl border bg-background p-3 font-mono text-sm font-normal" placeholder={"2026-12-18: 10:00, 11:00, 14:00\\n2026-12-19: 15:00, 15:30"} value={datasEditadas[a.id]??textoDatas(a.portal_datas_horarios)} onChange={e=>setDatasEditadas(prev=>({...prev,[a.id]:e.target.value}))}/><span className="mt-1 block text-xs font-normal text-muted-foreground">Uma data por linha. Somente estes horários poderão ser reservados.</span></label>}<p className="mt-2 text-xs text-muted-foreground">Agendas não publicadas continuam ocultas do tutor. Horários ocupados não são oferecidos.</p></div><label className="block text-sm font-bold">Modalidade<select className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3 font-normal" value={a.modalidade} onChange={e=>alterar(a.id,{modalidade:e.target.value as Agenda["modalidade"]})}><option value="livre">Livre — confirma na hora</option><option value="aprovacao">Mediante aprovação da clínica</option><option value="pagamento">Mediante pagamento — reserva do horário por 15 minutos</option></select></label><label className="flex gap-2 text-sm font-bold"><input type="checkbox" checked={a.portal_ativo} onChange={e=>alterar(a.id,{portal_ativo:e.target.checked})}/>Publicar esta agenda no Portal do Tutor</label>{a.modalidade==="pagamento"&&<p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Ao iniciar o pagamento, o horário fica retido por 15 minutos. A confirmação depende do retorno seguro do pagamento.</p>}<button disabled={salvando===a.id} onClick={()=>void salvar(a)} className="rounded-xl bg-primary px-4 py-2 font-bold text-primary-foreground disabled:opacity-50">{salvando===a.id?"Salvando...":"Salvar configuração"}</button></section>)}
 </>}</main>;
}

function Campo({nome,children}:{nome:string;children:React.ReactElement}){return <label className="text-sm font-bold">{nome}<span className="mt-1 block [&>input]:min-h-11 [&>input]:w-full [&>input]:rounded-xl [&>input]:border [&>input]:bg-background [&>input]:px-3 [&>input]:font-normal">{children}</span></label>}
function AgendamentoCard({item,agenda,alterando,onConfirmar,onCancelar,onCopiarMensagem}:{item:Agendamento;agenda?:Agenda;alterando:boolean;onConfirmar?:()=>void;onCancelar?:()=>void;onCopiarMensagem?:()=>void}){return <article className="rounded-xl border bg-background p-3"><div className="flex justify-between gap-3"><div><strong className="text-sm">{item.animal_referencia||"Animal"} · {item.tipo}</strong><p className="mt-0.5 text-xs text-muted-foreground">{dataHora(item.inicio)}{agenda?.nome?` · ${agenda.nome}`:""}</p>{item.observacoes&&<p className="mt-2 text-xs">“{item.observacoes}”</p>}</div><Clock3 size={16} className="text-muted-foreground"/></div>{(onConfirmar||onCancelar||onCopiarMensagem)&&<div className="mt-3 flex flex-wrap gap-2">{onConfirmar&&<button disabled={alterando} onClick={onConfirmar} className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><CheckCircle2 size={14}/> Confirmar</button>}{onCancelar&&<button disabled={alterando} onClick={onCancelar} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-bold text-destructive disabled:opacity-50"><XCircle size={14}/> Cancelar</button>}{onCopiarMensagem&&<button type="button" onClick={onCopiarMensagem} className="inline-flex items-center rounded-lg border px-3 py-2 text-xs font-semibold">Copiar confirmação</button>}</div>}</article>}
