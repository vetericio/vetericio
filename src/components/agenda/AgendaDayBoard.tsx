import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Lock,
  Pencil,
  Plus,
  RotateCcw,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export type AgendaMode = "recepcao" | "veterinario";
type Origem = "Tutor no app" | "Recepção";
type Pagamento = "Pago" | "Pendente" | "Presencial" | "Isento";
type StatusEvento = "Agendado" | "Em atendimento" | "Finalizado" | "Cancelado";
type Especie = "Cão" | "Gato" | "Ave" | "Hamster" | "Cobra" | "Bovino" | "Equino" | "Outro";
type Duracoes = Record<string, number>;
type CorAgenda = "azul" | "verde" | "amarelo" | "vermelho" | "rosa" | "laranja" | "roxo" | "marrom" | "cinza" | "azul-petroleo";

const TIPO_BLOQUEIO = "Bloqueio de agenda";
const TIPO_BANHO_TOSA = "Banho e Tosa";
const DURACOES_PADRAO: Duracoes = {
  Consulta: 30,
  Retorno: 30,
  Cirurgia: 120,
  [TIPO_BANHO_TOSA]: 60,
  Vacina: 30,
  Procedimento: 30,
};

const CORES: { value: CorAgenda; label: string; preview: string }[] = [
  { value: "azul", label: "Azul", preview: "#0284c7" },
  { value: "verde", label: "Verde", preview: "#059669" },
  { value: "amarelo", label: "Amarelo", preview: "#d97706" },
  { value: "vermelho", label: "Vermelho", preview: "#dc2626" },
  { value: "rosa", label: "Rosa", preview: "#db2777" },
  { value: "laranja", label: "Laranja", preview: "#ea580c" },
  { value: "roxo", label: "Roxo", preview: "#7c3aed" },
  { value: "marrom", label: "Marrom", preview: "#92400e" },
  { value: "cinza", label: "Cinza", preview: "#64748b" },
  { value: "azul-petroleo", label: "Azul petróleo", preview: "#0f766e" },
];

const TEMA: Record<CorAgenda, {
  border: string;
  borderSoft: string;
  bg: string;
  bgSoft: string;
  text: string;
  dot: string;
  button: string;
  freeBorder: string;
  freeBg: string;
}> = {
  azul: { border: "border-sky-500", borderSoft: "border-sky-200", bg: "bg-sky-50", bgSoft: "bg-sky-50/60", text: "text-sky-800", dot: "bg-sky-600", button: "text-sky-700", freeBorder: "border-sky-300", freeBg: "hover:bg-sky-50" },
  verde: { border: "border-emerald-500", borderSoft: "border-emerald-200", bg: "bg-emerald-50", bgSoft: "bg-emerald-50/60", text: "text-emerald-800", dot: "bg-emerald-600", button: "text-emerald-700", freeBorder: "border-emerald-300", freeBg: "hover:bg-emerald-50" },
  amarelo: { border: "border-amber-500", borderSoft: "border-amber-200", bg: "bg-amber-50", bgSoft: "bg-amber-50/60", text: "text-amber-800", dot: "bg-amber-500", button: "text-amber-700", freeBorder: "border-amber-300", freeBg: "hover:bg-amber-50" },
  vermelho: { border: "border-red-500", borderSoft: "border-red-200", bg: "bg-red-50", bgSoft: "bg-red-50/60", text: "text-red-800", dot: "bg-red-600", button: "text-red-700", freeBorder: "border-red-300", freeBg: "hover:bg-red-50" },
  rosa: { border: "border-pink-500", borderSoft: "border-pink-200", bg: "bg-pink-50", bgSoft: "bg-pink-50/60", text: "text-pink-800", dot: "bg-pink-600", button: "text-pink-700", freeBorder: "border-pink-300", freeBg: "hover:bg-pink-50" },
  laranja: { border: "border-orange-500", borderSoft: "border-orange-200", bg: "bg-orange-50", bgSoft: "bg-orange-50/60", text: "text-orange-800", dot: "bg-orange-600", button: "text-orange-700", freeBorder: "border-orange-300", freeBg: "hover:bg-orange-50" },
  roxo: { border: "border-violet-500", borderSoft: "border-violet-200", bg: "bg-violet-50", bgSoft: "bg-violet-50/60", text: "text-violet-800", dot: "bg-violet-600", button: "text-violet-700", freeBorder: "border-violet-300", freeBg: "hover:bg-violet-50" },
  marrom: { border: "border-amber-800", borderSoft: "border-amber-300", bg: "bg-amber-50", bgSoft: "bg-amber-50/60", text: "text-amber-950", dot: "bg-amber-800", button: "text-amber-900", freeBorder: "border-amber-400", freeBg: "hover:bg-amber-50" },
  cinza: { border: "border-slate-500", borderSoft: "border-slate-200", bg: "bg-slate-100", bgSoft: "bg-slate-50", text: "text-slate-800", dot: "bg-slate-600", button: "text-slate-700", freeBorder: "border-slate-300", freeBg: "hover:bg-slate-50" },
  "azul-petroleo": { border: "border-teal-700", borderSoft: "border-teal-200", bg: "bg-teal-50", bgSoft: "bg-teal-50/60", text: "text-teal-900", dot: "bg-teal-700", button: "text-teal-800", freeBorder: "border-teal-300", freeBg: "hover:bg-teal-50" },
};

type Evento = {
  id: string;
  hora: string;
  tipo: string;
  paciente: string;
  tutor: string;
  especie?: Especie;
  origem: Origem;
  pagamento: Pagamento;
  status: StatusEvento;
  duracaoMin?: number;
};

type ColunaAgenda = {
  id: string;
  nome: string;
  responsavel: string;
  inicio: string;
  fim: string;
  cor: CorAgenda;
  eventos: Evento[];
};

type AgendaForm = { nome: string; responsavel: string; inicio: string; fim: string; cor: CorAgenda };

const BASE: ColunaAgenda[] = [
  {
    id: "agenda-1", nome: "Agenda 1", responsavel: "Dra. Ana Costa", inicio: "08:00", fim: "17:00", cor: "verde",
    eventos: [
      { id: "e1", hora: "08:00", tipo: "Consulta", paciente: "Max", tutor: "Carlos Souza", especie: "Cão", origem: "Tutor no app", pagamento: "Pago", status: "Agendado" },
      { id: "e2", hora: "09:30", tipo: "Vacina", paciente: "Luna", tutor: "Renata Lima", especie: "Gato", origem: "Recepção", pagamento: "Presencial", status: "Agendado" },
    ],
  },
  {
    id: "agenda-2", nome: "Agenda 2", responsavel: "Dr. Bruno Almeida", inicio: "08:00", fim: "17:00", cor: "azul",
    eventos: [
      { id: "e3", hora: "08:30", tipo: TIPO_BANHO_TOSA, paciente: "Mel", tutor: "Paula Costa", especie: "Cão", origem: "Tutor no app", pagamento: "Pago", status: "Agendado" },
    ],
  },
  {
    id: "agenda-3", nome: "Agenda 3", responsavel: "Dra. Juliana Ribeiro", inicio: "09:00", fim: "15:00", cor: "roxo",
    eventos: [
      { id: "e4", hora: "09:00", tipo: "Retorno", paciente: "Bidu", tutor: "André Martins", especie: "Ave", origem: "Recepção", pagamento: "Pendente", status: "Agendado" },
    ],
  },
];

const TIPOS_SELETOR = ["Consulta", "Retorno", "Cirurgia", TIPO_BANHO_TOSA, "Vacina", "Procedimento", TIPO_BLOQUEIO];
const ESPECIES: Especie[] = ["Cão", "Gato", "Ave", "Hamster", "Cobra", "Bovino", "Equino", "Outro"];

function normalizarTipo(tipo: string) {
  return tipo === "Banho" || tipo === "Tosa" ? TIPO_BANHO_TOSA : tipo;
}

function pagamentoLabel(pagamento: Pagamento) {
  if (pagamento === "Pendente") return "Pagamento pendente";
  if (pagamento === "Presencial") return "Pagamento presencial";
  return pagamento;
}

function ehBloqueio(evento: Pick<Evento, "tipo">) {
  return evento.tipo === TIPO_BLOQUEIO;
}

function emojiEspecie(especie?: string) {
  const valor = (especie || "Outro").toLowerCase();
  if (["cão", "cao", "canino", "cachorro"].includes(valor)) return "🐶";
  if (["gato", "felino"].includes(valor)) return "🐱";
  if (["ave", "passarinho", "pássaro", "passaro"].includes(valor)) return "🐦";
  if (valor === "hamster") return "🐭";
  if (["cobra", "serpente"].includes(valor)) return "🐍";
  if (["vaca", "bovino", "bovina"].includes(valor)) return "🐄";
  if (["cavalo", "equino", "equina"].includes(valor)) return "🐴";
  return "🐾";
}

function horaEmMinutos(hora: string) {
  const [h = "0", m = "0"] = hora.split(":");
  return Math.max(0, Math.min(1439, Number(h) * 60 + Number(m)));
}

function minutosEmHora(total: number) {
  const seguro = Math.max(0, Math.min(1439, total));
  return `${String(Math.floor(seguro / 60)).padStart(2, "0")}:${String(seguro % 60).padStart(2, "0")}`;
}

function formatarHora(hora: string) {
  const [h = "0", m = "00"] = hora.split(":");
  return `${Number(h)}h${m}`;
}

function formatarData(data: Date) {
  return data.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).toUpperCase();
}

function formatarDuracao(minutos: number) {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h && m) return `${h}h${String(m).padStart(2, "0")}`;
  if (h) return `${h}h`;
  return `${m} min`;
}

function origemCurta(origem: Origem) {
  return origem === "Tutor no app" ? "Tutor APP" : "Recepção";
}

function gerarHorariosAgenda(agenda: Pick<ColunaAgenda, "inicio" | "fim">, intervalo: number) {
  const passo = Math.max(5, Number(intervalo) || 30);
  const inicio = horaEmMinutos(agenda.inicio || "08:00");
  const fim = horaEmMinutos(agenda.fim || "17:00");
  const horarios: string[] = [];
  for (let minuto = inicio; minuto + passo <= fim; minuto += passo) horarios.push(minutosEmHora(minuto));
  return horarios;
}

function ordenarEventos(eventos: Evento[]) {
  return [...eventos].sort((a, b) => horaEmMinutos(a.hora) - horaEmMinutos(b.hora));
}

function normalizarAgendas(agendas: ColunaAgenda[]) {
  return agendas.map((agenda, index) => ({
    ...agenda,
    cor: agenda.cor || (["verde", "azul", "roxo", "laranja", "rosa"][index % 5] as CorAgenda),
    inicio: agenda.inicio || "08:00",
    fim: agenda.fim || "17:00",
    eventos: ordenarEventos((agenda.eventos || []).map((evento) => ({ ...evento, tipo: normalizarTipo(evento.tipo), especie: evento.especie || "Outro" }))),
  }));
}

function carregarAgendas() {
  if (typeof window === "undefined") return normalizarAgendas(BASE);
  try {
    const salvo = window.localStorage.getItem("oricse-agendas-v2");
    return salvo ? normalizarAgendas(JSON.parse(salvo) as ColunaAgenda[]) : normalizarAgendas(BASE);
  } catch {
    return normalizarAgendas(BASE);
  }
}

function novoEvento(hora: string): Evento {
  return {
    id: `evento-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    hora,
    tipo: "Consulta",
    paciente: "Novo paciente",
    tutor: "Tutor",
    especie: "Cão",
    origem: "Recepção",
    pagamento: "Pendente",
    status: "Agendado",
  };
}

export function AgendaDayBoard({ mode }: { mode: AgendaMode }) {
  const [agendas, setAgendas] = useState<ColunaAgenda[]>(carregarAgendas);
  const [data, setData] = useState(() => new Date());
  const [filtro, setFiltro] = useState("todas");
  const [eventoAberto, setEventoAberto] = useState<{ agendaId: string; evento: Evento } | null>(null);
  const [animalAberto, setAnimalAberto] = useState<Evento | null>(null);
  const [criandoAgenda, setCriandoAgenda] = useState(false);
  const [editandoAgenda, setEditandoAgenda] = useState<ColunaAgenda | null>(null);
  const [confirmacao, setConfirmacao] = useState<{ agendaId: string; evento: Evento } | null>(null);
  const [novaAgenda, setNovaAgenda] = useState<AgendaForm>({ nome: "Consultas", responsavel: "", inicio: "08:00", fim: "17:00", cor: "verde" });
  const [intervaloGrade, setIntervaloGrade] = useState(30);
  const [duracoes, setDuracoes] = useState<Duracoes>(DURACOES_PADRAO);
  const trilhoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem("oricse-agendas-v2", JSON.stringify(normalizarAgendas(agendas)));
  }, [agendas]);

  useEffect(() => {
    let ativo = true;
    async function carregarConfiguracao() {
      try {
        const { data: authData } = await supabase.auth.getUser();
        const userId = authData.user?.id;
        if (!userId) return;
        const { data: vinculo } = await (supabase as any).from("clinica_usuarios").select("clinica_id").eq("user_id", userId).eq("ativo", true).limit(1).maybeSingle();
        if (!vinculo?.clinica_id) return;
        const { data: clinica } = await (supabase as any).from("clinicas").select("duracao_padrao_atendimento_min,duracoes_atendimento_min").eq("id", vinculo.clinica_id).maybeSingle();
        if (!ativo) return;
        const intervalo = Number(clinica?.duracao_padrao_atendimento_min);
        if (Number.isFinite(intervalo) && intervalo >= 5) setIntervaloGrade(intervalo);
        setDuracoes({ ...DURACOES_PADRAO, ...(clinica?.duracoes_atendimento_min || {}) });
      } catch (error) {
        console.error("Não foi possível carregar as configurações da agenda:", error);
      }
    }
    void carregarConfiguracao();
    return () => { ativo = false; };
  }, []);

  const visiveis = useMemo(() => filtro === "todas" ? agendas : agendas.filter((agenda) => agenda.id === filtro), [agendas, filtro]);
  const titulo = mode === "recepcao" ? "Agenda do dia" : "Minha agenda";
  const subtitulo = mode === "recepcao" ? "Visualize os horários da clínica, organize chegadas e acompanhe a fila." : "Acompanhe consultas, retornos e procedimentos previstos para hoje.";

  function duracaoEvento(evento: Evento) {
    if (ehBloqueio(evento)) return Math.max(5, Number(evento.duracaoMin) || intervaloGrade);
    return Math.max(5, Number(duracoes[normalizarTipo(evento.tipo)]) || intervaloGrade);
  }

  function mudarDia(delta: number) {
    setData((atual) => { const d = new Date(atual); d.setDate(d.getDate() + delta); return d; });
  }

  function rolarAgendas(direcao: -1 | 1) {
    trilhoRef.current?.scrollBy({ left: direcao * 360, behavior: "smooth" });
  }

  function validarHorarioAgenda(inicio: string, fim: string) {
    if (horaEmMinutos(inicio) >= horaEmMinutos(fim)) {
      toast.error("O horário de início da agenda deve ser anterior ao horário de término.");
      return false;
    }
    return true;
  }

  function criarAgenda() {
    if (agendas.length >= 10) return;
    if (!validarHorarioAgenda(novaAgenda.inicio, novaAgenda.fim)) return;
    const id = `agenda-${Date.now()}`;
    setAgendas((lista) => [...lista, { id, ...novaAgenda, nome: novaAgenda.nome.trim() || `Agenda ${agendas.length + 1}`, responsavel: novaAgenda.responsavel.trim() || "Sem responsável", eventos: [] }]);
    setFiltro(id);
    setNovaAgenda({ nome: "Consultas", responsavel: "", inicio: "08:00", fim: "17:00", cor: "verde" });
    setCriandoAgenda(false);
  }

  function salvarEdicaoAgenda() {
    if (!editandoAgenda || !validarHorarioAgenda(editandoAgenda.inicio, editandoAgenda.fim)) return;
    setAgendas((lista) => lista.map((agenda) => agenda.id === editandoAgenda.id ? { ...editandoAgenda, nome: editandoAgenda.nome.trim() || agenda.nome, responsavel: editandoAgenda.responsavel.trim() || "Sem responsável" } : agenda));
    setEditandoAgenda(null);
  }

  function horarioConflita(agenda: ColunaAgenda, hora: string, duracaoNova: number, eventoId?: string, status?: StatusEvento) {
    if (status === "Cancelado") return false;
    const inicioNovo = horaEmMinutos(hora);
    const fimNovo = inicioNovo + duracaoNova;
    return agenda.eventos.some((evento) => {
      if (evento.id === eventoId || evento.status === "Cancelado") return false;
      const inicioExistente = horaEmMinutos(evento.hora);
      const fimExistente = inicioExistente + duracaoEvento(evento);
      return inicioNovo < fimExistente && fimNovo > inicioExistente;
    });
  }

  function proximoHorarioLivre(agenda: ColunaAgenda, tipo = "Consulta") {
    const duracao = Math.max(5, Number(duracoes[tipo]) || intervaloGrade);
    return gerarHorariosAgenda(agenda, intervaloGrade).find((hora) => !horarioConflita(agenda, hora, duracao)) || null;
  }

  function abrirNovoHorario(agendaId: string, hora?: string) {
    const agenda = agendas.find((item) => item.id === agendaId);
    if (!agenda) return;
    const horaLivre = hora || proximoHorarioLivre(agenda);
    if (!horaLivre) return void toast.error("Não há horário livre nesta agenda.");
    const evento = novoEvento(horaLivre);
    if (horarioConflita(agenda, horaLivre, duracaoEvento(evento))) return void toast.error("Agenda ocupada neste horário. Escolha outro horário disponível.");
    setEventoAberto({ agendaId, evento });
  }

  function salvarEvento(agendaId: string, eventoOriginal: Evento) {
    const agenda = agendas.find((item) => item.id === agendaId);
    if (!agenda) return;
    const tipo = normalizarTipo(eventoOriginal.tipo);
    const evento = ehBloqueio({ tipo })
      ? { ...eventoOriginal, tipo, paciente: "", tutor: "", especie: "Outro" as Especie, origem: "Recepção" as Origem, pagamento: "Isento" as Pagamento, status: "Agendado" as StatusEvento, duracaoMin: Math.max(5, Number(eventoOriginal.duracaoMin) || intervaloGrade) }
      : { ...eventoOriginal, tipo, duracaoMin: undefined };

    const inicioEvento = horaEmMinutos(evento.hora);
    const duracao = duracaoEvento(evento);
    if (inicioEvento < horaEmMinutos(agenda.inicio) || inicioEvento + duracao > horaEmMinutos(agenda.fim)) return void toast.error(`Este atendimento de ${formatarDuracao(duracao)} não cabe no período da agenda (${agenda.inicio} às ${agenda.fim}).`);
    if (horarioConflita(agenda, evento.hora, duracao, evento.id, evento.status)) return void toast.error("Agenda ocupada neste período. Escolha outro horário disponível.");

    setAgendas((lista) => lista.map((item) => {
      if (item.id !== agendaId) return item;
      const existe = item.eventos.some((e) => e.id === evento.id);
      const eventos = existe ? item.eventos.map((e) => e.id === evento.id ? evento : e) : [...item.eventos, evento];
      return { ...item, eventos: ordenarEventos(eventos) };
    }));
    setEventoAberto(null);
  }

  function definirStatus(agendaId: string, eventoId: string, status: StatusEvento) {
    setAgendas((lista) => lista.map((agenda) => agenda.id === agendaId ? { ...agenda, eventos: ordenarEventos(agenda.eventos.map((evento) => evento.id === eventoId ? { ...evento, status } : evento)) } : agenda));
  }

  function liberarAgenda(agendaId: string, evento: Evento) {
    setAgendas((lista) => lista.map((agenda) => {
      if (agenda.id !== agendaId) return agenda;
      if (ehBloqueio(evento)) return { ...agenda, eventos: agenda.eventos.filter((item) => item.id !== evento.id) };
      return { ...agenda, eventos: ordenarEventos(agenda.eventos.map((item) => item.id === evento.id ? { ...item, status: "Cancelado" as StatusEvento } : item)) };
    }));
    setEventoAberto(null);
    toast.success(ehBloqueio(evento) ? "Bloqueio removido. Horário liberado." : "Agendamento cancelado. Horário liberado.");
  }

  function confirmarFinalizacao() {
    if (!confirmacao) return;
    definirStatus(confirmacao.agendaId, confirmacao.evento.id, "Finalizado");
    setConfirmacao(null);
    setEventoAberto(null);
  }

  function eventoQueOcupa(agenda: ColunaAgenda, hora: string) {
    const minuto = horaEmMinutos(hora);
    return agenda.eventos.find((evento) => {
      if (evento.status === "Cancelado") return false;
      const inicio = horaEmMinutos(evento.hora);
      return minuto >= inicio && minuto < inicio + duracaoEvento(evento);
    });
  }

  function slotsDaAgenda(agenda: ColunaAgenda) {
    const horarios = gerarHorariosAgenda(agenda, intervaloGrade);
    const extras = agenda.eventos.filter((evento) => !horarios.includes(evento.hora)).map((evento) => evento.hora);
    return [...new Set([...horarios, ...extras])].sort((a, b) => horaEmMinutos(a) - horaEmMinutos(b));
  }

  return (
    <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2"><CalendarDays size={22} className="text-primary" /><h2 className="text-2xl font-bold">{titulo}</h2></div>
          <p className="mt-1 text-sm text-muted-foreground">{subtitulo}</p>
          <p className="mt-1 text-xs font-semibold text-primary">Grade de {intervaloGrade} em {intervaloGrade} min · duração definida por tipo de atendimento</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={filtro} onChange={(e) => setFiltro(e.target.value)} className="min-h-10 rounded-xl border bg-white px-3 text-sm font-semibold">
            <option value="todas">Todas as agendas</option>
            {agendas.map((agenda) => <option key={agenda.id} value={agenda.id}>{agenda.nome} · {agenda.responsavel}</option>)}
          </select>
          <button type="button" onClick={() => setCriandoAgenda(true)} disabled={agendas.length >= 10} className="inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-sm font-semibold disabled:opacity-40"><Plus size={15} /> Criar agenda</button>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3 rounded-2xl border bg-[#f8faf8] p-3">
        <button type="button" onClick={() => mudarDia(-1)} className="rounded-xl border bg-white p-2.5" aria-label="Dia anterior"><ChevronLeft size={19} /></button>
        <button type="button" onClick={() => setData(new Date())} className="min-w-0 flex-1 px-3 text-center">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">DATA DA AGENDA</div>
          <div className="mt-0.5 text-xl font-black tracking-tight sm:text-2xl">{formatarData(data)}</div>
          <div className="text-[10px] text-muted-foreground">Clique para voltar para hoje</div>
        </button>
        <button type="button" onClick={() => mudarDia(1)} className="rounded-xl border bg-white p-2.5" aria-label="Próximo dia"><ChevronRight size={19} /></button>
      </div>

      <div className="relative mt-4">
        {visiveis.length > 1 && <>
          <button type="button" onClick={() => rolarAgendas(-1)} className="absolute left-1 top-1/2 z-20 -translate-y-1/2 rounded-full border bg-white/95 p-2 shadow-md" aria-label="Agendas anteriores"><ChevronLeft size={20} /></button>
          <button type="button" onClick={() => rolarAgendas(1)} className="absolute right-1 top-1/2 z-20 -translate-y-1/2 rounded-full border bg-white/95 p-2 shadow-md" aria-label="Próximas agendas"><ChevronRight size={20} /></button>
        </>}
        <div ref={trilhoRef} className="flex flex-nowrap gap-3 overflow-x-auto scroll-smooth px-1 pb-2 [scrollbar-width:thin]">
          {visiveis.map((agenda) => {
            const tema = TEMA[agenda.cor];
            return (
              <article key={agenda.id} className={`w-[320px] min-w-[320px] shrink-0 overflow-hidden rounded-xl border-2 bg-[#fcfcfb] sm:w-[340px] sm:min-w-[340px] ${tema.border}`}>
                <header className={`border-b-2 bg-white px-3 py-2.5 ${tema.borderSoft}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2"><span className={`h-2.5 w-2.5 shrink-0 rounded-full ${tema.dot}`} /><h3 className={`truncate text-sm font-bold ${tema.text}`}>{agenda.nome}</h3></div>
                      <p className="mt-0.5 truncate pl-[18px] text-[11px] text-muted-foreground">{agenda.responsavel}</p>
                      <p className={`mt-0.5 pl-[18px] text-[10px] font-semibold ${tema.button}`}>{formatarHora(agenda.inicio)}–{formatarHora(agenda.fim)}</p>
                    </div>
                    <button type="button" onClick={() => setEditandoAgenda({ ...agenda })} className={`rounded-lg p-1.5 ${tema.button} hover:bg-black/5`} aria-label="Editar agenda"><Pencil size={15} /></button>
                  </div>
                </header>

                <div className="p-2">
                  <div className="space-y-1.5">
                    {slotsDaAgenda(agenda).map((hora) => {
                      const evento = eventoQueOcupa(agenda, hora);
                      if (!evento) return (
                        <button key={hora} type="button" onClick={() => abrirNovoHorario(agenda.id, hora)} className={`flex min-h-8 w-full items-center gap-2 rounded-lg border border-dashed bg-white px-2.5 py-1 text-left text-[11px] transition ${tema.freeBorder} ${tema.freeBg}`}>
                          <strong className="w-11 shrink-0 text-slate-700">{formatarHora(hora)}</strong>
                          <span className="font-semibold text-muted-foreground">Livre</span>
                          <span className={`ml-auto text-[10px] font-semibold ${tema.button}`}>+ Agendar</span>
                        </button>
                      );

                      const inicioEvento = evento.hora === hora;
                      if (!inicioEvento) {
                        const fim = minutosEmHora(horaEmMinutos(evento.hora) + duracaoEvento(evento));
                        return (
                          <div key={hora} className={`flex min-h-8 items-center gap-2 rounded-lg border px-2.5 py-1 text-[10px] ${tema.borderSoft} ${tema.bgSoft} ${tema.text}`}>
                            <strong className="w-11 shrink-0">{formatarHora(hora)}</strong>
                            <span className="font-semibold">Ocupado · {evento.tipo}</span>
                            <span className="ml-auto">até {formatarHora(fim)}</span>
                          </div>
                        );
                      }

                      if (ehBloqueio(evento)) return (
                        <button key={evento.id} type="button" onClick={() => setEventoAberto({ agendaId: agenda.id, evento })} className={`flex min-h-11 w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left ${tema.borderSoft} ${tema.bg}`}>
                          <strong className={`w-11 shrink-0 text-[12px] font-black ${tema.text}`}>{formatarHora(evento.hora)}</strong>
                          <Lock size={13} className={`shrink-0 ${tema.button}`} />
                          <div className="min-w-0"><div className={`truncate text-[11px] font-bold ${tema.text}`}>Bloqueio de agenda</div><div className="text-[9px] font-semibold text-slate-500">{formatarDuracao(duracaoEvento(evento))} bloqueado</div></div>
                        </button>
                      );

                      const finalizado = evento.status === "Finalizado";
                      return (
                        <div key={evento.id} className={`rounded-lg border px-2.5 py-1.5 ${tema.borderSoft} ${finalizado ? "bg-slate-50 text-slate-700" : `${tema.bg} ${tema.text}`}`}>
                          <button type="button" onClick={() => setEventoAberto({ agendaId: agenda.id, evento })} className="flex w-full items-center gap-1.5 text-left leading-tight">
                            <strong className="text-[12px] font-black text-slate-900">{formatarHora(evento.hora)}</strong>
                            <span className={`truncate text-[12px] font-bold ${finalizado ? "text-slate-700" : tema.text}`}>{normalizarTipo(evento.tipo)}</span>
                            <span className={`text-[9px] font-semibold opacity-70 ${finalizado ? "text-slate-600" : tema.text}`}>· {formatarDuracao(duracaoEvento(evento))}</span>
                            {finalizado && <span className="ml-auto text-[8px] font-bold uppercase tracking-wide text-slate-500">Finalizado</span>}
                          </button>
                          <button type="button" onClick={() => setAnimalAberto(evento)} className="mt-1 block w-full truncate text-left text-[12px] font-black leading-tight text-slate-950 underline-offset-2 hover:underline"><span className="mr-1" aria-hidden="true">{emojiEspecie(evento.especie)}</span>{evento.paciente.toUpperCase()} <span className="font-medium text-slate-600">({evento.tutor})</span></button>
                          <div className="mt-1 text-[10px] font-semibold leading-tight text-slate-600">{origemCurta(evento.origem)} <span className="px-0.5 text-slate-400">·</span> <span className={evento.pagamento === "Pago" ? "text-emerald-700" : evento.pagamento === "Pendente" ? "text-amber-700" : "text-slate-700"}>{pagamentoLabel(evento.pagamento)}</span></div>
                          {!finalizado ? <button type="button" onClick={() => setConfirmacao({ agendaId: agenda.id, evento })} className={`mt-1 inline-flex items-center gap-1 text-[10px] font-bold leading-tight hover:underline ${tema.button}`}><CheckCircle2 size={12} /> Finalizar atendimento</button> : <button type="button" onClick={() => definirStatus(agenda.id, evento.id, "Em atendimento")} className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold leading-tight text-slate-700 hover:underline"><RotateCcw size={12} /> Voltar atendimento</button>}
                        </div>
                      );
                    })}
                  </div>
                  <button type="button" onClick={() => abrirNovoHorario(agenda.id)} className={`mt-2 w-full rounded-lg border border-dashed px-2 py-1.5 text-[10px] font-semibold ${tema.freeBorder} ${tema.button} ${tema.freeBg}`}>+ Próximo horário livre</button>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {criandoAgenda && <AgendaModal titulo="Criar agenda" value={novaAgenda} onChange={setNovaAgenda} onClose={() => setCriandoAgenda(false)} onSave={criarAgenda} salvarTexto="Criar agenda" />}
      {editandoAgenda && <AgendaModal titulo="Editar agenda" value={{ nome: editandoAgenda.nome, responsavel: editandoAgenda.responsavel, inicio: editandoAgenda.inicio, fim: editandoAgenda.fim, cor: editandoAgenda.cor }} onChange={(value) => setEditandoAgenda({ ...editandoAgenda, ...value })} onClose={() => setEditandoAgenda(null)} onSave={salvarEdicaoAgenda} salvarTexto="Salvar agenda" />}

      {eventoAberto && (() => {
        const agendaAtual = agendas.find((agenda) => agenda.id === eventoAberto.agendaId);
        if (!agendaAtual) return null;
        const existente = agendaAtual.eventos.some((item) => item.id === eventoAberto.evento.id);
        return <EditorEvento value={eventoAberto.evento} agenda={agendaAtual} intervaloGrade={intervaloGrade} duracoes={duracoes} existente={existente} onClose={() => setEventoAberto(null)} onSave={(evento) => salvarEvento(eventoAberto.agendaId, evento)} onFinish={() => setConfirmacao({ agendaId: eventoAberto.agendaId, evento: eventoAberto.evento })} onRelease={(evento) => liberarAgenda(eventoAberto.agendaId, evento)} conflita={(hora, duracao, eventoId, status) => horarioConflita(agendaAtual, hora, duracao, eventoId, status)} />;
      })()}

      {confirmacao && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/35 p-4"><div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"><h3 className="text-xl font-bold">Finalizar atendimento</h3><p className="mt-3 text-sm text-slate-700">Tem certeza que deseja finalizar o atendimento de <strong>{confirmacao.evento.paciente.toUpperCase()}</strong>?</p><div className="mt-5 flex justify-end gap-2"><button onClick={() => setConfirmacao(null)} className="rounded-xl border px-4 py-2.5 font-semibold">Cancelar</button><button onClick={confirmarFinalizacao} className="rounded-xl bg-primary px-4 py-2.5 font-bold text-primary-foreground">Sim, finalizar</button></div></div></div>}

      {animalAberto && !ehBloqueio(animalAberto) && <div className="fixed inset-0 z-50 flex justify-end bg-black/25" onClick={() => setAnimalAberto(null)}><aside onClick={(e) => e.stopPropagation()} className="h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-primary">Ficha do animal</p><h3 className="mt-1 text-3xl font-black">{emojiEspecie(animalAberto.especie)} {animalAberto.paciente.toUpperCase()}</h3><p className="text-muted-foreground">Tutor: {animalAberto.tutor}</p></div><button onClick={() => setAnimalAberto(null)}><X /></button></div><div className="mt-6 grid gap-3"><div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Espécie</p><p className="mt-1 font-bold">{animalAberto.especie || "Outro"}</p></div><div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Atendimento agendado</p><p className="mt-1 font-bold">{animalAberto.tipo} · {animalAberto.hora}</p></div><div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Origem</p><p className="mt-1 font-bold">{animalAberto.origem}</p></div><div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Pagamento</p><p className="mt-1 font-bold">{pagamentoLabel(animalAberto.pagamento)}</p></div></div><div className="mt-6 grid gap-2"><button className="rounded-xl bg-primary px-4 py-3 font-bold text-primary-foreground">Abrir cadastro e prontuário</button><button className="rounded-xl border px-4 py-3 font-semibold">Histórico de atendimentos</button><button className="rounded-xl border px-4 py-3 font-semibold">Exames e receitas</button></div></aside></div>}
    </section>
  );
}

function AgendaModal({ titulo, value, onChange, onClose, onSave, salvarTexto }: { titulo: string; value: AgendaForm; onChange: (value: AgendaForm) => void; onClose: () => void; onSave: () => void; salvarTexto: string }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"><div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"><div className="flex items-center justify-between"><h3 className="text-xl font-bold">{titulo}</h3><button onClick={onClose}><X /></button></div><p className="mt-1 text-sm text-muted-foreground">Defina o nome, responsável, período e cor desta agenda.</p><div className="mt-4 space-y-3"><label className="block text-sm font-semibold">Nome da agenda<input value={value.nome} onChange={(e) => onChange({ ...value, nome: e.target.value })} placeholder="Ex.: Consultas ou Dr. Luciano" className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal" /></label><label className="block text-sm font-semibold">Responsável / descrição<input value={value.responsavel} onChange={(e) => onChange({ ...value, responsavel: e.target.value })} placeholder="Ex.: Dr. Luciano Rodrigues" className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal" /></label><div className="grid grid-cols-2 gap-3"><label className="block text-sm font-semibold">Início<input type="time" value={value.inicio} onChange={(e) => onChange({ ...value, inicio: e.target.value })} className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal" /></label><label className="block text-sm font-semibold">Fim<input type="time" value={value.fim} onChange={(e) => onChange({ ...value, fim: e.target.value })} className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal" /></label></div><div><div className="text-sm font-semibold">Cor da agenda</div><div className="mt-2 grid grid-cols-2 gap-2">{CORES.map((cor) => <button key={cor.value} type="button" onClick={() => onChange({ ...value, cor: cor.value })} className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-left text-sm font-semibold transition ${value.cor === cor.value ? "border-slate-900 bg-slate-50" : "border-slate-200 bg-white"}`}><span className="h-4 w-4 rounded-full border border-black/10" style={{ backgroundColor: cor.preview }} /><span>{cor.label}</span>{value.cor === cor.value && <span className="ml-auto text-xs">✓</span>}</button>)}</div></div><button onClick={onSave} className="w-full rounded-xl bg-primary px-4 py-3 font-bold text-primary-foreground">{salvarTexto}</button></div></div></div>;
}

function EditorEvento({ value, agenda, intervaloGrade, duracoes, existente, onClose, onSave, onFinish, onRelease, conflita }: { value: Evento; agenda: ColunaAgenda; intervaloGrade: number; duracoes: Duracoes; existente: boolean; onClose: () => void; onSave: (evento: Evento) => void; onFinish: () => void; onRelease: (evento: Evento) => void; conflita: (hora: string, duracao: number, eventoId?: string, status?: StatusEvento) => boolean }) {
  const [evento, setEvento] = useState<Evento>({ ...value, tipo: normalizarTipo(value.tipo), especie: value.especie || "Outro" });
  const bloqueio = ehBloqueio(evento);
  const duracaoAtual = bloqueio ? Math.max(5, Number(evento.duracaoMin) || intervaloGrade) : Math.max(5, Number(duracoes[evento.tipo]) || intervaloGrade);
  const horarios = useMemo(() => gerarHorariosAgenda(agenda, intervaloGrade), [agenda, intervaloGrade]);
  const horariosComAtual = useMemo(() => horarios.includes(evento.hora) ? horarios : [...horarios, evento.hora].sort((a, b) => horaEmMinutos(a) - horaEmMinutos(b)), [horarios, evento.hora]);

  function alterarTipo(tipoOriginal: string) {
    const tipo = normalizarTipo(tipoOriginal);
    setEvento((atual) => ({ ...atual, tipo, ...(tipo === TIPO_BLOQUEIO ? { paciente: "", tutor: "", especie: "Outro" as Especie, origem: "Recepção" as Origem, pagamento: "Isento" as Pagamento, status: "Agendado" as StatusEvento, duracaoMin: intervaloGrade } : { duracaoMin: undefined }) }));
  }

  function liberar() {
    const mensagem = bloqueio ? "Tem certeza que deseja remover este bloqueio e liberar o horário?" : "Tem certeza que deseja cancelar este agendamento e liberar o horário?";
    if (window.confirm(mensagem)) onRelease(evento);
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"><div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl"><div className="flex items-center justify-between"><h3 className="text-xl font-bold">{bloqueio ? "Editar bloqueio" : "Editar agendamento"}</h3><button onClick={onClose}><X /></button></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">Horário<select value={evento.hora} onChange={(e) => setEvento({ ...evento, hora: e.target.value })} className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal">{horariosComAtual.map((hora) => { const ocupado = hora !== value.hora && conflita(hora, duracaoAtual, evento.id, evento.status); return <option key={hora} value={hora} disabled={ocupado}>{hora}{ocupado ? " — ocupado" : ""}</option>; })}</select><span className="mt-1 block text-[11px] font-medium text-muted-foreground">{agenda.inicio}–{agenda.fim} · grade de {intervaloGrade} min.</span></label><label className="text-sm font-semibold">Tipo<select value={evento.tipo} onChange={(e) => alterarTipo(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal">{TIPOS_SELETOR.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}</select><span className="mt-1 block text-[11px] font-semibold text-primary">Duração: {formatarDuracao(duracaoAtual)}</span></label>{bloqueio ? <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700"><div className="flex items-center gap-2 font-bold"><Lock size={16} /> Horário bloqueado</div><p className="mt-1 text-xs text-slate-500">Escolha por quanto tempo este bloqueio ocupa a agenda.</p><label className="mt-3 block text-sm font-semibold">Tempo do bloqueio<input type="number" min={5} max={720} step={5} value={evento.duracaoMin || intervaloGrade} onChange={(e) => setEvento({ ...evento, duracaoMin: Number(e.target.value) })} className="mt-1 min-h-11 w-full rounded-xl border bg-white px-3 font-normal" /></label></div> : <><label className="text-sm font-semibold">Animal<input value={evento.paciente} onChange={(e) => setEvento({ ...evento, paciente: e.target.value })} className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal" /></label><label className="text-sm font-semibold">Tutor<input value={evento.tutor} onChange={(e) => setEvento({ ...evento, tutor: e.target.value })} className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal" /></label><label className="text-sm font-semibold">Espécie<select value={evento.especie || "Outro"} onChange={(e) => setEvento({ ...evento, especie: e.target.value as Especie })} className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal">{ESPECIES.map((especie) => <option key={especie} value={especie}>{emojiEspecie(especie)} {especie}</option>)}</select></label><label className="text-sm font-semibold">Quem marcou<select value={evento.origem} onChange={(e) => setEvento({ ...evento, origem: e.target.value as Origem })} className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal"><option>Tutor no app</option><option>Recepção</option></select></label><label className="text-sm font-semibold">Pagamento<select value={evento.pagamento} onChange={(e) => setEvento({ ...evento, pagamento: e.target.value as Pagamento })} className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal"><option>Pago</option><option value="Pendente">Pagamento pendente</option><option value="Presencial">Pagamento presencial</option><option>Isento</option></select></label><label className="text-sm font-semibold">Status<select value={evento.status} onChange={(e) => setEvento({ ...evento, status: e.target.value as StatusEvento })} className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal"><option>Agendado</option><option>Em atendimento</option><option>Finalizado</option><option>Cancelado</option></select></label></>}</div><div className="mt-5 flex flex-wrap justify-end gap-2">{!bloqueio && <button onClick={onFinish} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 font-semibold text-emerald-700"><CheckCircle2 size={16} /> Finalizar</button>}<button onClick={() => onSave(evento)} className="rounded-xl bg-primary px-4 py-2.5 font-bold text-primary-foreground">{bloqueio ? "Salvar bloqueio" : "Salvar alterações"}</button></div>{existente && <button type="button" onClick={liberar} className="mt-3 w-full rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 font-semibold text-rose-700 hover:bg-rose-100">Liberar agenda</button>}<p className="mt-3 text-[11px] text-muted-foreground">Agenda: {agenda.nome} · horários ocupados e bloqueados ficam indisponíveis.</p></div></div>;
}
