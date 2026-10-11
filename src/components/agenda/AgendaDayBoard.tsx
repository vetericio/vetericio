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
type Tom = "azul" | "verde" | "amarelo" | "rosa" | "roxo" | "cinza" | "teal";
type Origem = "Tutor no app" | "Recepção";
type Pagamento = "Pago" | "Pendente" | "Presencial" | "Isento";
type StatusEvento = "Agendado" | "Em atendimento" | "Finalizado" | "Cancelado";
type Especie = "Cão" | "Gato" | "Ave" | "Hamster" | "Cobra" | "Bovino" | "Equino" | "Outro";

const TIPO_BLOQUEIO = "Bloqueio de agenda";
const TIPO_BANHO_TOSA = "Banho e Tosa";

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
  tom: Tom;
};

type ColunaAgenda = {
  id: string;
  nome: string;
  responsavel: string;
  inicio: string;
  fim: string;
  eventos: Evento[];
};

type AgendaForm = {
  nome: string;
  responsavel: string;
  inicio: string;
  fim: string;
};

const BASE: ColunaAgenda[] = [
  {
    id: "agenda-1",
    nome: "Agenda 1",
    responsavel: "Dra. Ana Costa",
    inicio: "08:00",
    fim: "17:00",
    eventos: [
      { id: "e1", hora: "08:00", tipo: "Consulta", paciente: "Max", tutor: "Carlos Souza", especie: "Cão", origem: "Tutor no app", pagamento: "Pago", status: "Agendado", tom: "azul" },
      { id: "e2", hora: "09:30", tipo: "Vacina", paciente: "Luna", tutor: "Renata Lima", especie: "Gato", origem: "Recepção", pagamento: "Presencial", status: "Agendado", tom: "verde" },
    ],
  },
  {
    id: "agenda-2",
    nome: "Agenda 2",
    responsavel: "Dr. Bruno Almeida",
    inicio: "08:00",
    fim: "17:00",
    eventos: [
      { id: "e3", hora: "08:30", tipo: TIPO_BANHO_TOSA, paciente: "Mel", tutor: "Paula Costa", especie: "Cão", origem: "Tutor no app", pagamento: "Pago", status: "Agendado", tom: "roxo" },
    ],
  },
  {
    id: "agenda-3",
    nome: "Agenda 3",
    responsavel: "Dra. Juliana Ribeiro",
    inicio: "09:00",
    fim: "15:00",
    eventos: [
      { id: "e4", hora: "09:00", tipo: "Retorno", paciente: "Bidu", tutor: "André Martins", especie: "Ave", origem: "Recepção", pagamento: "Pendente", status: "Agendado", tom: "amarelo" },
    ],
  },
];

const TOM: Record<Tom, string> = {
  azul: "bg-sky-50 text-sky-800 border-sky-100",
  verde: "bg-emerald-50 text-emerald-800 border-emerald-100",
  amarelo: "bg-amber-50 text-amber-800 border-amber-100",
  rosa: "bg-rose-50 text-rose-800 border-rose-100",
  roxo: "bg-violet-50 text-violet-800 border-violet-100",
  cinza: "bg-slate-100 text-slate-800 border-slate-200",
  teal: "bg-teal-50 text-teal-800 border-teal-100",
};

const TIPOS: Record<string, Tom> = {
  Consulta: "azul",
  Retorno: "amarelo",
  Cirurgia: "rosa",
  [TIPO_BANHO_TOSA]: "roxo",
  Banho: "roxo",
  Tosa: "roxo",
  Vacina: "verde",
  Procedimento: "teal",
  [TIPO_BLOQUEIO]: "cinza",
};

const TIPOS_SELETOR = ["Consulta", "Retorno", "Cirurgia", TIPO_BANHO_TOSA, "Vacina", "Procedimento", TIPO_BLOQUEIO];
const ESPECIES: Especie[] = ["Cão", "Gato", "Ave", "Hamster", "Cobra", "Bovino", "Equino", "Outro"];

function normalizarTipo(tipo: string) {
  if (tipo === "Banho" || tipo === "Tosa") return TIPO_BANHO_TOSA;
  return tipo;
}

function corDoTipo(tipo: string): Tom {
  return TIPOS[normalizarTipo(tipo)] || "azul";
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

function formatarData(data: Date) {
  return data.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).toUpperCase();
}

function formatarHora(hora: string) {
  const [h = "0", m = "00"] = hora.split(":");
  return `${Number(h)}h${m}`;
}

function origemCurta(origem: Origem) {
  return origem === "Tutor no app" ? "Tutor APP" : "Recepção";
}

function horaEmMinutos(hora: string) {
  const [h = "0", m = "0"] = hora.split(":");
  return Math.max(0, Math.min(1439, Number(h) * 60 + Number(m)));
}

function minutosEmHora(total: number) {
  const seguro = Math.max(0, Math.min(1439, total));
  const h = Math.floor(seguro / 60);
  const m = seguro % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function gerarHorariosAgenda(agenda: Pick<ColunaAgenda, "inicio" | "fim">, duracao: number) {
  const intervalo = Math.max(5, Number(duracao) || 30);
  const inicio = horaEmMinutos(agenda.inicio || "08:00");
  const fim = horaEmMinutos(agenda.fim || "17:00");
  const horarios: string[] = [];
  for (let minuto = inicio; minuto + intervalo <= fim; minuto += intervalo) horarios.push(minutosEmHora(minuto));
  return horarios;
}

function ordenarEventos(eventos: Evento[]) {
  return [...eventos].sort((a, b) => horaEmMinutos(a.hora) - horaEmMinutos(b.hora));
}

function normalizarAgendas(agendas: ColunaAgenda[]) {
  return agendas.map((agenda) => ({
    ...agenda,
    inicio: agenda.inicio || "08:00",
    fim: agenda.fim || "17:00",
    eventos: ordenarEventos((agenda.eventos || []).map((evento) => {
      const tipo = normalizarTipo(evento.tipo);
      return { ...evento, tipo, especie: evento.especie || "Outro", tom: corDoTipo(tipo) };
    })),
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
    tom: "azul",
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
  const [novaAgenda, setNovaAgenda] = useState<AgendaForm>({ nome: "Consultas", responsavel: "", inicio: "08:00", fim: "17:00" });
  const [duracaoPadrao, setDuracaoPadrao] = useState(30);
  const trilhoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem("oricse-agendas-v2", JSON.stringify(normalizarAgendas(agendas)));
  }, [agendas]);

  useEffect(() => {
    let ativo = true;
    async function carregarDuracaoDaClinica() {
      try {
        const { data: authData } = await supabase.auth.getUser();
        const userId = authData.user?.id;
        if (!userId) return;
        const { data: vinculo } = await (supabase as any).from("clinica_usuarios").select("clinica_id").eq("user_id", userId).eq("ativo", true).limit(1).maybeSingle();
        if (!vinculo?.clinica_id) return;
        const { data: clinica } = await (supabase as any).from("clinicas").select("duracao_padrao_atendimento_min").eq("id", vinculo.clinica_id).maybeSingle();
        const valor = Number(clinica?.duracao_padrao_atendimento_min);
        if (ativo && Number.isFinite(valor) && valor >= 5 && valor <= 720) setDuracaoPadrao(valor);
      } catch (error) {
        console.error("Não foi possível carregar a duração padrão da clínica:", error);
      }
    }
    void carregarDuracaoDaClinica();
    return () => { ativo = false; };
  }, []);

  const visiveis = useMemo(() => filtro === "todas" ? agendas : agendas.filter((agenda) => agenda.id === filtro), [agendas, filtro]);
  const titulo = mode === "recepcao" ? "Agenda do dia" : "Minha agenda";
  const subtitulo = mode === "recepcao" ? "Visualize os horários da clínica, organize chegadas e acompanhe a fila." : "Acompanhe consultas, retornos e procedimentos previstos para hoje.";

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
    setAgendas((lista) => [...lista, { id, nome: novaAgenda.nome.trim() || `Agenda ${agendas.length + 1}`, responsavel: novaAgenda.responsavel.trim() || "Sem responsável", inicio: novaAgenda.inicio, fim: novaAgenda.fim, eventos: [] }]);
    setFiltro(id);
    setNovaAgenda({ nome: "Consultas", responsavel: "", inicio: "08:00", fim: "17:00" });
    setCriandoAgenda(false);
  }

  function salvarEdicaoAgenda() {
    if (!editandoAgenda) return;
    if (!validarHorarioAgenda(editandoAgenda.inicio, editandoAgenda.fim)) return;
    setAgendas((lista) => lista.map((agenda) => agenda.id === editandoAgenda.id ? { ...editandoAgenda, nome: editandoAgenda.nome.trim() || agenda.nome, responsavel: editandoAgenda.responsavel.trim() || "Sem responsável" } : agenda));
    setEditandoAgenda(null);
  }

  function horarioConflita(agenda: ColunaAgenda, hora: string, eventoId?: string, status?: StatusEvento) {
    if (status === "Cancelado") return false;
    const inicioNovo = horaEmMinutos(hora);
    const fimNovo = inicioNovo + duracaoPadrao;
    return agenda.eventos.some((evento) => {
      if (evento.id === eventoId || evento.status === "Cancelado") return false;
      const inicioExistente = horaEmMinutos(evento.hora);
      const fimExistente = inicioExistente + duracaoPadrao;
      return inicioNovo < fimExistente && fimNovo > inicioExistente;
    });
  }

  function proximoHorarioLivre(agenda: ColunaAgenda) {
    return gerarHorariosAgenda(agenda, duracaoPadrao).find((hora) => !horarioConflita(agenda, hora)) || null;
  }

  function abrirNovoHorario(agendaId: string, hora?: string) {
    const agenda = agendas.find((item) => item.id === agendaId);
    if (!agenda) return;
    const horaLivre = hora || proximoHorarioLivre(agenda);
    if (!horaLivre) return void toast.error("Não há horário livre nesta agenda para a duração configurada.");
    if (horarioConflita(agenda, horaLivre)) return void toast.error("Agenda ocupada neste horário. Escolha outro horário disponível.");
    setEventoAberto({ agendaId, evento: novoEvento(horaLivre) });
  }

  function salvarEvento(agendaId: string, eventoOriginal: Evento) {
    const agenda = agendas.find((item) => item.id === agendaId);
    if (!agenda) return;
    const tipo = normalizarTipo(eventoOriginal.tipo);
    const evento = ehBloqueio({ tipo })
      ? { ...eventoOriginal, tipo, paciente: "", tutor: "", especie: "Outro" as Especie, origem: "Recepção" as Origem, pagamento: "Isento" as Pagamento, status: "Agendado" as StatusEvento, tom: "cinza" as Tom }
      : { ...eventoOriginal, tipo, tom: corDoTipo(tipo) };

    const inicioEvento = horaEmMinutos(evento.hora);
    if (inicioEvento < horaEmMinutos(agenda.inicio) || inicioEvento + duracaoPadrao > horaEmMinutos(agenda.fim)) return void toast.error(`Este horário está fora do funcionamento da agenda (${agenda.inicio} às ${agenda.fim}).`);
    if (horarioConflita(agenda, evento.hora, evento.id, evento.status)) return void toast.error("Agenda ocupada neste horário. Escolha outro horário disponível.");

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

  function confirmarFinalizacao() {
    if (!confirmacao) return;
    definirStatus(confirmacao.agendaId, confirmacao.evento.id, "Finalizado");
    setConfirmacao(null);
    setEventoAberto(null);
  }

  function slotsDaAgenda(agenda: ColunaAgenda) {
    const horarios = gerarHorariosAgenda(agenda, duracaoPadrao);
    const extras = agenda.eventos.filter((evento) => !horarios.includes(evento.hora)).map((evento) => evento.hora);
    return [...new Set([...horarios, ...extras])].sort((a, b) => horaEmMinutos(a) - horaEmMinutos(b));
  }

  return (
    <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2"><CalendarDays size={22} className="text-primary" /><h2 className="text-2xl font-bold">{titulo}</h2></div>
          <p className="mt-1 text-sm text-muted-foreground">{subtitulo}</p>
          <p className="mt-1 text-xs font-semibold text-primary">Intervalo definido pela clínica: {duracaoPadrao} min</p>
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
        {visiveis.length > 1 && (
          <>
            <button type="button" onClick={() => rolarAgendas(-1)} className="absolute left-1 top-1/2 z-20 -translate-y-1/2 rounded-full border bg-white/95 p-2 shadow-md" aria-label="Agendas anteriores"><ChevronLeft size={20} /></button>
            <button type="button" onClick={() => rolarAgendas(1)} className="absolute right-1 top-1/2 z-20 -translate-y-1/2 rounded-full border bg-white/95 p-2 shadow-md" aria-label="Próximas agendas"><ChevronRight size={20} /></button>
          </>
        )}
        <div ref={trilhoRef} className="flex flex-nowrap gap-3 overflow-x-auto scroll-smooth px-1 pb-2 [scrollbar-width:thin]">
          {visiveis.map((agenda) => (
            <article key={agenda.id} className="w-[320px] min-w-[320px] shrink-0 overflow-hidden rounded-xl border bg-[#fcfcfb] sm:w-[340px] sm:min-w-[340px]">
              <header className="border-b bg-white px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-600" /><h3 className="truncate text-sm font-bold">{agenda.nome}</h3></div>
                    <p className="mt-0.5 truncate pl-[18px] text-[11px] text-muted-foreground">{agenda.responsavel}</p>
                    <p className="mt-0.5 pl-[18px] text-[10px] font-semibold text-primary">{formatarHora(agenda.inicio)}–{formatarHora(agenda.fim)}</p>
                  </div>
                  <button type="button" onClick={() => setEditandoAgenda({ ...agenda })} className="rounded-lg p-1.5 text-muted-foreground hover:bg-slate-100" aria-label="Editar agenda"><Pencil size={15} /></button>
                </div>
              </header>

              <div className="p-2">
                <div className="space-y-1.5">
                  {slotsDaAgenda(agenda).map((hora) => {
                    const evento = agenda.eventos.find((item) => item.hora === hora && item.status !== "Cancelado");
                    if (!evento) return (
                      <button key={hora} type="button" onClick={() => abrirNovoHorario(agenda.id, hora)} className="flex min-h-8 w-full items-center gap-2 rounded-lg border border-dashed border-slate-200 bg-white px-2.5 py-1 text-left text-[11px] transition hover:border-primary hover:bg-primary/5">
                        <strong className="w-11 shrink-0 text-slate-700">{formatarHora(hora)}</strong><span className="font-semibold text-muted-foreground">Livre</span><span className="ml-auto text-[10px] font-semibold text-primary">+ Agendar</span>
                      </button>
                    );

                    if (ehBloqueio(evento)) return (
                      <button key={evento.id} type="button" onClick={() => setEventoAberto({ agendaId: agenda.id, evento })} className="flex min-h-11 w-full items-center gap-2 rounded-lg border border-slate-300 bg-slate-100 px-2.5 py-1.5 text-left">
                        <strong className="w-11 shrink-0 text-[12px] font-black text-slate-900">{formatarHora(evento.hora)}</strong><Lock size={13} className="shrink-0 text-slate-600" /><div className="min-w-0"><div className="truncate text-[11px] font-bold text-slate-800">Bloqueio de agenda</div><div className="text-[9px] font-semibold text-slate-500">Horário bloqueado</div></div>
                      </button>
                    );

                    const finalizado = evento.status === "Finalizado";
                    const tom = corDoTipo(evento.tipo);
                    return (
                      <div key={evento.id} className={`rounded-lg border px-2.5 py-1.5 ${finalizado ? "border-slate-200 bg-slate-50 text-slate-700" : TOM[tom]}`}>
                        <button type="button" onClick={() => setEventoAberto({ agendaId: agenda.id, evento })} className="flex w-full items-center gap-1.5 text-left leading-tight"><strong className="text-[12px] font-black text-slate-900">{formatarHora(evento.hora)}</strong><span className="truncate text-[12px] font-bold">{normalizarTipo(evento.tipo)}</span>{finalizado && <span className="ml-auto text-[8px] font-bold uppercase tracking-wide text-slate-500">Finalizado</span>}</button>
                        <button type="button" onClick={() => setAnimalAberto(evento)} className="mt-1 block w-full truncate text-left text-[12px] font-black leading-tight text-slate-950 underline-offset-2 hover:underline"><span className="mr-1" aria-hidden="true">{emojiEspecie(evento.especie)}</span>{evento.paciente.toUpperCase()} <span className="font-medium text-slate-600">({evento.tutor})</span></button>
                        <div className="mt-1 text-[10px] font-semibold leading-tight text-slate-600">{origemCurta(evento.origem)} <span className="px-0.5 text-slate-400">·</span> <span className={evento.pagamento === "Pago" ? "text-emerald-700" : evento.pagamento === "Pendente" ? "text-amber-700" : "text-slate-700"}>{pagamentoLabel(evento.pagamento)}</span></div>
                        {!finalizado ? <button type="button" onClick={() => setConfirmacao({ agendaId: agenda.id, evento })} className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold leading-tight text-emerald-700 hover:underline"><CheckCircle2 size={12} /> Finalizar atendimento</button> : <button type="button" onClick={() => definirStatus(agenda.id, evento.id, "Em atendimento")} className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold leading-tight text-slate-700 hover:underline"><RotateCcw size={12} /> Voltar atendimento</button>}
                      </div>
                    );
                  })}
                </div>
                <button type="button" onClick={() => abrirNovoHorario(agenda.id)} className="mt-2 w-full rounded-lg border border-dashed px-2 py-1.5 text-[10px] font-semibold text-muted-foreground hover:border-primary hover:text-primary">+ Próximo horário livre</button>
              </div>
            </article>
          ))}
        </div>
      </div>

      {criandoAgenda && <AgendaModal titulo="Criar agenda" value={novaAgenda} onChange={setNovaAgenda} onClose={() => setCriandoAgenda(false)} onSave={criarAgenda} salvarTexto="Criar agenda" />}
      {editandoAgenda && <AgendaModal titulo="Editar agenda" value={{ nome: editandoAgenda.nome, responsavel: editandoAgenda.responsavel, inicio: editandoAgenda.inicio, fim: editandoAgenda.fim }} onChange={(value) => setEditandoAgenda({ ...editandoAgenda, ...value })} onClose={() => setEditandoAgenda(null)} onSave={salvarEdicaoAgenda} salvarTexto="Salvar agenda" />}

      {eventoAberto && (() => {
        const agendaAtual = agendas.find((agenda) => agenda.id === eventoAberto.agendaId);
        if (!agendaAtual) return null;
        return <EditorEvento value={eventoAberto.evento} agenda={agendaAtual} duracaoPadrao={duracaoPadrao} onClose={() => setEventoAberto(null)} onSave={(evento) => salvarEvento(eventoAberto.agendaId, evento)} onFinish={() => setConfirmacao({ agendaId: eventoAberto.agendaId, evento: eventoAberto.evento })} conflita={(hora, eventoId, status) => horarioConflita(agendaAtual, hora, eventoId, status)} />;
      })()}

      {confirmacao && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/35 p-4"><div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"><h3 className="text-xl font-bold">Finalizar atendimento</h3><p className="mt-3 text-sm text-slate-700">Tem certeza que deseja finalizar o atendimento de <strong>{confirmacao.evento.paciente.toUpperCase()}</strong>?</p><div className="mt-5 flex justify-end gap-2"><button onClick={() => setConfirmacao(null)} className="rounded-xl border px-4 py-2.5 font-semibold">Cancelar</button><button onClick={confirmarFinalizacao} className="rounded-xl bg-primary px-4 py-2.5 font-bold text-primary-foreground">Sim, finalizar</button></div></div></div>}

      {animalAberto && !ehBloqueio(animalAberto) && <div className="fixed inset-0 z-50 flex justify-end bg-black/25" onClick={() => setAnimalAberto(null)}><aside onClick={(e) => e.stopPropagation()} className="h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-primary">Ficha do animal</p><h3 className="mt-1 text-3xl font-black">{emojiEspecie(animalAberto.especie)} {animalAberto.paciente.toUpperCase()}</h3><p className="text-muted-foreground">Tutor: {animalAberto.tutor}</p></div><button onClick={() => setAnimalAberto(null)}><X /></button></div><div className="mt-6 grid gap-3"><div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Espécie</p><p className="mt-1 font-bold">{animalAberto.especie || "Outro"}</p></div><div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Atendimento agendado</p><p className="mt-1 font-bold">{animalAberto.tipo} · {animalAberto.hora}</p></div><div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Origem</p><p className="mt-1 font-bold">{animalAberto.origem}</p></div><div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Pagamento</p><p className="mt-1 font-bold">{pagamentoLabel(animalAberto.pagamento)}</p></div></div><div className="mt-6 grid gap-2"><button className="rounded-xl bg-primary px-4 py-3 font-bold text-primary-foreground">Abrir cadastro e prontuário</button><button className="rounded-xl border px-4 py-3 font-semibold">Histórico de atendimentos</button><button className="rounded-xl border px-4 py-3 font-semibold">Exames e receitas</button></div></aside></div>}
    </section>
  );
}

function AgendaModal({ titulo, value, onChange, onClose, onSave, salvarTexto }: { titulo: string; value: AgendaForm; onChange: (value: AgendaForm) => void; onClose: () => void; onSave: () => void; salvarTexto: string; }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"><div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"><div className="flex items-center justify-between"><h3 className="text-xl font-bold">{titulo}</h3><button onClick={onClose}><X /></button></div><p className="mt-1 text-sm text-muted-foreground">Defina o nome, responsável e o período de funcionamento desta agenda.</p><div className="mt-4 space-y-3"><label className="block text-sm font-semibold">Nome da agenda<input value={value.nome} onChange={(e) => onChange({ ...value, nome: e.target.value })} placeholder="Ex.: Consultas ou Dr. Luciano" className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal" /></label><label className="block text-sm font-semibold">Responsável / descrição<input value={value.responsavel} onChange={(e) => onChange({ ...value, responsavel: e.target.value })} placeholder="Ex.: Dr. Luciano Rodrigues" className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal" /></label><div className="grid grid-cols-2 gap-3"><label className="block text-sm font-semibold">Início<input type="time" value={value.inicio} onChange={(e) => onChange({ ...value, inicio: e.target.value })} className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal" /></label><label className="block text-sm font-semibold">Fim<input type="time" value={value.fim} onChange={(e) => onChange({ ...value, fim: e.target.value })} className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal" /></label></div><button onClick={onSave} className="w-full rounded-xl bg-primary px-4 py-3 font-bold text-primary-foreground">{salvarTexto}</button></div></div></div>;
}

function EditorEvento({ value, agenda, duracaoPadrao, onClose, onSave, onFinish, conflita }: { value: Evento; agenda: ColunaAgenda; duracaoPadrao: number; onClose: () => void; onSave: (evento: Evento) => void; onFinish: () => void; conflita: (hora: string, eventoId?: string, status?: StatusEvento) => boolean; }) {
  const [evento, setEvento] = useState<Evento>({ ...value, tipo: normalizarTipo(value.tipo), especie: value.especie || "Outro", tom: corDoTipo(value.tipo) });
  const bloqueio = ehBloqueio(evento);
  const horarios = useMemo(() => gerarHorariosAgenda(agenda, duracaoPadrao), [agenda, duracaoPadrao]);
  const horariosComAtual = useMemo(() => horarios.includes(evento.hora) ? horarios : [...horarios, evento.hora].sort((a, b) => horaEmMinutos(a) - horaEmMinutos(b)), [horarios, evento.hora]);

  function alterarTipo(tipoOriginal: string) {
    const tipo = normalizarTipo(tipoOriginal);
    setEvento((atual) => ({ ...atual, tipo, tom: corDoTipo(tipo), ...(tipo === TIPO_BLOQUEIO ? { paciente: "", tutor: "", especie: "Outro" as Especie, origem: "Recepção" as Origem, pagamento: "Isento" as Pagamento, status: "Agendado" as StatusEvento } : {}) }));
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"><div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl"><div className="flex items-center justify-between"><h3 className="text-xl font-bold">{bloqueio ? "Editar bloqueio" : "Editar agendamento"}</h3><button onClick={onClose}><X /></button></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">Horário<select value={evento.hora} onChange={(e) => setEvento({ ...evento, hora: e.target.value })} className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal">{horariosComAtual.map((hora) => { const ocupado = hora !== value.hora && conflita(hora, evento.id, evento.status); return <option key={hora} value={hora} disabled={ocupado}>{hora}{ocupado ? " — ocupado" : ""}</option>; })}</select><span className="mt-1 block text-[11px] font-medium text-muted-foreground">{agenda.inicio}–{agenda.fim} · intervalos de {duracaoPadrao} min.</span></label><label className="text-sm font-semibold">Tipo<select value={evento.tipo} onChange={(e) => alterarTipo(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal">{TIPOS_SELETOR.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}</select></label>{bloqueio ? <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700"><div className="flex items-center gap-2 font-bold"><Lock size={16} /> Horário bloqueado</div><p className="mt-1 text-xs text-slate-500">Este bloqueio ocupa 1 intervalo de {duracaoPadrao} minutos. Nenhum dado de paciente é necessário.</p></div> : <><label className="text-sm font-semibold">Animal<input value={evento.paciente} onChange={(e) => setEvento({ ...evento, paciente: e.target.value })} className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal" /></label><label className="text-sm font-semibold">Tutor<input value={evento.tutor} onChange={(e) => setEvento({ ...evento, tutor: e.target.value })} className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal" /></label><label className="text-sm font-semibold">Espécie<select value={evento.especie || "Outro"} onChange={(e) => setEvento({ ...evento, especie: e.target.value as Especie })} className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal">{ESPECIES.map((especie) => <option key={especie} value={especie}>{emojiEspecie(especie)} {especie}</option>)}</select></label><label className="text-sm font-semibold">Quem marcou<select value={evento.origem} onChange={(e) => setEvento({ ...evento, origem: e.target.value as Origem })} className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal"><option>Tutor no app</option><option>Recepção</option></select></label><label className="text-sm font-semibold">Pagamento<select value={evento.pagamento} onChange={(e) => setEvento({ ...evento, pagamento: e.target.value as Pagamento })} className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal"><option>Pago</option><option value="Pendente">Pagamento pendente</option><option value="Presencial">Pagamento presencial</option><option>Isento</option></select></label><label className="text-sm font-semibold">Status<select value={evento.status} onChange={(e) => setEvento({ ...evento, status: e.target.value as StatusEvento })} className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal"><option>Agendado</option><option>Em atendimento</option><option>Finalizado</option><option>Cancelado</option></select></label></>}</div><div className="mt-5 flex flex-wrap justify-end gap-2">{!bloqueio && <button onClick={onFinish} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 font-semibold text-emerald-700"><CheckCircle2 size={16} /> Finalizar</button>}<button onClick={() => onSave(evento)} className="rounded-xl bg-primary px-4 py-2.5 font-bold text-primary-foreground">{bloqueio ? "Salvar bloqueio" : "Salvar alterações"}</button></div><p className="mt-3 text-[11px] text-muted-foreground">Agenda: {agenda.nome} · horários ocupados e bloqueados ficam indisponíveis.</p></div></div>;
}
