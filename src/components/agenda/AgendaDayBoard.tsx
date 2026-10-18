import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Lock,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabaseBanco as supabase } from "@/integrations/supabase/client";

export type AgendaMode = "recepcao" | "veterinario";
type CorAgenda = "azul" | "verde" | "amarelo" | "vermelho" | "rosa" | "laranja" | "roxo" | "marrom" | "cinza" | "azul-petroleo";
type Modalidade = "livre" | "aprovacao" | "pagamento";
type StatusClinico = "Agendado" | "Em atendimento" | "Finalizado" | "Cancelado";
type Pagamento = "Pago" | "Pendente" | "Presencial" | "Isento";

type AgendaDb = {
  id: string;
  clinica_id: string;
  nome: string;
  responsavel: string;
  inicio: string;
  fim: string;
  dias_semana: number[];
  intervalo_min: number;
  portal_ativo: boolean;
  modalidade: Modalidade;
  antecedencia_horas: number;
  timezone: string;
  tipo: string;
  cor: CorAgenda;
};

type AgendamentoDb = {
  id: string;
  clinica_id: string;
  agenda_id: string;
  tutor_id: string | null;
  animal_id: string | null;
  animal_referencia: string;
  inicio: string;
  fim: string;
  estado: "solicitado" | "reservado" | "confirmado" | "cancelado" | "expirado";
  tipo: string;
  observacoes: string | null;
  origem: string;
  dados: Record<string, unknown> | null;
};

type TutorDb = { id: string; nome: string; telefone: string | null; codigo_publico: string };
type AnimalDb = { id: string; tutor_id: string; nome: string; especie: string; raca: string; sexo: string };
type ClinicaConfig = { duracao_padrao_atendimento_min: number | null; duracoes_atendimento_min: Record<string, number> | null };

type AgendaForm = {
  nome: string;
  responsavel: string;
  tipo: string;
  inicio: string;
  fim: string;
  diasSemana: number[];
  intervaloMin: number;
  portalAtivo: boolean;
  modalidade: Modalidade;
  antecedenciaHoras: number;
  timezone: string;
  cor: CorAgenda;
};

type EventoForm = {
  tipo: string;
  hora: string;
  duracaoMin: number;
  tutorId: string;
  animalId: string;
  pagamento: Pagamento;
  observacoes: string;
};

const TIPO_BLOQUEIO = "Bloqueio de agenda";
const TIPOS_EVENTO = ["Consulta", "Retorno", "Cirurgia", "Banho e Tosa", "Vacina", "Procedimento", TIPO_BLOQUEIO];
const TIPOS_AGENDA = ["Consultório", "Cirurgia", "Procedimentos", "Vacinação", "Banho e Tosa", "Geral"];
const DIAS = [
  { value: 1, label: "Seg" }, { value: 2, label: "Ter" }, { value: 3, label: "Qua" },
  { value: 4, label: "Qui" }, { value: 5, label: "Sex" }, { value: 6, label: "Sáb" }, { value: 0, label: "Dom" },
];
const CORES: CorAgenda[] = ["verde", "azul", "roxo", "laranja", "rosa", "amarelo", "vermelho", "marrom", "cinza", "azul-petroleo"];
const DURACOES_PADRAO: Record<string, number> = { Consulta: 30, Retorno: 30, Cirurgia: 120, "Banho e Tosa": 60, Vacina: 30, Procedimento: 30, [TIPO_BLOQUEIO]: 30 };
const TEMA: Record<CorAgenda, string> = {
  azul: "border-sky-400", verde: "border-emerald-500", amarelo: "border-amber-500", vermelho: "border-red-500",
  rosa: "border-pink-500", laranja: "border-orange-500", roxo: "border-violet-500", marrom: "border-amber-800",
  cinza: "border-slate-500", "azul-petroleo": "border-blue-900",
};

function hhmm(valor: string) { return valor?.slice(0, 5) || ""; }
function minutos(hora: string) { const [h = "0", m = "0"] = hora.split(":"); return Number(h) * 60 + Number(m); }
function horaDeMinutos(total: number) { return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`; }
function dataIso(data: Date) { return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`; }
function dataPorIso(valor: string) { const [a, m, d] = valor.split("-").map(Number); return new Date(a, (m || 1) - 1, d || 1, 12, 0, 0); }
function formatarData(valor: string) { return dataPorIso(valor).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).toUpperCase(); }
function duracaoEntre(inicio: string, fim: string) { return Math.max(5, Math.round((new Date(fim).getTime() - new Date(inicio).getTime()) / 60000)); }
function statusClinico(evento: AgendamentoDb): StatusClinico {
  if (evento.estado === "cancelado" || evento.estado === "expirado") return "Cancelado";
  const dado = String(evento.dados?.status_clinico || "");
  if (["Agendado", "Em atendimento", "Finalizado", "Cancelado"].includes(dado)) return dado as StatusClinico;
  return "Agendado";
}
function pagamentoEvento(evento: AgendamentoDb): Pagamento { const p = String(evento.dados?.pagamento || "Pendente"); return (["Pago", "Pendente", "Presencial", "Isento"].includes(p) ? p : "Pendente") as Pagamento; }
function origemEvento(evento: AgendamentoDb) { return evento.origem === "portal_tutor" ? "Tutor APP" : "Recepção"; }
function corValida(valor?: string | null): CorAgenda { return CORES.includes(valor as CorAgenda) ? valor as CorAgenda : "verde"; }
function emojiEspecie(valor?: string) { const e = (valor || "").toLowerCase(); if (e.includes("cão") || e.includes("cao") || e.includes("canin")) return "🐶"; if (e.includes("gat") || e.includes("felin")) return "🐱"; if (e.includes("ave")) return "🐦"; return "🐾"; }
function resumoDias(lista: number[]) { if (lista.length === 7) return "Todos os dias"; if ([1,2,3,4,5].every((d) => lista.includes(d)) && lista.length === 5) return "Seg a Sex"; return DIAS.filter((d) => lista.includes(d.value)).map((d) => d.label).join(" · "); }
function offsetMinutos(timeZone: string, data: string) {
  try {
    const probe = new Date(`${data}T12:00:00Z`);
    const nome = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset", hour: "2-digit" }).formatToParts(probe).find((p) => p.type === "timeZoneName")?.value || "GMT+00:00";
    const match = nome.match(/GMT([+-])(\d{2}):?(\d{2})?/);
    if (!match) return 0;
    const sinal = match[1] === "+" ? 1 : -1;
    return sinal * (Number(match[2]) * 60 + Number(match[3] || 0));
  } catch { return -180; }
}
function localParaIso(data: string, hora: string, timeZone: string) {
  const [a, m, d] = data.split("-").map(Number); const [h, min] = hora.split(":").map(Number);
  const utc = Date.UTC(a, (m || 1) - 1, d || 1, h || 0, min || 0) - offsetMinutos(timeZone, data) * 60000;
  return new Date(utc).toISOString();
}
function horaNoFuso(valor: string, timeZone: string) { return new Intl.DateTimeFormat("pt-BR", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(valor)); }
function dataNoFuso(valor: string, timeZone: string) { const partes = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(valor)); const mapa = Object.fromEntries(partes.map((p) => [p.type, p.value])); return `${mapa.year}-${mapa.month}-${mapa.day}`; }
function agendaFormPadrao(): AgendaForm { return { nome: "Consultas", responsavel: "", tipo: "Consultório", inicio: "08:00", fim: "17:00", diasSemana: [1,2,3,4,5], intervaloMin: 30, portalAtivo: false, modalidade: "aprovacao", antecedenciaHoras: 2, timezone: "America/Sao_Paulo", cor: "verde" }; }

export function AgendaDayBoard({ mode }: { mode: AgendaMode }) {
  const [clinicaId, setClinicaId] = useState("");
  const [agendas, setAgendas] = useState<AgendaDb[]>([]);
  const [eventos, setEventos] = useState<AgendamentoDb[]>([]);
  const [tutores, setTutores] = useState<TutorDb[]>([]);
  const [animais, setAnimais] = useState<AnimalDb[]>([]);
  const [config, setConfig] = useState<ClinicaConfig>({ duracao_padrao_atendimento_min: 30, duracoes_atendimento_min: {} });
  const [data, setData] = useState(dataIso(new Date()));
  const [filtro, setFiltro] = useState("todas");
  const [carregando, setCarregando] = useState(true);
  const [agendaModal, setAgendaModal] = useState<{ id?: string; form: AgendaForm } | null>(null);
  const [eventoModal, setEventoModal] = useState<{ agenda: AgendaDb; evento?: AgendamentoDb; form: EventoForm } | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const { data: contexto, error: contextoError } = await (supabase as any).rpc("oricse_contexto_clinica_atual");
      if (contextoError) throw contextoError;
      const cid = contexto?.[0]?.clinica_id || "";
      if (!cid) { setClinicaId(""); setAgendas([]); setEventos([]); return; }
      setClinicaId(cid);
      const base = dataPorIso(data); const de = new Date(base); de.setDate(de.getDate() - 1); de.setHours(0,0,0,0); const ate = new Date(base); ate.setDate(ate.getDate() + 2); ate.setHours(23,59,59,999);
      const [agendasResp, eventosResp, tutoresResp, animaisResp, configResp] = await Promise.all([
        (supabase as any).from("oricse_agendas_online").select("id,clinica_id,nome,responsavel,inicio,fim,dias_semana,intervalo_min,portal_ativo,modalidade,antecedencia_horas,timezone,tipo,cor").eq("clinica_id", cid).order("nome"),
        (supabase as any).from("oricse_agendamentos_online").select("id,clinica_id,agenda_id,tutor_id,animal_id,animal_referencia,inicio,fim,estado,tipo,observacoes,origem,dados").eq("clinica_id", cid).gte("inicio", de.toISOString()).lte("inicio", ate.toISOString()).order("inicio"),
        (supabase as any).from("tutores").select("id,nome,telefone,codigo_publico").eq("clinica_id", cid).order("nome"),
        (supabase as any).from("oricse_animais").select("id,tutor_id,nome,especie,raca,sexo").eq("clinica_id", cid).order("nome"),
        (supabase as any).from("clinicas").select("duracao_padrao_atendimento_min,duracoes_atendimento_min").eq("id", cid).maybeSingle(),
      ]);
      for (const r of [agendasResp, eventosResp, tutoresResp, animaisResp, configResp]) if (r.error) throw r.error;
      setAgendas((agendasResp.data || []).map((a: AgendaDb) => ({ ...a, cor: corValida(a.cor) })));
      setEventos(eventosResp.data || []); setTutores(tutoresResp.data || []); setAnimais(animaisResp.data || []);
      setConfig(configResp.data || { duracao_padrao_atendimento_min: 30, duracoes_atendimento_min: {} });
    } catch (error) {
      console.error("Erro ao carregar agenda única:", error);
      toast.error("Não foi possível carregar a agenda da clínica.");
    } finally { setCarregando(false); }
  }, [data]);

  useEffect(() => { void carregar(); }, [carregar]);
  useEffect(() => {
    if (!clinicaId) return;
    const canal = supabase.channel(`oricse-agenda-${clinicaId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "oricse_agendas_online", filter: `clinica_id=eq.${clinicaId}` }, () => void carregar())
      .on("postgres_changes", { event: "*", schema: "public", table: "oricse_agendamentos_online", filter: `clinica_id=eq.${clinicaId}` }, () => void carregar())
      .subscribe();
    return () => { void supabase.removeChannel(canal); };
  }, [clinicaId, carregar]);

  const tutoresPorId = useMemo(() => new Map(tutores.map((t) => [t.id, t])), [tutores]);
  const animaisPorId = useMemo(() => new Map(animais.map((a) => [a.id, a])), [animais]);
  const agendasVisiveis = useMemo(() => {
    const dia = dataPorIso(data).getDay();
    return agendas.filter((a) => (filtro === "todas" || a.id === filtro) && (a.dias_semana || []).includes(dia));
  }, [agendas, filtro, data]);

  function eventosAgenda(agenda: AgendaDb) { return eventos.filter((e) => e.agenda_id === agenda.id && dataNoFuso(e.inicio, agenda.timezone) === data); }
  function duracaoPadrao(tipo: string) { return Math.max(5, Number(config.duracoes_atendimento_min?.[tipo]) || DURACOES_PADRAO[tipo] || Number(config.duracao_padrao_atendimento_min) || 30); }
  function slots(agenda: AgendaDb) { const lista: string[] = []; for (let m = minutos(hhmm(agenda.inicio)); m + agenda.intervalo_min <= minutos(hhmm(agenda.fim)); m += agenda.intervalo_min) lista.push(horaDeMinutos(m)); return lista; }
  function ocupa(agenda: AgendaDb, hora: string) { const m = minutos(hora); return eventosAgenda(agenda).find((e) => { if (["cancelado","expirado"].includes(e.estado)) return false; const ini = minutos(horaNoFuso(e.inicio, agenda.timezone)); return m >= ini && m < ini + duracaoEntre(e.inicio, e.fim); }); }

  function abrirNovaAgenda() { setAgendaModal({ form: agendaFormPadrao() }); }
  function editarAgenda(a: AgendaDb) { setAgendaModal({ id: a.id, form: { nome:a.nome,responsavel:a.responsavel,tipo:a.tipo,inicio:hhmm(a.inicio),fim:hhmm(a.fim),diasSemana:[...a.dias_semana],intervaloMin:a.intervalo_min,portalAtivo:a.portal_ativo,modalidade:a.modalidade,antecedenciaHoras:a.antecedencia_horas,timezone:a.timezone,cor:corValida(a.cor) } }); }

  async function salvarAgenda() {
    if (!agendaModal || !clinicaId) return;
    const f = agendaModal.form;
    if (!f.nome.trim()) return void toast.error("Informe o nome da agenda.");
    if (minutos(f.inicio) >= minutos(f.fim)) return void toast.error("O início precisa ser anterior ao fim.");
    if (!f.diasSemana.length) return void toast.error("Selecione ao menos um dia da semana.");
    setSalvando(true);
    try {
      const payload = { clinica_id:clinicaId,nome:f.nome.trim(),responsavel:f.responsavel.trim(),tipo:f.tipo,inicio:f.inicio,fim:f.fim,dias_semana:f.diasSemana,intervalo_min:f.intervaloMin,portal_ativo:f.portalAtivo,modalidade:f.modalidade,antecedencia_horas:f.antecedenciaHoras,timezone:f.timezone.trim() || "America/Sao_Paulo",cor:f.cor,updated_at:new Date().toISOString() };
      const resposta = agendaModal.id ? await (supabase as any).from("oricse_agendas_online").update(payload).eq("id", agendaModal.id).eq("clinica_id", clinicaId) : await (supabase as any).from("oricse_agendas_online").insert(payload);
      if (resposta.error) throw resposta.error;
      toast.success(agendaModal.id ? "Agenda atualizada." : "Agenda criada."); setAgendaModal(null); await carregar();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível salvar a agenda."); }
    finally { setSalvando(false); }
  }

  async function excluirAgenda() {
    if (!agendaModal?.id || !clinicaId) return;
    if (!window.confirm("Excluir esta agenda e todos os agendamentos vinculados? Esta ação não pode ser desfeita.")) return;
    setSalvando(true);
    const { error } = await (supabase as any).from("oricse_agendas_online").delete().eq("id", agendaModal.id).eq("clinica_id", clinicaId);
    setSalvando(false); if (error) return void toast.error(error.message); toast.success("Agenda excluída."); setAgendaModal(null); await carregar();
  }

  function abrirHorario(agenda: AgendaDb, hora: string, existente?: AgendamentoDb) {
    const tipo = existente?.tipo || "Consulta";
    setEventoModal({ agenda, evento: existente, form: { tipo, hora: existente ? horaNoFuso(existente.inicio, agenda.timezone) : hora, duracaoMin: existente ? duracaoEntre(existente.inicio, existente.fim) : duracaoPadrao(tipo), tutorId: existente?.tutor_id || "", animalId: existente?.animal_id || "", pagamento: existente ? pagamentoEvento(existente) : "Pendente", observacoes: existente?.observacoes || "" } });
  }

  async function salvarEvento() {
    if (!eventoModal || !clinicaId) return;
    const { agenda, evento, form } = eventoModal;
    const bloqueio = form.tipo === TIPO_BLOQUEIO;
    const animal = animaisPorId.get(form.animalId); const tutor = tutoresPorId.get(form.tutorId);
    if (!bloqueio && (!tutor || !animal || animal.tutor_id !== tutor.id)) return void toast.error("Selecione um tutor e um animal vinculados.");
    const inicio = localParaIso(data, form.hora, agenda.timezone); const fim = new Date(new Date(inicio).getTime() + Math.max(5, form.duracaoMin) * 60000).toISOString();
    const dados = { ...(evento?.dados || {}), status_clinico: evento ? statusClinico(evento) : "Agendado", pagamento: form.pagamento, tutor_nome: tutor?.nome || "", especie: animal?.especie || "", origem_recepcao: true };
    const payload = { clinica_id:clinicaId,agenda_id:agenda.id,tutor_id:bloqueio?null:tutor!.id,animal_id:bloqueio?null:animal!.id,tutor_auth_id:evento?.tutor_id ? undefined : null,animal_referencia:bloqueio?TIPO_BLOQUEIO:animal!.nome,inicio,fim,estado:evento?.estado === "solicitado" ? "solicitado" : "confirmado",tipo:form.tipo,observacoes:form.observacoes.trim()||null,origem:evento?.origem || "recepcao",dados,updated_at:new Date().toISOString() };
    setSalvando(true);
    try {
      let resposta;
      if (evento) { const { tutor_auth_id: _ignorar, ...atualizacao } = payload; resposta = await (supabase as any).from("oricse_agendamentos_online").update(atualizacao).eq("id", evento.id).eq("clinica_id", clinicaId); }
      else resposta = await (supabase as any).from("oricse_agendamentos_online").insert(payload);
      if (resposta.error) throw resposta.error;
      toast.success(evento ? "Agendamento atualizado." : bloqueio ? "Horário bloqueado." : "Agendamento criado."); setEventoModal(null); await carregar();
    } catch (error: any) { toast.error(error?.code === "23P01" ? "Este horário já está ocupado nesta agenda." : error?.message || "Não foi possível salvar o agendamento."); }
    finally { setSalvando(false); }
  }

  async function alterarEvento(evento: AgendamentoDb, patch: Record<string, unknown>, mensagem: string) {
    if (!clinicaId) return;
    const { error } = await (supabase as any).from("oricse_agendamentos_online").update({ ...patch, updated_at:new Date().toISOString() }).eq("id",evento.id).eq("clinica_id",clinicaId);
    if (error) return void toast.error(error.message); toast.success(mensagem); setEventoModal(null); await carregar();
  }
  async function confirmarPortal(evento: AgendamentoDb) { await alterarEvento(evento,{estado:"confirmado",dados:{...(evento.dados||{}),status_clinico:"Agendado"}},"Agendamento confirmado."); }
  async function cancelarEvento(evento: AgendamentoDb) { await alterarEvento(evento,{estado:"cancelado",dados:{...(evento.dados||{}),status_clinico:"Cancelado"}},evento.tipo===TIPO_BLOQUEIO?"Bloqueio removido.":"Agendamento cancelado."); }
  async function statusEvento(evento: AgendamentoDb, status: StatusClinico) { await alterarEvento(evento,{dados:{...(evento.dados||{}),status_clinico:status}},status==="Finalizado"?"Atendimento finalizado.":status==="Em atendimento"?"Atendimento iniciado.":"Status atualizado."); }

  if (carregando && !agendas.length) return <section className="rounded-2xl border bg-white p-6 text-sm text-muted-foreground">Carregando agenda única da clínica...</section>;

  return <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2"><CalendarDays size={22} className="text-primary"/><h2 className="text-2xl font-bold">{mode === "recepcao" ? "Agenda do dia" : "Minha agenda"}</h2></div><p className="mt-1 text-sm text-muted-foreground">Recepção e Portal do Tutor usam agora a mesma agenda no banco.</p></div><div className="flex flex-wrap gap-2"><select value={filtro} onChange={e=>setFiltro(e.target.value)} className="min-h-10 rounded-xl border bg-white px-3 text-sm font-semibold"><option value="todas">Todas as agendas</option>{agendas.map(a=><option key={a.id} value={a.id}>{a.nome} · {a.responsavel||"Sem responsável"}</option>)}</select><button onClick={abrirNovaAgenda} className="inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-sm font-semibold"><Plus size={15}/> Criar agenda</button></div></div>
    <div className="mt-4 flex items-center gap-3 rounded-2xl border bg-[#f8faf8] p-3"><button onClick={()=>{const d=dataPorIso(data);d.setDate(d.getDate()-1);setData(dataIso(d));}} className="rounded-xl border bg-white p-2.5"><ChevronLeft size={19}/></button><button onClick={()=>setData(dataIso(new Date()))} className="min-w-0 flex-1 text-center"><div className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">DATA DA AGENDA</div><div className="mt-0.5 text-xl font-black sm:text-2xl">{formatarData(data)}</div><div className="text-[10px] text-muted-foreground">Clique para voltar para hoje</div></button><button onClick={()=>{const d=dataPorIso(data);d.setDate(d.getDate()+1);setData(dataIso(d));}} className="rounded-xl border bg-white p-2.5"><ChevronRight size={19}/></button></div>

    {!agendas.length ? <div className="mt-5 rounded-2xl border border-dashed p-8 text-center"><CalendarDays className="mx-auto text-muted-foreground"/><h3 className="mt-3 text-lg font-bold">Nenhuma agenda criada</h3><p className="mt-1 text-sm text-muted-foreground">Crie a primeira agenda. Ela poderá ser publicada no Portal do Tutor no mesmo cadastro.</p><button onClick={abrirNovaAgenda} className="mt-4 rounded-xl bg-primary px-4 py-2 font-bold text-primary-foreground">Criar primeira agenda</button></div> :
    <div className="mt-4 flex gap-3 overflow-x-auto pb-2">{agendasVisiveis.map(agenda=>{const tema=TEMA[corValida(agenda.cor)];const listaEventos=eventosAgenda(agenda);return <article key={agenda.id} className={`w-[330px] min-w-[330px] overflow-hidden rounded-xl border-2 bg-[#fcfcfb] ${tema}`}><header className="border-b bg-white px-3 py-3"><div className="flex items-start justify-between gap-2"><div><h3 className="font-black">{agenda.nome}</h3><p className="text-xs text-muted-foreground">{agenda.tipo} · {agenda.responsavel||"Sem responsável"}</p><p className="mt-1 text-[10px] font-semibold text-primary">{hhmm(agenda.inicio)}–{hhmm(agenda.fim)} · {resumoDias(agenda.dias_semana)} · {agenda.intervalo_min} min</p>{agenda.portal_ativo&&<span className="mt-1 inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-black uppercase text-emerald-800">Portal ativo · {agenda.modalidade}</span>}</div><button onClick={()=>editarAgenda(agenda)} className="rounded-lg p-1.5 hover:bg-secondary"><Pencil size={15}/></button></div></header><div className="space-y-1.5 p-2">{slots(agenda).map(hora=>{const evento=ocupa(agenda,hora);if(!evento)return <button key={hora} type="button" data-oricse-agendar-livre="true" onClick={()=>abrirHorario(agenda,hora)} className="flex min-h-9 w-full items-center gap-2 rounded-lg border border-dashed bg-white px-2.5 text-left text-[11px] hover:bg-secondary/40"><strong className="w-11">{hora}</strong><span className="font-semibold text-muted-foreground">Livre</span><span className="ml-auto font-bold text-primary">+ Agendar</span></button>;const inicio=horaNoFuso(evento.inicio,agenda.timezone);if(inicio!==hora)return <div key={hora} className="flex min-h-9 items-center gap-2 rounded-lg border bg-slate-50 px-2.5 text-[10px]"><strong className="w-11">{hora}</strong><span>Ocupado · {evento.tipo}</span></div>;const animal=evento.animal_id?animaisPorId.get(evento.animal_id):null;const tutor=evento.tutor_id?tutoresPorId.get(evento.tutor_id):null;const bloqueio=evento.tipo===TIPO_BLOQUEIO;const status=statusClinico(evento);return <button key={evento.id} onClick={()=>abrirHorario(agenda,hora,evento)} className={`w-full rounded-lg border border-l-4 p-2 text-left ${bloqueio?"border-slate-400 bg-slate-100":"border-sky-300 bg-sky-50"}`}><div className="flex items-center gap-1.5"><strong className="text-xs">{hora}</strong>{bloqueio?<Lock size={13}/>:<span>{emojiEspecie(animal?.especie||String(evento.dados?.especie||""))}</span>}<span className="truncate text-xs font-black">{bloqueio?TIPO_BLOQUEIO:(animal?.nome||evento.animal_referencia).toUpperCase()}</span>{evento.estado==="solicitado"&&<span className="ml-auto rounded bg-amber-100 px-1.5 py-0.5 text-[8px] font-black text-amber-900">APROVAR</span>}</div>{!bloqueio&&<p className="mt-0.5 truncate text-[10px] text-slate-600">{evento.tipo} · {tutor?.nome||String(evento.dados?.tutor_nome||"Tutor")} · {origemEvento(evento)}</p>}<p className="mt-0.5 text-[9px] font-semibold text-slate-500">{duracaoEntre(evento.inicio,evento.fim)} min · {status} · {pagamentoEvento(evento)}</p></button>})}{!listaEventos.length&&<p className="py-1 text-center text-[10px] text-muted-foreground">Sem agendamentos neste dia.</p>}</div></article>})}</div>}

    {agendas.length>0&&agendasVisiveis.length===0&&<p className="mt-4 rounded-xl bg-secondary/40 p-4 text-sm text-muted-foreground">Nenhuma agenda funciona nesta data.</p>}

    {agendaModal&&<div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/35 p-4"><div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"><div className="flex items-start justify-between"><div><h3 className="text-xl font-black">{agendaModal.id?"Editar agenda":"Criar agenda"}</h3><p className="text-xs text-muted-foreground">A mesma definição é usada na Recepção e no Portal do Tutor.</p></div><button onClick={()=>setAgendaModal(null)}><X/></button></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><Campo label="Nome"><input value={agendaModal.form.nome} onChange={e=>setAgendaModal({...agendaModal,form:{...agendaModal.form,nome:e.target.value}})}/></Campo><Campo label="Responsável"><input value={agendaModal.form.responsavel} onChange={e=>setAgendaModal({...agendaModal,form:{...agendaModal.form,responsavel:e.target.value}})}/></Campo><Campo label="Tipo"><select value={agendaModal.form.tipo} onChange={e=>setAgendaModal({...agendaModal,form:{...agendaModal.form,tipo:e.target.value}})}>{TIPOS_AGENDA.map(t=><option key={t}>{t}</option>)}</select></Campo><Campo label="Cor"><select value={agendaModal.form.cor} onChange={e=>setAgendaModal({...agendaModal,form:{...agendaModal.form,cor:e.target.value as CorAgenda}})}>{CORES.map(c=><option key={c} value={c}>{c}</option>)}</select></Campo><Campo label="Início"><input type="time" value={agendaModal.form.inicio} onChange={e=>setAgendaModal({...agendaModal,form:{...agendaModal.form,inicio:e.target.value}})}/></Campo><Campo label="Fim"><input type="time" value={agendaModal.form.fim} onChange={e=>setAgendaModal({...agendaModal,form:{...agendaModal.form,fim:e.target.value}})}/></Campo><Campo label="Intervalo da grade"><input type="number" min={5} max={240} value={agendaModal.form.intervaloMin} onChange={e=>setAgendaModal({...agendaModal,form:{...agendaModal.form,intervaloMin:Number(e.target.value)}})}/></Campo><Campo label="Fuso horário"><input value={agendaModal.form.timezone} onChange={e=>setAgendaModal({...agendaModal,form:{...agendaModal.form,timezone:e.target.value}})}/></Campo></div><div className="mt-4"><p className="text-sm font-bold">Dias</p><div className="mt-2 flex flex-wrap gap-3">{DIAS.map(d=><label key={d.value} className="flex items-center gap-1 text-sm"><input type="checkbox" checked={agendaModal.form.diasSemana.includes(d.value)} onChange={e=>setAgendaModal({...agendaModal,form:{...agendaModal.form,diasSemana:e.target.checked?[...agendaModal.form.diasSemana,d.value]:agendaModal.form.diasSemana.filter(x=>x!==d.value)}})}/>{d.label}</label>)}</div></div><div className="mt-5 rounded-xl border bg-slate-50 p-4"><label className="flex items-center gap-2 text-sm font-black"><input type="checkbox" checked={agendaModal.form.portalAtivo} onChange={e=>setAgendaModal({...agendaModal,form:{...agendaModal.form,portalAtivo:e.target.checked}})}/>Publicar no Portal do Tutor</label>{agendaModal.form.portalAtivo&&<div className="mt-3 grid gap-3 sm:grid-cols-2"><Campo label="Modalidade"><select value={agendaModal.form.modalidade} onChange={e=>setAgendaModal({...agendaModal,form:{...agendaModal.form,modalidade:e.target.value as Modalidade}})}><option value="livre">Livre — confirma na hora</option><option value="aprovacao">Mediante aprovação</option><option value="pagamento">Mediante pagamento</option></select></Campo><Campo label="Antecedência mínima (h)"><input type="number" min={0} max={720} value={agendaModal.form.antecedenciaHoras} onChange={e=>setAgendaModal({...agendaModal,form:{...agendaModal.form,antecedenciaHoras:Number(e.target.value)}})}/></Campo></div>}</div><div className="mt-5 flex flex-wrap justify-between gap-2">{agendaModal.id?<button disabled={salvando} onClick={excluirAgenda} className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 font-bold text-red-700"><Trash2 size={16}/> Excluir</button>:<span/>}<div className="flex gap-2"><button onClick={()=>setAgendaModal(null)} className="rounded-xl border px-4 py-2.5 font-bold">Cancelar</button><button disabled={salvando} onClick={salvarAgenda} className="rounded-xl bg-primary px-4 py-2.5 font-bold text-primary-foreground">{salvando?"Salvando...":"Salvar agenda"}</button></div></div></div></div>}

    {eventoModal&&<div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/35 p-4"><div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"><div className="flex items-start justify-between"><div><h3 className="text-xl font-black">{eventoModal.evento?eventoModal.form.tipo:"Novo horário"}</h3><p className="text-xs text-muted-foreground">{eventoModal.agenda.nome} · {data} · {eventoModal.form.hora}</p></div><button onClick={()=>setEventoModal(null)}><X/></button></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><Campo label="Tipo"><select value={eventoModal.form.tipo} onChange={e=>{const tipo=e.target.value;setEventoModal({...eventoModal,form:{...eventoModal.form,tipo,duracaoMin:duracaoPadrao(tipo),tutorId:tipo===TIPO_BLOQUEIO?"":eventoModal.form.tutorId,animalId:tipo===TIPO_BLOQUEIO?"":eventoModal.form.animalId}})}}>{TIPOS_EVENTO.map(t=><option key={t}>{t}</option>)}</select></Campo><Campo label="Hora"><input type="time" value={eventoModal.form.hora} onChange={e=>setEventoModal({...eventoModal,form:{...eventoModal.form,hora:e.target.value}})}/></Campo><Campo label="Duração (min)"><input type="number" min={5} max={720} step={5} value={eventoModal.form.duracaoMin} onChange={e=>setEventoModal({...eventoModal,form:{...eventoModal.form,duracaoMin:Number(e.target.value)}})}/></Campo><Campo label="Pagamento"><select value={eventoModal.form.pagamento} onChange={e=>setEventoModal({...eventoModal,form:{...eventoModal.form,pagamento:e.target.value as Pagamento}})}><option>Pago</option><option>Pendente</option><option>Presencial</option><option>Isento</option></select></Campo></div>{eventoModal.form.tipo!==TIPO_BLOQUEIO&&<div className="mt-4 grid gap-4 sm:grid-cols-2"><Campo label="Tutor"><select value={eventoModal.form.tutorId} onChange={e=>setEventoModal({...eventoModal,form:{...eventoModal.form,tutorId:e.target.value,animalId:""}})}><option value="">Selecione</option>{tutores.map(t=><option key={t.id} value={t.id}>{t.nome} · {t.codigo_publico}</option>)}</select></Campo><Campo label="Animal"><select value={eventoModal.form.animalId} onChange={e=>setEventoModal({...eventoModal,form:{...eventoModal.form,animalId:e.target.value}})}><option value="">Selecione</option>{animais.filter(a=>a.tutor_id===eventoModal.form.tutorId).map(a=><option key={a.id} value={a.id}>{a.nome} · {a.especie}</option>)}</select></Campo></div>}<label className="mt-4 block text-sm font-bold">Observações<textarea value={eventoModal.form.observacoes} onChange={e=>setEventoModal({...eventoModal,form:{...eventoModal.form,observacoes:e.target.value}})} rows={3} className="mt-1 w-full rounded-xl border p-3 font-normal"/></label>{eventoModal.evento&&<div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs"><p><strong>Origem:</strong> {origemEvento(eventoModal.evento)}</p><p><strong>Status:</strong> {eventoModal.evento.estado==="solicitado"?"Aguardando aprovação":statusClinico(eventoModal.evento)}</p></div>}<div className="mt-5 flex flex-wrap gap-2">{eventoModal.evento?.estado==="solicitado"&&<button onClick={()=>void confirmarPortal(eventoModal.evento!)} className="inline-flex items-center gap-1 rounded-xl bg-emerald-700 px-3 py-2 font-bold text-white"><CheckCircle2 size={15}/> Aprovar</button>}{eventoModal.evento&&eventoModal.evento.estado!=="cancelado"&&<button onClick={()=>void cancelarEvento(eventoModal.evento!)} className="rounded-xl border border-red-200 px-3 py-2 font-bold text-red-700">{eventoModal.evento.tipo===TIPO_BLOQUEIO?"Remover bloqueio":"Cancelar"}</button>}{eventoModal.evento&&eventoModal.evento.estado==="confirmado"&&statusClinico(eventoModal.evento)==="Agendado"&&eventoModal.evento.animal_id&&<button onClick={async()=>{await statusEvento(eventoModal.evento!,"Em atendimento");window.location.href=`/animal?animalId=${encodeURIComponent(eventoModal.evento!.animal_id!)}`;}} className="inline-flex items-center gap-1 rounded-xl border px-3 py-2 font-bold text-emerald-700"><Clock3 size={15}/> Iniciar atendimento</button>}{eventoModal.evento&&statusClinico(eventoModal.evento)==="Em atendimento"&&<button onClick={()=>void statusEvento(eventoModal.evento!,"Finalizado")} className="inline-flex items-center gap-1 rounded-xl border px-3 py-2 font-bold"><CheckCircle2 size={15}/> Finalizar</button>}{eventoModal.evento&&statusClinico(eventoModal.evento)==="Finalizado"&&<button onClick={()=>void statusEvento(eventoModal.evento!,"Em atendimento")} className="inline-flex items-center gap-1 rounded-xl border px-3 py-2 font-bold"><RotateCcw size={15}/> Reabrir</button>}<div className="ml-auto flex gap-2"><button onClick={()=>setEventoModal(null)} className="rounded-xl border px-4 py-2 font-bold">Fechar</button><button disabled={salvando||eventoModal.evento?.estado==="cancelado"} onClick={salvarEvento} className="rounded-xl bg-primary px-4 py-2 font-bold text-primary-foreground disabled:opacity-40">{salvando?"Salvando...":"Salvar"}</button></div></div></div></div>}
  </section>;
}

function Campo({ label, children }: { label: string; children: React.ReactElement }) {
  return <label className="text-sm font-bold">{label}<span className="mt-1 block [&>input]:min-h-11 [&>input]:w-full [&>input]:rounded-xl [&>input]:border [&>input]:px-3 [&>input]:font-normal [&>select]:min-h-11 [&>select]:w-full [&>select]:rounded-xl [&>select]:border [&>select]:bg-white [&>select]:px-3 [&>select]:font-normal">{children}</span></label>;
}
