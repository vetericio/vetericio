import { useNavigate } from "@tanstack/react-router";
import {
  Component,
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ErrorInfo,
  type ReactNode,
} from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Lock,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { DURACOES_ATENDIMENTO, intervaloNovaAgenda } from "@/lib/configuracoes-clinica";
import { supabaseBanco as supabase } from "@/integrations/supabase/client";
import { salvarAgendaOnline } from "@/lib/agenda.functions";
import { cancelarAgendamentoPolitica } from "@/lib/agenda-politicas.functions";
import { usePermissoes } from "@/hooks/usePermissoes";
import { CadastroTutor } from "@/routes/tutores";
import { CadastroAnimal } from "@/routes/novo-animal";
import { AgendaEscolherPaciente, type PetAgenda, type TutorAgenda } from "./AgendaEscolherPaciente";
import { AgendaCalendarioPeriodo } from "./AgendaCalendarioPeriodo";
import { AgendaHistorico } from "./AgendaHistorico";
import {
  STATUS_AGENDA,
  STATUS_BANHO,
  acoesAgenda,
  diasDaVisaoAgenda,
  moverVisaoAgenda,
  statusAgenda,
  type VisaoAgenda,
} from "@/lib/agenda-operacional";

export type AgendaMode = "recepcao" | "veterinario" | "banho";
type CorAgenda =
  | "azul"
  | "verde"
  | "amarelo"
  | "vermelho"
  | "rosa"
  | "laranja"
  | "roxo"
  | "marrom"
  | "cinza"
  | "azul-petroleo";
type Modalidade = "livre" | "aprovacao" | "pagamento";
type Pagamento = "Estornado" | "Pago" | "Pendente" | "Presencial" | "Isento";

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
  pagamento_valor: number | null;
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
  serie_id: string | null;
  serie_excecao: boolean;
  pagamento_expira_em: string | null;
  pagamento_confirmado_em: string | null;
  updated_at: string | null;
  profissional_banho?: string;
  dados: Record<string, unknown> | null;
};

type TutorDb = TutorAgenda;
type AnimalDb = PetAgenda;
type ClinicaConfig = {
  duracao_padrao_atendimento_min: number | null;
  duracoes_atendimento_min: Record<string, number> | null;
};

type AgendaForm = {
  nome: string;
  responsavel: string;
  tipo: string;
  inicio: string;
  fim: string;
  diasSemana: number[];
  intervaloMin: number;
  portalAtivo: boolean;
  pagamentoValor: string;
  modalidade: Modalidade;
  antecedenciaHoras: number;
  timezone: string;
  cor: CorAgenda;
};

type EventoForm = {
  data: string;
  repeticoes: number;
  passoDias: number;
  serieToda: boolean;
  tipo: string;
  hora: string;
  duracaoMin: number;
  tutorId: string;
  animalId: string;
  pagamento: Pagamento;
  observacoes: string;
};

const TIPO_BLOQUEIO = "Bloqueio de agenda";
const TIPOS_EVENTO = [
  "Consulta",
  "Retorno",
  "Cirurgia",
  "Banho e Tosa",
  "Vacina",
  "Procedimento",
  TIPO_BLOQUEIO,
];
const TIPOS_AGENDA_CLINICA = ["Consultório", "Cirurgia", "Procedimentos", "Vacinação", "Geral"];
const TIPOS_AGENDA_BANHO = ["Banho", "Tosa", "Banho e Tosa"];
const DIAS = [
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
  { value: 0, label: "Dom" },
];
const CORES: CorAgenda[] = [
  "verde",
  "azul",
  "roxo",
  "laranja",
  "rosa",
  "amarelo",
  "vermelho",
  "marrom",
  "cinza",
  "azul-petroleo",
];
const DURACOES_PADRAO: Record<string, number> = { ...DURACOES_ATENDIMENTO, [TIPO_BLOQUEIO]: 30 };
const TEMA: Record<CorAgenda, string> = {
  azul: "border-sky-400",
  verde: "border-emerald-500",
  amarelo: "border-amber-500",
  vermelho: "border-red-500",
  rosa: "border-pink-500",
  laranja: "border-orange-500",
  roxo: "border-violet-500",
  marrom: "border-amber-800",
  cinza: "border-slate-500",
  "azul-petroleo": "border-blue-900",
};

function hhmm(valor: string) {
  return valor?.slice(0, 5) || "";
}
function minutos(hora: string) {
  const [h = "0", m = "0"] = hora.split(":");
  return Number(h) * 60 + Number(m);
}
function horaDeMinutos(total: number) {
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
function dataIso(data: Date) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}
function dataPorIso(valor: string) {
  const [a, m, d] = valor.split("-").map(Number);
  return new Date(a, (m || 1) - 1, d || 1, 12, 0, 0);
}
function formatarData(valor: string) {
  return dataPorIso(valor)
    .toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    })
    .toUpperCase();
}
function duracaoEntre(inicio: string, fim: string) {
  return Math.max(5, Math.round((new Date(fim).getTime() - new Date(inicio).getTime()) / 60000));
}
function statusClinico(evento: AgendamentoDb) {
  return statusAgenda(evento.estado, evento.dados?.status_clinico);
}
function estadoEvento(e: AgendamentoDb) {
  if (e.origem === "banho")
    return STATUS_BANHO[String(e.dados?.status_clinico)] || statusClinico(e);
  if (
    e.estado === "reservado" &&
    e.pagamento_expira_em &&
    Date.parse(e.pagamento_expira_em) <= Date.now()
  )
    return "Expirado";
  return statusClinico(e);
}
function horarioAtivo(e: AgendamentoDb) {
  return !["Cancelado", "Expirado", "Não compareceu"].includes(estadoEvento(e));
}
function exigeConferenciaFinanceira(e: AgendamentoDb | undefined) {
  return (
    !!e &&
    e.origem === "portal_tutor" &&
    (!!e.pagamento_confirmado_em || typeof e.dados?.pagamento_portal_id === "string")
  );
}
type RetornoAgenda<T> = { data: T | null; error: { message: string; code?: string } | null };
type ConsultaAgenda<T> = PromiseLike<RetornoAgenda<T[]>> & {
  select(campos: string): ConsultaAgenda<T>;
  eq(campo: string, valor: unknown): ConsultaAgenda<T>;
  gte(campo: string, valor: string): ConsultaAgenda<T>;
  lte(campo: string, valor: string): ConsultaAgenda<T>;
  order(campo: string): ConsultaAgenda<T>;
  range(de: number, ate: number): ConsultaAgenda<T>;
  maybeSingle(): PromiseLike<RetornoAgenda<T>>;
  delete(): ConsultaAgenda<T>;
};
type PesquisaAgendaDb = {
  tutor_id: string;
  tutor_nome: string;
  tutor_codigo: string;
  pet_id: string | null;
  pet_nome: string;
  pet_especie: string;
};
type FonteAgenda = {
  oricse_agendas_online: AgendaDb;
  oricse_agendamentos_online: AgendamentoDb;
  tutores: TutorDb;
  oricse_animais: AnimalDb;
  clinicas: ClinicaConfig & { limite_usuarios?: number };
  oricse_banho_tosa_agendamentos: {
    id: string;
    animal_id: string;
    tutor_id: string;
    servico_nome: string;
    inicio: string;
    fim: string;
    status: string;
    profissional: string;
    observacoes: string | null;
  };
};
// Campos e funções da migração da agenda ainda não constam no arquivo gerado.
const bancoAgenda = supabase as unknown as {
  from<K extends keyof FonteAgenda>(tabela: K): ConsultaAgenda<FonteAgenda[K]>;
  rpc(nome: "oricse_clinica_ativa_obter"): PromiseLike<RetornoAgenda<string>>;
  rpc(
    nome: "oricse_agenda_buscar_pacientes",
    args: Record<string, unknown>,
  ): PromiseLike<RetornoAgenda<PesquisaAgendaDb[]>>;
  rpc(
    nome: "oricse_agenda_salvar_horarios",
    args: Record<string, unknown>,
  ): PromiseLike<RetornoAgenda<number>>;
  rpc(
    nome: "oricse_agenda_status_recepcao",
    args: Record<string, unknown>,
  ): PromiseLike<RetornoAgenda<null>>;
};

async function carregarEventosPagina<T>(
  query: () => ConsultaAgenda<T>,
): Promise<RetornoAgenda<T[]>> {
  const data: T[] = [];
  for (let de = 0; de <= 10000; de += 500) {
    const r = await query()
      .order("inicio")
      .order("id")
      .range(de, de + 499);
    if (r.error) return { data: null, error: r.error };
    data.push(...(r.data || []));
    if (data.length > 10000)
      return { data: null, error: new Error("Muitos horários. Consulte um período menor.") };
    if ((r.data || []).length < 500) return { data, error: null };
  }
  return { data: null, error: new Error("Muitos horários. Consulte um período menor.") };
}
function pagamentoEvento(evento: AgendamentoDb): Pagamento {
  const p = String(evento.dados?.pagamento || "Pendente");
  return (
    ["Pago", "Pendente", "Presencial", "Isento", "Estornado"].includes(p) ? p : "Pendente"
  ) as Pagamento;
}
function origemEvento(evento: AgendamentoDb) {
  return evento.origem === "portal_tutor" ? "Tutor APP" : "Recepção";
}
function corValida(valor?: string | null): CorAgenda {
  return CORES.includes(valor as CorAgenda) ? (valor as CorAgenda) : "verde";
}
function categoriaAgendaBanhoTosa(tipo?: string | null) {
  const nome = String(tipo || "").toLocaleLowerCase("pt-BR");
  const banho = nome.includes("banho"),
    tosa = nome.includes("tosa");
  if (banho && tosa) return "banho e tosa";
  if (banho) return "banho";
  if (tosa) return "tosa";
  return "";
}
function agendaDaBanhoTosa(
  agendas: Partial<AgendaDb>[],
  profissional?: string | null,
  servico?: string | null,
) {
  const responsavel = String(profissional || "")
    .trim()
    .toLocaleLowerCase("pt-BR");
  const candidatas = agendas.filter(
    (agenda) =>
      String(agenda.responsavel || "")
        .trim()
        .toLocaleLowerCase("pt-BR") === responsavel &&
      Boolean(categoriaAgendaBanhoTosa(agenda.tipo)),
  );
  const categoriaServico = categoriaAgendaBanhoTosa(servico);
  return (
    candidatas.find((agenda) => categoriaAgendaBanhoTosa(agenda.tipo) === categoriaServico) ||
    candidatas.find((agenda) => categoriaAgendaBanhoTosa(agenda.tipo) === "banho e tosa") ||
    candidatas[0]
  );
}
function emojiEspecie(valor?: string) {
  const e = (valor || "").toLowerCase();
  if (e.includes("cão") || e.includes("cao") || e.includes("canin")) return "🐶";
  if (e.includes("gat") || e.includes("felin")) return "🐱";
  if (e.includes("ave")) return "🐦";
  return "🐾";
}
function resumoDias(lista: number[]) {
  if (lista.length === 7) return "Todos os dias";
  if ([1, 2, 3, 4, 5].every((d) => lista.includes(d)) && lista.length === 5) return "Seg a Sex";
  return DIAS.filter((d) => lista.includes(d.value))
    .map((d) => d.label)
    .join(" · ");
}
function fusoSeguro(timeZone?: string | null) {
  const candidato = typeof timeZone === "string" ? timeZone.trim() : "";
  if (!candidato) return "America/Sao_Paulo";
  try {
    new Intl.DateTimeFormat("pt-BR", { timeZone: candidato });
    return candidato;
  } catch {
    return "America/Sao_Paulo";
  }
}
function horaNoFuso(valor: string, timeZone: string) {
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: fusoSeguro(timeZone),
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(data);
}
function dataNoFuso(valor: string, timeZone: string) {
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "";
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: fusoSeguro(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(data);
  const mapa = Object.fromEntries(partes.map((p) => [p.type, p.value]));
  return `${mapa.year}-${mapa.month}-${mapa.day}`;
}
function agendaFormPadrao(intervaloMin: number): AgendaForm {
  return {
    nome: "Consultas",
    responsavel: "",
    tipo: "Consultório",
    inicio: "08:00",
    fim: "17:00",
    diasSemana: [1, 2, 3, 4, 5],
    intervaloMin,
    portalAtivo: false,
    pagamentoValor: "",
    modalidade: "aprovacao",
    antecedenciaHoras: 2,
    timezone: "America/Sao_Paulo",
    cor: "verde",
  };
}

function normalizarAgenda(agenda: Partial<AgendaDb>): AgendaDb {
  const intervalo = Number(agenda.intervalo_min);
  const dias = Array.isArray(agenda.dias_semana)
    ? agenda.dias_semana.map(Number).filter((dia) => Number.isInteger(dia) && dia >= 0 && dia <= 6)
    : [];
  return {
    id: String(agenda.id || ""),
    clinica_id: String(agenda.clinica_id || ""),
    nome: String(agenda.nome || "Agenda"),
    responsavel: String(agenda.responsavel || ""),
    inicio: String(agenda.inicio || "08:00"),
    fim: String(agenda.fim || "17:00"),
    dias_semana: dias.length ? dias : [1, 2, 3, 4, 5],
    intervalo_min:
      Number.isFinite(intervalo) && intervalo >= 5 && intervalo <= 240 ? intervalo : 30,
    pagamento_valor: typeof agenda.pagamento_valor === "number" ? agenda.pagamento_valor : null,
    portal_ativo: Boolean(agenda.portal_ativo),
    modalidade:
      agenda.modalidade === "livre" || agenda.modalidade === "pagamento"
        ? agenda.modalidade
        : "aprovacao",
    antecedencia_horas: Math.max(0, Number(agenda.antecedencia_horas) || 0),
    timezone: fusoSeguro(agenda.timezone),
    tipo: String(agenda.tipo || "Consultório"),
    cor: corValida(agenda.cor),
  };
}

// Dados antigos ou importados podem ter campos nulos. A agenda é uma área de
// trabalho crítica: um único agendamento incompleto não pode derrubar o painel
// inteiro (por exemplo, ao chamar toUpperCase no nome do animal).
function normalizarAgendamento(evento: Partial<AgendamentoDb>): AgendamentoDb {
  const dados =
    evento.dados && typeof evento.dados === "object" && !Array.isArray(evento.dados)
      ? evento.dados
      : null;
  const estado = ["solicitado", "reservado", "confirmado", "cancelado", "expirado"].includes(
    String(evento.estado),
  )
    ? (evento.estado as AgendamentoDb["estado"])
    : "confirmado";
  return {
    id: String(evento.id || ""),
    clinica_id: String(evento.clinica_id || ""),
    agenda_id: String(evento.agenda_id || ""),
    tutor_id: evento.tutor_id ? String(evento.tutor_id) : null,
    animal_id: evento.animal_id ? String(evento.animal_id) : null,
    animal_referencia: String(evento.animal_referencia || "Animal não informado"),
    inicio: String(evento.inicio || ""),
    fim: String(evento.fim || ""),
    estado,
    tipo: String(evento.tipo || "Consulta"),
    observacoes: evento.observacoes == null ? null : String(evento.observacoes),
    origem: String(evento.origem || "recepcao"),
    serie_id: evento.serie_id || null,
    serie_excecao: evento.serie_excecao === true,
    pagamento_expira_em: evento.pagamento_expira_em || null,
    pagamento_confirmado_em: evento.pagamento_confirmado_em || null,
    updated_at: evento.updated_at || null,
    profissional_banho: evento.profissional_banho,

    dados,
  };
}

export class AgendaErrorBoundary extends Component<
  { children: ReactNode },
  { falhou: boolean; tentativa: number }
> {
  override state = { falhou: false, tentativa: 0 };
  static getDerivedStateFromError() {
    return { falhou: true };
  }
  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Falha isolada no painel de agenda:", error, info);
  }
  override componentDidUpdate(prevProps: Readonly<{ children: ReactNode }>) {
    if (this.state.falhou && prevProps.children !== this.props.children)
      this.setState({ falhou: false });
  }
  override render() {
    if (this.state.falhou)
      return (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center">
          <strong>A agenda não pôde ser exibida agora.</strong>
          <p className="mt-1 text-sm text-muted-foreground">
            Atualize a agenda para recarregar este painel.
          </p>
          <button
            type="button"
            onClick={() =>
              this.setState((estado) => ({ falhou: false, tentativa: estado.tentativa + 1 }))
            }
            className="mt-3 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
          >
            Tentar abrir agenda
          </button>
        </section>
      );
    return <Fragment key={this.state.tentativa}>{this.props.children}</Fragment>;
  }
}

export function AgendaDayBoard({
  mode,
  revisao = 0,
  aoMudarSelecao,
}: {
  mode: AgendaMode;
  revisao?: number;
  aoMudarSelecao?: () => void;
}) {
  const navigate = useNavigate();
  const { pode, adminGlobal, clinicaId: clinicaPermissao } = usePermissoes();
  const podeCadastrar = adminGlobal || pode("recepcao.cadastros.criar");
  const podeAtender = adminGlobal || pode("consultorio.atendimentos");
  const controleCarga = useRef(0);

  const [clinicaId, setClinicaId] = useState("");
  const [agendas, setAgendas] = useState<AgendaDb[]>([]);
  const [quantidadeTotalAgendas, setQuantidadeTotalAgendas] = useState(0);
  const [limiteAgendas, setLimiteAgendas] = useState<number | null>(null);
  const [eventos, setEventos] = useState<AgendamentoDb[]>([]);
  const [tutores, setTutores] = useState<TutorDb[]>([]);
  const [animais, setAnimais] = useState<AnimalDb[]>([]);
  const [config, setConfig] = useState<ClinicaConfig>({
    duracao_padrao_atendimento_min: 30,
    duracoes_atendimento_min: {},
  });
  const [data, setData] = useState(dataIso(new Date()));
  const [filtro, setFiltro] = useState("todas");
  const [visao, setVisao] = useState<VisaoAgenda>("dia");
  const [filtroProf, setFiltroProf] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [cadastro, setCadastro] = useState<"tutor" | "animal" | null>(null);
  const [historico, setHistorico] = useState(false);
  const tutorSelecionado = useRef<TutorDb | null>(null);
  const animalSelecionado = useRef<AnimalDb | null>(null);
  const [relogio, setRelogio] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setRelogio(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  const [carregando, setCarregando] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState("");
  const [agendaModal, setAgendaModal] = useState<{ id?: string; form: AgendaForm } | null>(null);
  const [eventoModal, setEventoModal] = useState<{
    agenda: AgendaDb;
    evento?: AgendamentoDb;
    form: EventoForm;
  } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const contextoAnterior = useRef(clinicaPermissao);
  const versaoEditor = useRef(0);
  const fecharEditor = useCallback(() => {
    versaoEditor.current++;
    setEventoModal(null);
    setCadastro(null);
  }, []);

  useEffect(() => {
    if (contextoAnterior.current === clinicaPermissao) return;
    contextoAnterior.current = clinicaPermissao;
    controleCarga.current++;
    fecharEditor();
    setAgendaModal(null);
    setCadastro(null);
    setAgendas([]);
    setEventos([]);
    setTutores([]);
    setAnimais([]);
    setClinicaId("");
  }, [clinicaPermissao, fecharEditor]);

  const carregar = useCallback(async () => {
    const versao = ++controleCarga.current;
    setCarregando(true);
    try {
      // A agenda usa a mesma clínica ativa escolhida pela Recepção e pela fila.
      const { data: cidSelecionada, error: contextoError } = await bancoAgenda.rpc(
        "oricse_clinica_ativa_obter",
      );
      if (versao !== controleCarga.current) return;
      if (contextoError) throw contextoError;
      const cid = typeof cidSelecionada === "string" ? cidSelecionada : "";
      if (!cid) {
        setClinicaId("");
        setAgendas([]);
        setEventos([]);
        setTutores([]);
        setAnimais([]);
        setQuantidadeTotalAgendas(0);
        setLimiteAgendas(null);
        throw new Error("Selecione uma clínica no Início para consultar a agenda.");
      }
      setClinicaId(cid);
      const dias = diasDaVisaoAgenda(data, visao);
      const de = dataPorIso(dias[0]);
      de.setDate(de.getDate() - 2);
      de.setHours(0, 0, 0, 0);
      const ate = dataPorIso(dias[dias.length - 1]);
      ate.setDate(ate.getDate() + 2);
      ate.setHours(23, 59, 59, 999);
      const [agendasResp, eventosResp, tutoresResp, animaisResp, configResp, banhoResp] =
        await Promise.all([
          bancoAgenda
            .from("oricse_agendas_online")
            .select(
              "id,clinica_id,nome,responsavel,inicio,fim,dias_semana,intervalo_min,portal_ativo,modalidade,antecedencia_horas,timezone,tipo,cor,pagamento_valor",
            )
            .eq("clinica_id", cid)
            .order("nome"),
          mode !== "banho"
            ? carregarEventosPagina(() =>
                bancoAgenda
                  .from("oricse_agendamentos_online")
                  .select(
                    "id,clinica_id,agenda_id,tutor_id,animal_id,animal_referencia,inicio,fim,estado,tipo,observacoes,origem,dados,serie_id,serie_excecao,pagamento_expira_em,pagamento_confirmado_em,updated_at",
                  )
                  .eq("clinica_id", cid)
                  .gte("inicio", de.toISOString())
                  .lte("inicio", ate.toISOString()),
              )
            : Promise.resolve({ data: [], error: null }),
          bancoAgenda
            .from("tutores")
            .select("id,nome,telefone,codigo_publico")
            .eq("clinica_id", cid)
            .order("nome"),
          bancoAgenda
            .from("oricse_animais")
            .select("id,tutor_id,nome,especie,raca,sexo")
            .eq("clinica_id", cid)
            .order("nome"),
          bancoAgenda
            .from("clinicas")
            .select("duracao_padrao_atendimento_min,duracoes_atendimento_min,limite_usuarios")
            .eq("id", cid)
            .maybeSingle(),
          mode === "banho"
            ? carregarEventosPagina(() =>
                bancoAgenda
                  .from("oricse_banho_tosa_agendamentos")
                  .select(
                    "id,animal_id,tutor_id,servico_nome,inicio,fim,status,profissional,observacoes",
                  )
                  .eq("clinica_id", cid)
                  .gte("inicio", de.toISOString())
                  .lte("inicio", ate.toISOString()),
              )
            : Promise.resolve({ data: [], error: null }),
        ]);
      if (versao !== controleCarga.current) return;
      // Falhas em dados auxiliares não devem impedir o calendário de abrir.
      if (agendasResp.error) throw agendasResp.error;
      if (eventosResp.error && mode !== "banho") throw eventosResp.error;
      if (banhoResp.error) throw banhoResp.error;
      if (tutoresResp.error || animaisResp.error || configResp.error) {
        console.warn("Falha ao carregar dados auxiliares da agenda.", {
          tutores: tutoresResp.error?.code,
          animais: animaisResp.error?.code,
          configuracao: configResp.error?.code,
        });
      }
      setAgendas(
        (agendasResp.data || [])
          .map((a: AgendaDb) => normalizarAgenda(a))
          .filter(
            (a: AgendaDb) =>
              a.id &&
              (mode === "banho"
                ? Boolean(categoriaAgendaBanhoTosa(a.tipo))
                : !categoriaAgendaBanhoTosa(a.tipo)),
          ),
      );
      setQuantidadeTotalAgendas((agendasResp.data || []).length);
      setLimiteAgendas(
        configResp.error || configResp.data?.limite_usuarios == null
          ? null
          : Math.max(0, Number(configResp.data.limite_usuarios) || 0),
      );
      setEventos(
        (mode === "banho"
          ? (banhoResp.data || []).map((b) => ({
              id: b.id,
              clinica_id: cid,
              agenda_id:
                agendaDaBanhoTosa(agendasResp.data || [], b.profissional, b.servico_nome)?.id || "",
              tutor_id: b.tutor_id,
              animal_id: b.animal_id,
              animal_referencia: "",
              inicio: b.inicio,
              fim: b.fim,
              estado: b.status === "cancelado" ? "cancelado" : "confirmado",
              tipo: b.servico_nome,
              observacoes: b.observacoes,
              origem: "banho",
              profissional_banho: b.profissional,
              dados: { status_clinico: b.status },
            }))
          : eventosResp.data || []
        )
          .map((evento) => normalizarAgendamento(evento as Partial<AgendamentoDb>))
          .filter(
            (evento: AgendamentoDb) =>
              evento.id &&
              (mode === "banho" || evento.agenda_id) &&
              !Number.isNaN(new Date(evento.inicio).getTime()) &&
              !Number.isNaN(new Date(evento.fim).getTime()),
          ),
      );
      setTutores(Array.isArray(tutoresResp.data) ? tutoresResp.data : []);
      setAnimais(Array.isArray(animaisResp.data) ? animaisResp.data : []);
      setConfig(
        configResp.data && typeof configResp.data === "object" && !Array.isArray(configResp.data)
          ? configResp.data
          : { duracao_padrao_atendimento_min: 30, duracoes_atendimento_min: {} },
      );
      setErroCarregamento("");
    } catch (error) {
      if (versao !== controleCarga.current) return;
      console.error("Erro ao carregar agenda única:", error);
      setErroCarregamento(
        error instanceof Error ? error.message : "Não foi possível carregar a agenda da clínica.",
      );
    } finally {
      if (versao === controleCarga.current) setCarregando(false);
    }
  }, [data, visao, mode]);

  const invalidarCarga = useCallback(() => {
    controleCarga.current++;
  }, []);
  useEffect(() => {
    void carregar();
    return invalidarCarga;
  }, [carregar, revisao, clinicaPermissao, invalidarCarga]);
  useEffect(() => {
    if (!clinicaId) return;
    const canal = supabase
      .channel(`oricse-agenda-${mode}-${clinicaId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "oricse_agendas_online",
          filter: `clinica_id=eq.${clinicaId}`,
        },
        () => void carregar(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: mode === "banho" ? "oricse_banho_tosa_agendamentos" : "oricse_agendamentos_online",
          filter: `clinica_id=eq.${clinicaId}`,
        },
        () => void carregar(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(canal);
    };
  }, [clinicaId, carregar, mode]);

  const tutoresPorId = useMemo(() => new Map(tutores.map((t) => [t.id, t])), [tutores]);
  const animaisPorId = useMemo(() => new Map(animais.map((a) => [a.id, a])), [animais]);
  const agendasVisiveis = useMemo(() => {
    const dia = dataPorIso(data).getDay();
    return agendas.filter(
      (a) => (filtro === "todas" || a.id === filtro) && (a.dias_semana || []).includes(dia),
    );
  }, [agendas, filtro, data]);

  function eventosAgenda(agenda: AgendaDb) {
    return eventos.filter(
      (e) => e.agenda_id === agenda.id && dataNoFuso(e.inicio, agenda.timezone) === data,
    );
  }
  function duracaoPadrao(tipo: string) {
    return Math.max(
      5,
      Number(config.duracoes_atendimento_min?.[tipo]) ||
        DURACOES_PADRAO[tipo] ||
        Number(config.duracao_padrao_atendimento_min) ||
        30,
    );
  }
  function slots(agenda: AgendaDb) {
    const lista: string[] = [];
    const intervalo = Number(agenda.intervalo_min);
    if (!Number.isFinite(intervalo) || intervalo < 5) return lista;
    for (
      let m = minutos(hhmm(agenda.inicio)), guard = 0;
      m + intervalo <= minutos(hhmm(agenda.fim)) && guard < 288;
      m += intervalo, guard += 1
    )
      lista.push(horaDeMinutos(m));
    return lista;
  }
  function ocupa(agenda: AgendaDb, hora: string) {
    const m = minutos(hora);
    return eventosAgenda(agenda).find((e) => {
      if (!horarioAtivo(e)) return false;
      const ini = minutos(horaNoFuso(e.inicio, agenda.timezone));
      return m >= ini && m < ini + duracaoEntre(e.inicio, e.fim);
    });
  }

  function abrirNovaAgenda() {
    if (limiteAgendas === null || quantidadeTotalAgendas >= limiteAgendas) {
      toast.error(
        "Limite de agendas atingido. Para solicitar mais, escreva para atendimento@oricse.com.br ou fale com seu consultor.",
      );
      return;
    }
    const form = agendaFormPadrao(intervaloNovaAgenda(config.duracao_padrao_atendimento_min));
    setAgendaModal({
      form:
        mode === "banho"
          ? { ...form, nome: "Banho e tosa", tipo: "Banho e Tosa", cor: "roxo" }
          : form,
    });
  }
  function editarAgenda(a: AgendaDb) {
    setAgendaModal({
      id: a.id,
      form: {
        nome: a.nome,
        responsavel: a.responsavel,
        tipo: a.tipo,
        inicio: hhmm(a.inicio),
        fim: hhmm(a.fim),
        diasSemana: [...a.dias_semana],
        intervaloMin: a.intervalo_min,
        portalAtivo: a.portal_ativo,
        pagamentoValor: a.pagamento_valor?.toString() || "",
        modalidade: a.modalidade,
        antecedenciaHoras: a.antecedencia_horas,
        timezone: a.timezone,
        cor: corValida(a.cor),
      },
    });
  }

  async function salvarAgenda() {
    if (!agendaModal || !clinicaId) return;
    const f = agendaModal.form;
    if (!f.nome.trim()) return void toast.error("Informe o nome da agenda.");
    if (mode === "banho" && !f.responsavel.trim())
      return void toast.error("Informe o profissional do Banho e Tosa.");
    if (minutos(f.inicio) >= minutos(f.fim))
      return void toast.error("O início precisa ser anterior ao fim.");
    if (!f.diasSemana.length) return void toast.error("Selecione ao menos um dia da semana.");
    setSalvando(true);
    try {
      const { data: sessao } = await supabase.auth.getSession();
      const accessToken = sessao.session?.access_token;
      if (!accessToken) throw new Error("Sessão expirada. Entre novamente.");
      await salvarAgendaOnline({
        data: {
          accessToken,
          clinicaId,
          agendaId: agendaModal.id,
          agenda: {
            nome: f.nome.trim(),
            responsavel: f.responsavel.trim(),
            tipo: f.tipo,
            inicio: f.inicio,
            fim: f.fim,
            dias_semana: f.diasSemana,
            intervalo_min: f.intervaloMin,
            portal_ativo: f.portalAtivo,
            modalidade: f.modalidade,
            pagamento_valor: f.modalidade === "pagamento" ? Number(f.pagamentoValor) : undefined,
            antecedencia_horas: f.antecedenciaHoras,
            timezone: f.timezone.trim() || "America/Sao_Paulo",
            cor: f.cor,
          },
        },
      });
      toast.success(agendaModal.id ? "Agenda atualizada." : "Agenda criada.");
      setAgendaModal(null);
      await carregar();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar a agenda.");
    } finally {
      setSalvando(false);
    }
  }

  async function excluirAgenda() {
    if (!agendaModal?.id || !clinicaId) return;
    if (
      !window.confirm(
        "Excluir esta agenda e todos os agendamentos vinculados? Esta ação não pode ser desfeita.",
      )
    )
      return;
    setSalvando(true);
    const { error } = await bancoAgenda
      .from("oricse_agendas_online")
      .delete()
      .eq("id", agendaModal.id)
      .eq("clinica_id", clinicaId);
    setSalvando(false);
    if (error) return void toast.error(error.message);
    toast.success("Agenda excluída.");
    setAgendaModal(null);
    await carregar();
  }

  function abrirHorario(agenda: AgendaDb, hora: string, existente?: AgendamentoDb) {
    if (mode === "banho") {
      if (existente) {
        void navigate({ to: "/banho-tosa", hash: "fila" });
      } else {
        const query = new URLSearchParams({
          profissional: agenda.responsavel,
          inicio: `${data}T${hora}`,
        });
        window.location.assign(`/banho-tosa?${query.toString()}#novo`);
      }
      return;
    }
    versaoEditor.current++;
    const tipo = existente?.tipo || "Consulta";
    setCadastro(null);
    setHistorico(false);
    tutorSelecionado.current = null;
    animalSelecionado.current = null;
    setEventoModal({
      agenda,
      evento: existente,
      form: {
        data: existente ? dataNoFuso(existente.inicio, agenda.timezone) : data,
        repeticoes: 1,
        passoDias: 7,
        serieToda: false,
        tipo,
        hora: existente ? horaNoFuso(existente.inicio, agenda.timezone) : hora,
        duracaoMin: existente ? duracaoEntre(existente.inicio, existente.fim) : duracaoPadrao(tipo),
        tutorId: existente?.tutor_id || "",
        animalId: existente?.animal_id || "",
        pagamento: existente ? pagamentoEvento(existente) : "Pendente",
        observacoes: existente?.observacoes || "",
      },
    });
  }

  const pesquisarPacientes = useCallback(
    async (termo: string, tutorId: string) => {
      const { data: res, error } = await bancoAgenda.rpc("oricse_agenda_buscar_pacientes", {
        p_clinica: clinicaId,
        p_termo: termo,
        p_tutor: tutorId || null,
      });
      if (error) throw error;
      return (res || []).map(
        (r: {
          tutor_id: string;
          tutor_nome: string;
          tutor_codigo: string;
          pet_id: string | null;
          pet_nome: string;
          pet_especie: string;
        }) => ({
          t: { id: r.tutor_id, nome: r.tutor_nome, codigo_publico: r.tutor_codigo },
          a: r.pet_id
            ? { id: r.pet_id, tutor_id: r.tutor_id, nome: r.pet_nome, especie: r.pet_especie }
            : null,
        }),
      );
    },
    [clinicaId],
  );
  function selecionarPaciente(t: TutorDb | null, a: AnimalDb | null) {
    tutorSelecionado.current = t;
    animalSelecionado.current = a;
    setEventoModal((atual) =>
      atual
        ? { ...atual, form: { ...atual.form, tutorId: t?.id || "", animalId: a?.id || "" } }
        : null,
    );
  }
  async function concluirTutor(id: string) {
    const versao = versaoEditor.current;
    setCadastro(null);
    const { data: reg } = await supabase
      .from("tutores")
      .select("id,nome,codigo_publico")
      .eq("clinica_id", clinicaId)
      .eq("id", id)
      .maybeSingle();
    if (versao === versaoEditor.current)
      selecionarPaciente(reg || { id, nome: "Tutor cadastrado" }, null);
  }
  async function concluirAnimal(id?: string) {
    const versao = versaoEditor.current;
    setCadastro(null);
    const tutor = tutorSelecionado.current || tutoresPorId.get(eventoModal?.form.tutorId || "");
    if (!id || !tutor) return;
    const { data: reg } = await supabase
      .from("oricse_animais")
      .select("id,nome,especie,tutor_id")
      .eq("clinica_id", clinicaId)
      .eq("tutor_id", tutor.id)
      .eq("id", id)
      .maybeSingle();
    if (
      reg &&
      versao === versaoEditor.current &&
      (!tutorSelecionado.current || tutorSelecionado.current.id === tutor.id)
    )
      selecionarPaciente(tutor, reg);
  }
  function patchEvento(patch: Partial<EventoForm>) {
    setEventoModal((atual) => (atual ? { ...atual, form: { ...atual.form, ...patch } } : null));
  }

  async function salvarEvento() {
    if (!eventoModal || !clinicaId) return;
    const { agenda, evento, form } = eventoModal;
    const bloqueio = form.tipo === TIPO_BLOQUEIO;
    if (!bloqueio && (!form.tutorId || !form.animalId))
      return void toast.error("Selecione um tutor e um animal vinculados.");
    setSalvando(true);
    try {
      const { data: quantidade, error } = await bancoAgenda.rpc("oricse_agenda_salvar_horarios", {
        p_clinica: clinicaId,
        p_agenda: agenda.id,
        p_data: form.data,
        p_hora: form.hora,
        p_duracao: form.duracaoMin,
        p_tipo: form.tipo,
        p_tutor: form.tutorId || null,
        p_animal: form.animalId || null,
        p_pagamento: form.pagamento,
        p_obs: form.observacoes,
        p_repeticoes: form.repeticoes,
        p_passo_dias: form.passoDias,
        p_editar: evento?.id || null,
        p_inicio_anterior: evento?.inicio || null,
        p_toda_serie: form.serieToda,
      });
      if (error) throw error;
      const moveu =
        !!evento &&
        (dataNoFuso(evento.inicio, agenda.timezone) !== form.data ||
          horaNoFuso(evento.inicio, agenda.timezone) !== form.hora);
      toast.success(
        moveu
          ? "Horário reagendado."
          : (quantidade || 0) > 1
            ? `${quantidade} horários salvos na série.`
            : evento
              ? "Horário atualizado."
              : bloqueio
                ? "Horário bloqueado."
                : "Agendamento criado.",
      );
      fecharEditor();
      if (form.data !== data) setData(form.data);
      else await carregar();
    } catch (error) {
      toast.error(
        error && typeof error === "object" && "message" in error
          ? String(error.message)
          : "Não foi possível salvar o horário.",
      );
    } finally {
      setSalvando(false);
    }
  }

  async function alterarEvento(
    evento: AgendamentoDb,
    patch: Record<string, unknown>,
    mensagem: string,
  ) {
    if (!clinicaId) return false;
    let alteracao = supabase
      .from("oricse_agendamentos_online")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", evento.id)
      .eq("clinica_id", clinicaId)
      .eq("estado", evento.estado)
      .eq("inicio", evento.inicio);
    if (evento.updated_at) alteracao = alteracao.eq("updated_at", evento.updated_at);
    const { data: alterado, error } = await alteracao.select("id").maybeSingle();
    if (!error && !alterado) {
      toast.error("O agendamento mudou. Atualize a agenda.");
      await carregar();
      return false;
    }
    if (error) {
      toast.error(error.message);
      return false;
    }
    toast.success(mensagem);
    fecharEditor();
    await carregar();
    return true;
  }
  async function confirmarPortal(evento: AgendamentoDb) {
    await alterarEvento(
      evento,
      { estado: "confirmado", dados: { ...(evento.dados || {}), status_clinico: "Agendado" } },
      "Agendamento confirmado.",
    );
  }
  async function cancelarEvento(evento: AgendamentoDb) {
    if (evento.origem === "portal_tutor") {
      const motivo = window.prompt("Motivo do cancelamento (mínimo de 8 caracteres):");
      if (motivo === null) return;
      if (motivo.trim().length < 8) return void toast.error("Informe o motivo do cancelamento.");
      if (!window.confirm("Confirmar cancelamento deste agendamento?")) return;
      setSalvando(true);
      try {
        const { data: sessao } = await supabase.auth.getSession();
        if (!sessao.session?.access_token) throw new Error("Sessão expirada.");
        const r = await cancelarAgendamentoPolitica({
          data: {
            accessToken: sessao.session.access_token,
            clinicaId,
            agendamentoId: evento.id,
            motivo: motivo.trim(),
          },
        });
        if (!r.ok) throw new Error("Cancelamento não confirmado.");
        toast.success(
          r.requerEstorno
            ? "Agendamento cancelado. Confira o estorno no Caixa."
            : r.aprovacaoGerencial
              ? "Cancelamento excepcional registrado."
              : "Agendamento cancelado.",
        );
        fecharEditor();
        await carregar();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Não foi possível cancelar.");
      } finally {
        setSalvando(false);
      }
      return;
    }
    if (!window.confirm("Cancelar este horário?")) return;
    const pago =
      pagamentoEvento(evento) === "Pago" && typeof evento.dados?.pagamento_portal_id === "string";
    await alterarEvento(
      evento,
      {
        estado: "cancelado",
        dados: {
          ...(evento.dados || {}),
          status_clinico: "Cancelado",
          ...(pago ? { pagamento_requer_estorno: true } : {}),
        },
      },
      pago
        ? "Agendamento cancelado. Confira o estorno no Caixa."
        : evento.tipo === TIPO_BLOQUEIO
          ? "Bloqueio removido."
          : "Agendamento cancelado.",
    );
  }
  async function abrirAtendimento(evento: AgendamentoDb) {
    if (!evento.animal_id) return;
    if (
      statusClinico(evento) !== "Em atendimento" &&
      !(await statusEvento(evento, "Em atendimento"))
    )
      return;
    const query = new URLSearchParams({
      animalId: evento.animal_id,
      agendamentoId: evento.id,
      tipo: "consulta",
    });
    window.location.assign(`/registro-clinico?${query}`);
  }
  async function statusEvento(
    evento: AgendamentoDb,
    status: "Chegou" | "Em atendimento" | "Não compareceu",
  ) {
    if (
      status === "Não compareceu" &&
      !window.confirm("Marcar que este paciente não compareceu e liberar o horário?")
    )
      return false;
    setSalvando(true);
    try {
      const { error } = await bancoAgenda.rpc("oricse_agenda_status_recepcao", {
        p_clinica: clinicaId,
        p_agendamento: evento.id,
        p_status: status,
        p_inicio_esperado: evento.inicio,
      });
      if (error) throw error;
      toast.success(
        status === "Chegou"
          ? "Chegada registrada."
          : status === "Não compareceu"
            ? "Falta registrada."
            : "Atendimento iniciado.",
      );
      fecharEditor();
      await carregar();
      return true;
    } catch (error) {
      toast.error(
        error && typeof error === "object" && "message" in error
          ? String(error.message)
          : "Não foi possível mudar o status.",
      );
      return false;
    } finally {
      setSalvando(false);
    }
  }
  const agendasPorId = new Map(agendas.map((a) => [a.id, a]));
  const profissionalDe = (e: AgendamentoDb) =>
    e.profissional_banho || agendasPorId.get(e.agenda_id)?.responsavel || "Sem responsável";
  const profissionais = [
    ...new Set([
      ...agendas.map((a) => a.responsavel || "Sem responsável"),
      ...eventos.map(profissionalDe),
    ]),
  ].sort();
  const tipos = [
    ...new Set([...(mode === "banho" ? [] : TIPOS_EVENTO), ...eventos.map((e) => e.tipo)]),
  ].sort();
  const filtrados = (modoData: string) =>
    eventos.filter((e) => {
      const agenda = agendasPorId.get(e.agenda_id);
      return (
        dataNoFuso(e.inicio, agenda?.timezone || "America/Sao_Paulo") === modoData &&
        (filtro === "todas" || filtro === e.agenda_id) &&
        (!filtroProf || filtroProf === profissionalDe(e)) &&
        (!filtroTipo || filtroTipo === e.tipo) &&
        (!filtroStatus || filtroStatus === estadoEvento(e))
      );
    });
  const eventosHoje = filtrados(data);
  function abrirEvento(e: AgendamentoDb) {
    const agenda = agendasPorId.get(e.agenda_id);
    if (agenda) abrirHorario(agenda, horaNoFuso(e.inicio, agenda.timezone), e);
    else if (mode === "banho") void navigate({ to: "/banho-tosa", hash: "fila" });
  }
  const acoes = eventoModal?.evento
    ? acoesAgenda(statusClinico(eventoModal.evento), eventoModal.evento.inicio, relogio)
    : null;
  const eventoEditavel =
    !!eventoModal &&
    (!eventoModal.evento || (!!acoes?.remarcar && !exigeConferenciaFinanceira(eventoModal.evento)));
  const podeEditarSerie =
    eventoModal?.evento?.serie_id &&
    !eventoModal.evento.serie_excecao &&
    Date.parse(eventoModal.evento.inicio) > relogio;
  function mudarPeriodo(sentido: -1 | 1) {
    setData(moverVisaoAgenda(data, visao, sentido));
    aoMudarSelecao?.();
  }
  function agendarLivre() {
    if (carregando || erroCarregamento) return;
    const agenda = agendasVisiveis.find(
      (a) =>
        (!filtroProf || filtroProf === (a.responsavel || "Sem responsável")) &&
        slots(a).some((h) => !ocupa(a, h)),
    );
    const hora = agenda && slots(agenda).find((h) => !ocupa(agenda, h));
    if (agenda && hora) abrirHorario(agenda, hora);
    else toast.info("Não há horário livre na data selecionada. Escolha outro dia ou agenda.");
  }
  const nomesPaciente = (e: AgendamentoDb) =>
    e.tipo === TIPO_BLOQUEIO
      ? TIPO_BLOQUEIO
      : animaisPorId.get(e.animal_id || "")?.nome || e.animal_referencia;

  if (carregando && !agendas.length)
    return (
      <section className="rounded-2xl border bg-white p-6 text-sm text-muted-foreground">
        Carregando agenda única da clínica...
      </section>
    );

  return (
    <section className="min-w-0 w-full rounded-2xl border bg-white p-4 shadow-sm sm:p-5">
      {erroCarregamento && (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"
        >
          <strong>Não foi possível atualizar a agenda.</strong>
          <p className="mt-1">{erroCarregamento}</p>
          <button
            type="button"
            onClick={() => void carregar()}
            className="mt-2 rounded-lg border border-amber-400 px-3 py-2 font-bold"
          >
            Tentar novamente
          </button>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <CalendarDays size={22} className="shrink-0 text-primary" />
          <div>
            <h2 className="font-sans text-2xl font-bold tracking-tight text-foreground">
              {mode === "banho"
                ? "Agenda do Banho e Tosa"
                : mode === "recepcao"
                  ? "Clínica veterinária"
                  : "Minha agenda"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {mode === "banho"
                ? "Serviços, profissionais e horários disponíveis"
                : mode === "recepcao"
                  ? "Visualize as agendas clínicas por profissional e horário."
                  : "Sua programação de atendimentos"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            aria-label="Filtrar por agenda"
            value={filtro}
            onChange={(e) => {
              setFiltro(e.target.value);
              aoMudarSelecao?.();
            }}
            className="min-h-10 rounded-xl border bg-white px-3 text-sm font-semibold"
          >
            <option value="todas">Todas as agendas</option>
            {agendas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome} · {a.responsavel || "Sem responsável"}
              </option>
            ))}
          </select>
          <button
            data-oricse-criar-agenda="true"
            disabled={limiteAgendas === null || quantidadeTotalAgendas >= limiteAgendas}
            title={
              quantidadeTotalAgendas >= (limiteAgendas ?? 0)
                ? "Limite de agendas contratadas atingido"
                : "Criar uma nova agenda"
            }
            onClick={abrirNovaAgenda}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus size={15} /> Criar agenda
          </button>
        </div>
      </div>
      <p role="status" className="mt-3 text-xs text-muted-foreground">
        Agendas cadastradas:{" "}
        <strong>
          {quantidadeTotalAgendas} de {limiteAgendas ?? "—"}
        </strong>{" "}
        · Uma agenda por usuário contratado. Para solicitar mais,{" "}
        <a href="mailto:atendimento@oricse.com.br" className="font-semibold text-primary underline">
          atendimento@oricse.com.br
        </a>{" "}
        ou seu consultor. Agendas já existentes permanecem disponíveis.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div
          role="group"
          aria-label="Visualização da agenda"
          className="flex rounded-xl border bg-secondary/30 p-1"
        >
          {(
            [
              ["dia", "Dia"],
              ["semana", "Semana"],
              ["mes", "Mês"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={visao === id}
              onClick={() => {
                setVisao(id);
                aoMudarSelecao?.();
              }}
              className={`rounded-lg px-3 py-2 text-sm font-bold ${visao === id ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="text-xs font-semibold">
          Profissional
          <select
            aria-label="Profissional"
            value={filtroProf}
            onChange={(e) => setFiltroProf(e.target.value)}
            className="ml-1 rounded-lg border bg-card px-2 py-2 text-sm font-normal"
          >
            <option value="">Todos</option>
            {profissionais.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold">
          Tipo de serviço
          <select
            aria-label="Tipo de serviço"
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className="ml-1 rounded-lg border bg-card px-2 py-2 text-sm font-normal"
          >
            <option value="">Todos</option>
            {tipos.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold">
          Status
          <select
            aria-label="Status"
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            className="ml-1 rounded-lg border bg-card px-2 py-2 text-sm font-normal"
          >
            <option value="">Todos</option>
            {(mode === "banho" ? Object.values(STATUS_BANHO) : STATUS_AGENDA).map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={agendarLivre}
          data-oricse-agendar-livre={
            !carregando && agendasVisiveis.some((a) => slots(a).some((h) => !ocupa(a, h)))
              ? "true"
              : undefined
          }
          disabled={carregando || !!erroCarregamento}
          className="ml-auto inline-flex min-h-10 items-center gap-1 rounded-xl bg-primary px-3 text-sm font-bold text-primary-foreground disabled:opacity-40"
        >
          <Plus size={16} /> Agendar
        </button>
      </div>
      <div className="mt-3 flex items-center gap-3 rounded-2xl border bg-[#f8faf8] p-3">
        <button
          type="button"
          aria-label={visao === "dia" ? "Dia anterior" : "Período anterior"}
          onClick={() => mudarPeriodo(-1)}
          className="rounded-xl border bg-white p-2.5"
        >
          <ChevronLeft size={19} />
        </button>
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-center gap-2 text-center">
          <button
            type="button"
            onClick={() => {
              setData(dataIso(new Date()));
              aoMudarSelecao?.();
            }}
            className="rounded-lg px-1 text-primary"
          >
            <strong>
              {visao === "dia"
                ? formatarData(data)
                : dataPorIso(data).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
            </strong>
            <span className="block text-[10px]">Voltar para hoje</span>
          </button>
          <input
            type="date"
            aria-label="Data da agenda"
            data-oricse-data-agenda
            value={data}
            onChange={(e) => {
              if (e.target.value) {
                setData(e.target.value);
                aoMudarSelecao?.();
              }
            }}
            className="rounded-lg border bg-card px-2 py-1 text-xs"
          />
        </div>
        <button
          type="button"
          aria-label={visao === "dia" ? "Próximo dia" : "Próximo período"}
          onClick={() => mudarPeriodo(1)}
          className="rounded-xl border bg-white p-2.5"
        >
          <ChevronRight size={19} />
        </button>
      </div>
      {visao !== "dia" ? (
        <AgendaCalendarioPeriodo
          visao={visao}
          dias={diasDaVisaoAgenda(data, visao).map((d) => ({
            data: d,
            atual: d === dataIso(new Date()),
            foraMes: visao === "mes" && d.slice(0, 7) !== data.slice(0, 7),
            abrir: () => {
              setData(d);
              setVisao("dia");
              aoMudarSelecao?.();
            },
            eventos: filtrados(d).map((e) => ({
              id: e.id,
              titulo: nomesPaciente(e),
              hora: horaNoFuso(
                e.inicio,
                agendasPorId.get(e.agenda_id)?.timezone || "America/Sao_Paulo",
              ),
              estado: estadoEvento(e),
              abrir: () => abrirEvento(e),
            })),
          }))}
        />
      ) : (
        <>
          <section
            className="mt-4 rounded-xl border bg-secondary/15 p-3"
            aria-label={mode === "banho" ? "Serviços do dia" : "Operação do dia"}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-bold">
                {mode === "banho" ? "Serviços do dia" : "Operação do dia"}
              </h3>
              {mode !== "banho" && (
                <p className="text-xs text-muted-foreground">
                  {eventosHoje.filter((e) => estadoEvento(e) === "Chegou").length} chegaram ·{" "}
                  {eventosHoje.filter((e) => estadoEvento(e) === "Em atendimento").length} em
                  atendimento ·{" "}
                  {eventosHoje.filter((e) => estadoEvento(e) === "Não compareceu").length} faltaram
                </p>
              )}
            </div>
            {!eventosHoje.length ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Nenhum horário para esta data e filtros.
              </p>
            ) : (
              <ul className="mt-2 grid max-h-52 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
                {eventosHoje.map((e) => {
                  const status = estadoEvento(e);
                  const prox =
                    mode !== "banho" && e.tipo !== TIPO_BLOQUEIO
                      ? acoesAgenda(statusClinico(e), e.inicio, relogio)
                      : null;
                  return (
                    <li key={e.id} className="rounded-lg border bg-card p-2">
                      <button
                        type="button"
                        onClick={() => abrirEvento(e)}
                        className="w-full text-left text-xs hover:text-primary"
                      >
                        <strong>
                          {horaNoFuso(
                            e.inicio,
                            agendasPorId.get(e.agenda_id)?.timezone || "America/Sao_Paulo",
                          )}{" "}
                          · {nomesPaciente(e)}
                        </strong>
                        <span className="block text-muted-foreground">
                          {e.tipo} · {profissionalDe(e)} · {status}
                        </span>
                      </button>
                      {prox && (
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          {prox.chegado && (
                            <button
                              type="button"
                              disabled={salvando}
                              className="rounded-md border px-2 py-1 text-[11px] font-bold text-primary"
                              onClick={() => void statusEvento(e, "Chegou")}
                            >
                              Registrar chegada
                            </button>
                          )}
                          {podeAtender && prox.atender && e.animal_id && !prox.chegado && (
                            <button
                              type="button"
                              disabled={salvando}
                              className="rounded-md border px-2 py-1 text-[11px] font-bold text-primary"
                              onClick={() => void abrirAtendimento(e)}
                            >
                              {status === "Em atendimento"
                                ? "Continuar atendimento"
                                : "Iniciar atendimento"}
                            </button>
                          )}
                          {prox.remarcar && !exigeConferenciaFinanceira(e) && (
                            <button
                              type="button"
                              onClick={() => abrirEvento(e)}
                              className="rounded-md border px-2 py-1 text-[11px] font-semibold"
                            >
                              Reagendar
                            </button>
                          )}
                          {prox.falta && (
                            <button
                              type="button"
                              disabled={salvando}
                              className="rounded-md border px-2 py-1 text-[11px] font-semibold"
                              onClick={() => void statusEvento(e, "Não compareceu")}
                            >
                              Marcar falta
                            </button>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
          {!agendas.length ? (
            <div className="mt-5 rounded-2xl border border-dashed p-8 text-center">
              <CalendarDays className="mx-auto text-muted-foreground" />
              <h3 className="mt-3 text-lg font-bold">Nenhuma agenda criada</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Crie a primeira agenda. Ela poderá ser publicada no Portal do Tutor no mesmo
                cadastro.
              </p>
              <button
                disabled={limiteAgendas === null || quantidadeTotalAgendas >= limiteAgendas}
                onClick={abrirNovaAgenda}
                className="mt-4 rounded-xl bg-primary px-4 py-2 font-bold text-primary-foreground disabled:opacity-40"
              >
                Criar primeira agenda
              </button>
            </div>
          ) : (
            <div
              data-oricse-agenda-trilho="true"
              className="mt-4 flex min-w-0 gap-3 overflow-x-auto pb-2"
            >
              {agendasVisiveis
                .filter((a) => !filtroProf || filtroProf === (a.responsavel || "Sem responsável"))
                .map((agenda) => {
                  const tema = TEMA[corValida(agenda.cor)];
                  const listaEventos = eventosAgenda(agenda);
                  return (
                    <article
                      key={agenda.id}
                      className={`w-[330px] min-w-[330px] overflow-hidden rounded-xl border-2 bg-[#fcfcfb] ${tema}`}
                    >
                      <header className="border-b bg-white px-3 py-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-black">{agenda.nome}</h3>
                            <p className="text-xs text-muted-foreground">
                              {agenda.tipo} · {agenda.responsavel || "Sem responsável"}
                            </p>
                            <p className="mt-1 text-[10px] font-semibold text-primary">
                              {hhmm(agenda.inicio)}–{hhmm(agenda.fim)} ·{" "}
                              {resumoDias(agenda.dias_semana)} · {agenda.intervalo_min} min
                            </p>
                            {agenda.portal_ativo && (
                              <span className="mt-1 inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-black uppercase text-emerald-800">
                                Portal ativo · {agenda.modalidade}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => editarAgenda(agenda)}
                            className="rounded-lg p-1.5 hover:bg-secondary"
                          >
                            <Pencil size={15} />
                          </button>
                        </div>
                      </header>
                      <div className="space-y-1.5 p-2">
                        {slots(agenda).map((hora) => {
                          const evento = ocupa(agenda, hora);
                          if (!evento)
                            return (
                              <button
                                key={hora}
                                type="button"
                                data-oricse-agendar-livre="true"
                                onClick={() => abrirHorario(agenda, hora)}
                                className="flex min-h-9 w-full items-center gap-2 rounded-lg border border-dashed bg-white px-2.5 text-left text-[11px] hover:bg-secondary/40"
                              >
                                <strong className="w-11">{hora}</strong>
                                <span className="font-semibold text-muted-foreground">Livre</span>
                                <span className="ml-auto font-bold text-primary">+ Agendar</span>
                              </button>
                            );
                          const inicio = horaNoFuso(evento.inicio, agenda.timezone);
                          if (inicio !== hora)
                            return (
                              <div
                                key={hora}
                                className="flex min-h-9 items-center gap-2 rounded-lg border bg-slate-50 px-2.5 text-[10px]"
                              >
                                <strong className="w-11">{hora}</strong>
                                <span>Ocupado · {evento.tipo}</span>
                              </div>
                            );
                          const animal = evento.animal_id
                            ? animaisPorId.get(evento.animal_id)
                            : null;
                          const tutor = evento.tutor_id ? tutoresPorId.get(evento.tutor_id) : null;
                          const bloqueio = evento.tipo === TIPO_BLOQUEIO;
                          const status = estadoEvento(evento);
                          const nomeAnimal = String(
                            animal?.nome || evento.animal_referencia || "Animal não informado",
                          );
                          if (
                            (filtroTipo && evento.tipo !== filtroTipo) ||
                            (filtroStatus && status !== filtroStatus)
                          )
                            return (
                              <div
                                key={hora}
                                className="rounded-lg border bg-slate-50 p-2 text-[10px]"
                              >
                                <strong>{hora}</strong> · Ocupado
                              </div>
                            );
                          return (
                            <button
                              key={evento.id}
                              onClick={() => abrirHorario(agenda, hora, evento)}
                              className={`w-full rounded-lg border border-l-4 p-2 text-left ${bloqueio ? "border-slate-400 bg-slate-100" : "border-sky-300 bg-sky-50"}`}
                            >
                              <div className="flex items-center gap-1.5">
                                <strong className="text-xs">{hora}</strong>
                                {bloqueio ? (
                                  <Lock size={13} />
                                ) : (
                                  <span>
                                    {emojiEspecie(
                                      animal?.especie || String(evento.dados?.especie || ""),
                                    )}
                                  </span>
                                )}
                                <span className="truncate text-xs font-black">
                                  {bloqueio ? TIPO_BLOQUEIO : nomeAnimal.toUpperCase()}
                                </span>
                                {evento.estado === "solicitado" && (
                                  <span className="ml-auto rounded bg-amber-100 px-1.5 py-0.5 text-[8px] font-black text-amber-900">
                                    APROVAR
                                  </span>
                                )}
                              </div>
                              {!bloqueio && (
                                <p className="mt-0.5 truncate text-[10px] text-slate-600">
                                  {evento.tipo} ·{" "}
                                  {tutor?.nome || String(evento.dados?.tutor_nome || "Tutor")} ·{" "}
                                  {origemEvento(evento)}
                                </p>
                              )}
                              <p className="mt-0.5 text-[9px] font-semibold text-slate-500">
                                {duracaoEntre(evento.inicio, evento.fim)} min · {status} ·{" "}
                                {pagamentoEvento(evento)}
                              </p>
                            </button>
                          );
                        })}
                        {!listaEventos.length && (
                          <p className="py-1 text-center text-[10px] text-muted-foreground">
                            Sem agendamentos neste dia.
                          </p>
                        )}
                      </div>
                    </article>
                  );
                })}
            </div>
          )}

          {agendas.length > 0 && agendasVisiveis.length === 0 && (
            <p className="mt-4 rounded-xl bg-secondary/40 p-4 text-sm text-muted-foreground">
              Nenhuma agenda funciona nesta data.
            </p>
          )}
        </>
      )}

      {agendaModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/35 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-black">
                  {agendaModal.id ? "Editar agenda" : "Criar agenda"}
                </h3>
                <p className="text-xs text-muted-foreground">
                  A mesma definição é usada na Recepção e no Portal do Tutor.
                </p>
              </div>
              <button onClick={() => setAgendaModal(null)}>
                <X />
              </button>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Campo label="Nome">
                <input
                  value={agendaModal.form.nome}
                  onChange={(e) =>
                    setAgendaModal({
                      ...agendaModal,
                      form: { ...agendaModal.form, nome: e.target.value },
                    })
                  }
                />
              </Campo>
              <Campo label="Responsável">
                <input
                  value={agendaModal.form.responsavel}
                  onChange={(e) =>
                    setAgendaModal({
                      ...agendaModal,
                      form: { ...agendaModal.form, responsavel: e.target.value },
                    })
                  }
                />
              </Campo>
              <Campo label="Tipo">
                <select
                  value={agendaModal.form.tipo}
                  onChange={(e) =>
                    setAgendaModal({
                      ...agendaModal,
                      form: { ...agendaModal.form, tipo: e.target.value },
                    })
                  }
                >
                  {(mode === "banho" ? TIPOS_AGENDA_BANHO : TIPOS_AGENDA_CLINICA).map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </Campo>
              <Campo label="Cor">
                <select
                  value={agendaModal.form.cor}
                  onChange={(e) =>
                    setAgendaModal({
                      ...agendaModal,
                      form: { ...agendaModal.form, cor: e.target.value as CorAgenda },
                    })
                  }
                >
                  {CORES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo label="Início">
                <input
                  type="time"
                  value={agendaModal.form.inicio}
                  onChange={(e) =>
                    setAgendaModal({
                      ...agendaModal,
                      form: { ...agendaModal.form, inicio: e.target.value },
                    })
                  }
                />
              </Campo>
              <Campo label="Fim">
                <input
                  type="time"
                  value={agendaModal.form.fim}
                  onChange={(e) =>
                    setAgendaModal({
                      ...agendaModal,
                      form: { ...agendaModal.form, fim: e.target.value },
                    })
                  }
                />
              </Campo>
              <Campo label="Intervalo da grade">
                <input
                  type="number"
                  min={5}
                  max={240}
                  value={agendaModal.form.intervaloMin}
                  onChange={(e) =>
                    setAgendaModal({
                      ...agendaModal,
                      form: { ...agendaModal.form, intervaloMin: Number(e.target.value) },
                    })
                  }
                />
              </Campo>
              <Campo label="Fuso horário">
                <input
                  value={agendaModal.form.timezone}
                  onChange={(e) =>
                    setAgendaModal({
                      ...agendaModal,
                      form: { ...agendaModal.form, timezone: e.target.value },
                    })
                  }
                />
              </Campo>
            </div>
            <div className="mt-4">
              <p className="text-sm font-bold">Dias</p>
              <div className="mt-2 flex flex-wrap gap-3">
                {DIAS.map((d) => (
                  <label key={d.value} className="flex items-center gap-1 text-sm">
                    <input
                      type="checkbox"
                      checked={agendaModal.form.diasSemana.includes(d.value)}
                      onChange={(e) =>
                        setAgendaModal({
                          ...agendaModal,
                          form: {
                            ...agendaModal.form,
                            diasSemana: e.target.checked
                              ? [...agendaModal.form.diasSemana, d.value]
                              : agendaModal.form.diasSemana.filter((x) => x !== d.value),
                          },
                        })
                      }
                    />
                    {d.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="mt-5 rounded-xl border bg-slate-50 p-4">
              <label className="flex items-center gap-2 text-sm font-black">
                <input
                  type="checkbox"
                  checked={agendaModal.form.portalAtivo}
                  onChange={(e) =>
                    setAgendaModal({
                      ...agendaModal,
                      form: { ...agendaModal.form, portalAtivo: e.target.checked },
                    })
                  }
                />
                Publicar no Portal do Tutor
              </label>
              {agendaModal.form.portalAtivo && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Campo label="Modalidade">
                    <select
                      value={agendaModal.form.modalidade}
                      onChange={(e) =>
                        setAgendaModal({
                          ...agendaModal,
                          form: { ...agendaModal.form, modalidade: e.target.value as Modalidade },
                        })
                      }
                    >
                      <option value="livre">Livre — confirma na hora</option>
                      <option value="aprovacao">Mediante aprovação</option>
                      <option value="pagamento">Mediante pagamento</option>
                    </select>
                  </Campo>
                  {agendaModal.form.modalidade === "pagamento" && (
                    <Campo label="Valor do agendamento (R$)">
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={agendaModal.form.pagamentoValor}
                        onChange={(e) =>
                          setAgendaModal({
                            ...agendaModal,
                            form: { ...agendaModal.form, pagamentoValor: e.target.value },
                          })
                        }
                      />
                    </Campo>
                  )}
                  <Campo label="Antecedência mínima (h)">
                    <input
                      type="number"
                      min={0}
                      max={720}
                      value={agendaModal.form.antecedenciaHoras}
                      onChange={(e) =>
                        setAgendaModal({
                          ...agendaModal,
                          form: { ...agendaModal.form, antecedenciaHoras: Number(e.target.value) },
                        })
                      }
                    />
                  </Campo>
                </div>
              )}
            </div>
            <div className="mt-5 flex flex-wrap justify-between gap-2">
              {agendaModal.id ? (
                <button
                  disabled={salvando}
                  onClick={excluirAgenda}
                  className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 font-bold text-red-700"
                >
                  <Trash2 size={16} /> Excluir
                </button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => setAgendaModal(null)}
                  className="rounded-xl border px-4 py-2.5 font-bold"
                >
                  Cancelar
                </button>
                <button
                  disabled={salvando}
                  onClick={salvarAgenda}
                  className="rounded-xl bg-primary px-4 py-2.5 font-bold text-primary-foreground"
                >
                  {salvando ? "Salvando..." : "Salvar agenda"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {eventoModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/35 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={eventoModal.evento ? "Detalhes do horário" : "Novo horário"}
            className={`max-h-[90vh] w-full overflow-y-auto rounded-2xl border bg-card p-5 shadow-xl ${cadastro ? "max-w-4xl" : "max-w-xl"}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-xl font-black">
                  {eventoModal.evento ? eventoModal.form.tipo : "Novo horário"}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {eventoModal.agenda.nome} · {eventoModal.form.data} · {eventoModal.form.hora}
                </p>
              </div>
              <button
                type="button"
                aria-label="Fechar"
                disabled={salvando}
                onClick={() => {
                  if (cadastro) setCadastro(null);
                  else fecharEditor();
                }}
              >
                <X />
              </button>
            </div>
            {cadastro === "tutor" && podeCadastrar ? (
              <CadastroTutor
                dentroDaBusca={{
                  clinicaId,
                  onSalvar: (id) => void concluirTutor(id),
                  onCancelar: () => setCadastro(null),
                }}
              />
            ) : cadastro === "animal" && podeCadastrar && eventoModal.form.tutorId ? (
              <CadastroAnimal
                dentroDaBusca={{
                  tutorId: eventoModal.form.tutorId,
                  clinicaId,
                  onSalvar: (id) => void concluirAnimal(id),
                  onCancelar: () => setCadastro(null),
                }}
              />
            ) : (
              <>
                {eventoModal.evento && (
                  <div className="mt-4 rounded-xl bg-secondary/30 p-3 text-xs">
                    <p>
                      <strong>Origem:</strong> {origemEvento(eventoModal.evento)}
                    </p>
                    <p>
                      <strong>Status:</strong> {estadoEvento(eventoModal.evento)}
                      {eventoModal.evento.serie_id
                        ? eventoModal.evento.serie_excecao
                          ? " · Exceção da série"
                          : " · Série de horários"
                        : ""}
                    </p>
                    {typeof eventoModal.evento.dados?.chegada_em === "string" && (
                      <p>
                        <strong>Chegada:</strong>{" "}
                        {horaNoFuso(
                          eventoModal.evento.dados.chegada_em,
                          eventoModal.agenda.timezone,
                        )}
                      </p>
                    )}
                  </div>
                )}
                {exigeConferenciaFinanceira(eventoModal.evento) && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Horário com pagamento pelo Portal: confira a cobrança antes de alterar ou
                    cancelar.
                  </p>
                )}
                <fieldset disabled={!eventoEditavel || salvando} className="mt-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Campo label="Tipo">
                      <select
                        value={eventoModal.form.tipo}
                        disabled={eventoModal.form.serieToda}
                        onChange={(e) => {
                          const tipo = e.target.value;
                          patchEvento({
                            tipo,
                            duracaoMin: duracaoPadrao(tipo),
                            ...(tipo === TIPO_BLOQUEIO
                              ? { tutorId: "", animalId: "", pagamento: "Isento" }
                              : {}),
                          });
                        }}
                      >
                        {TIPOS_EVENTO.map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                    </Campo>
                    <Campo label="Data">
                      <input
                        type="date"
                        value={eventoModal.form.data}
                        disabled={eventoModal.form.serieToda}
                        onChange={(e) => {
                          if (e.target.value) patchEvento({ data: e.target.value });
                        }}
                      />
                    </Campo>
                    <Campo label="Hora">
                      <input
                        type="time"
                        value={eventoModal.form.hora}
                        onChange={(e) => patchEvento({ hora: e.target.value })}
                      />
                    </Campo>
                    <Campo label="Duração (min)">
                      <input
                        type="number"
                        min={5}
                        max={720}
                        step={5}
                        value={eventoModal.form.duracaoMin}
                        onChange={(e) => patchEvento({ duracaoMin: Number(e.target.value) })}
                      />
                    </Campo>
                    {eventoModal.form.tipo !== TIPO_BLOQUEIO && (
                      <Campo label="Pagamento">
                        <select
                          value={eventoModal.form.pagamento}
                          onChange={(e) => patchEvento({ pagamento: e.target.value as Pagamento })}
                        >
                          <option>Pago</option>
                          <option>Pendente</option>
                          <option>Presencial</option>
                          <option>Isento</option>
                          <option>Estornado</option>
                        </select>
                      </Campo>
                    )}
                  </div>
                  {eventoModal.form.tipo !== TIPO_BLOQUEIO && (
                    <AgendaEscolherPaciente
                      tutores={
                        tutorSelecionado.current
                          ? [
                              tutorSelecionado.current,
                              ...tutores.filter((t) => t.id !== tutorSelecionado.current?.id),
                            ]
                          : tutores
                      }
                      animais={
                        animalSelecionado.current
                          ? [
                              animalSelecionado.current,
                              ...animais.filter((a) => a.id !== animalSelecionado.current?.id),
                            ]
                          : animais
                      }
                      tutorId={eventoModal.form.tutorId}
                      animalId={eventoModal.form.animalId}
                      aoEscolher={selecionarPaciente}
                      pesquisar={pesquisarPacientes}
                      bloqueado={
                        !eventoEditavel ||
                        eventoModal.form.serieToda ||
                        eventoModal.evento?.origem === "portal_tutor"
                      }
                      aoNovoTutor={podeCadastrar ? () => setCadastro("tutor") : undefined}
                      aoNovoPet={podeCadastrar ? () => setCadastro("animal") : undefined}
                    />
                  )}
                  <label className="mt-4 block text-sm font-bold">
                    Observações
                    <textarea
                      value={eventoModal.form.observacoes}
                      onChange={(e) => patchEvento({ observacoes: e.target.value })}
                      rows={2}
                      maxLength={2000}
                      className="mt-1 w-full rounded-xl border bg-card p-3 font-normal"
                    />
                  </label>
                  {!eventoModal.evento && (
                    <div className="mt-3 rounded-xl border p-3">
                      <label className="flex items-center gap-2 text-sm font-bold">
                        <input
                          type="checkbox"
                          checked={eventoModal.form.repeticoes > 1}
                          onChange={(e) => patchEvento({ repeticoes: e.target.checked ? 4 : 1 })}
                        />{" "}
                        Repetir horário
                      </label>
                      {eventoModal.form.repeticoes > 1 && (
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          <Campo label="Frequência">
                            <select
                              value={eventoModal.form.passoDias}
                              onChange={(e) => patchEvento({ passoDias: Number(e.target.value) })}
                            >
                              <option value={7}>Toda semana</option>
                              <option value={14}>A cada 2 semanas</option>
                              <option value={28}>A cada 4 semanas</option>
                            </select>
                          </Campo>
                          <Campo label="Total de ocorrências">
                            <input
                              type="number"
                              min={2}
                              max={24}
                              value={eventoModal.form.repeticoes}
                              onChange={(e) =>
                                patchEvento({ repeticoes: Math.max(2, Number(e.target.value)) })
                              }
                            />
                          </Campo>
                          <p className="text-xs text-muted-foreground sm:col-span-2">
                            Inclui o primeiro horário. Se houver conflito, a série inteira fica sem
                            alteração.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                  {podeEditarSerie && (
                    <Campo label="Aplicar alterações a">
                      <select
                        value={eventoModal.form.serieToda ? "serie" : "um"}
                        onChange={(e) => {
                          const serie = e.target.value === "serie";
                          const atual = eventoModal.evento!;
                          patchEvento(
                            serie
                              ? {
                                  serieToda: true,
                                  data: dataNoFuso(atual.inicio, eventoModal.agenda.timezone),
                                  tipo: atual.tipo,
                                  tutorId: atual.tutor_id || "",
                                  animalId: atual.animal_id || "",
                                }
                              : { serieToda: false },
                          );
                        }}
                      >
                        <option value="um">Apenas este horário</option>
                        <option value="serie">Toda a série futura</option>
                      </select>
                    </Campo>
                  )}
                </fieldset>
                {eventoModal.evento && historico && (
                  <AgendaHistorico
                    clinicaId={clinicaId}
                    agendamentoId={eventoModal.evento.id}
                    fuso={fusoSeguro(eventoModal.agenda.timezone)}
                  />
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  {eventoModal.evento?.estado === "solicitado" && (
                    <button
                      type="button"
                      disabled={salvando}
                      onClick={() => void confirmarPortal(eventoModal.evento!)}
                      className="rounded-xl bg-emerald-700 px-3 py-2 text-sm font-bold text-white"
                    >
                      Aprovar
                    </button>
                  )}
                  {eventoModal.evento &&
                    acoes?.chegado &&
                    eventoModal.form.tipo !== TIPO_BLOQUEIO && (
                      <button
                        type="button"
                        disabled={salvando}
                        onClick={() => void statusEvento(eventoModal.evento!, "Chegou")}
                        className="rounded-xl border px-3 py-2 text-sm font-bold text-primary"
                      >
                        Registrar chegada
                      </button>
                    )}
                  {eventoModal.evento &&
                    podeAtender &&
                    acoes?.atender &&
                    eventoModal.evento.animal_id && (
                      <button
                        type="button"
                        disabled={salvando}
                        onClick={() => void abrirAtendimento(eventoModal.evento!)}
                        className="rounded-xl border px-3 py-2 text-sm font-bold text-primary"
                      >
                        {statusClinico(eventoModal.evento) === "Em atendimento"
                          ? "Continuar atendimento"
                          : "Iniciar atendimento"}
                      </button>
                    )}
                  {eventoModal.evento &&
                    acoes?.falta &&
                    eventoModal.form.tipo !== TIPO_BLOQUEIO && (
                      <button
                        type="button"
                        disabled={salvando}
                        onClick={() => void statusEvento(eventoModal.evento!, "Não compareceu")}
                        className="rounded-xl border px-3 py-2 text-sm font-bold"
                      >
                        Marcar falta
                      </button>
                    )}
                  {eventoModal.evento && horarioAtivo(eventoModal.evento) && (
                    <button
                      type="button"
                      disabled={salvando}
                      onClick={() => void cancelarEvento(eventoModal.evento!)}
                      className="rounded-xl border border-destructive/30 px-3 py-2 text-sm font-bold text-destructive"
                    >
                      {eventoModal.evento.tipo === TIPO_BLOQUEIO
                        ? "Remover bloqueio"
                        : "Cancelar horário"}
                    </button>
                  )}
                  {typeof eventoModal.evento?.dados?.comanda_id === "string" && (
                    <a
                      href={`/comandas?comandaId=${encodeURIComponent(eventoModal.evento.dados.comanda_id)}`}
                      className="rounded-xl border px-3 py-2 text-sm font-bold"
                    >
                      Abrir comanda
                    </a>
                  )}
                  {eventoModal.evento?.dados?.pagamento_requer_estorno === true && (
                    <a
                      href={`/financeiro?estornoOrigem=${encodeURIComponent(String(eventoModal.evento.dados.pagamento_portal_id || ""))}`}
                      className="rounded-xl border px-3 py-2 text-sm font-bold text-destructive"
                    >
                      Resolver estorno no caixa
                    </a>
                  )}
                  {eventoModal.evento && (
                    <button
                      type="button"
                      aria-expanded={historico}
                      onClick={() => setHistorico((v) => !v)}
                      className="rounded-xl border px-3 py-2 text-sm font-bold"
                    >
                      {historico ? "Ocultar histórico" : "Ver histórico"}
                    </button>
                  )}
                  <div className="ml-auto flex gap-2">
                    <button
                      type="button"
                      disabled={salvando}
                      onClick={fecharEditor}
                      className="rounded-xl border px-3 py-2 text-sm font-bold"
                    >
                      Fechar
                    </button>
                    {eventoEditavel && (
                      <button
                        type="button"
                        disabled={salvando}
                        onClick={() => void salvarEvento()}
                        className="rounded-xl bg-primary px-3 py-2 text-sm font-bold text-primary-foreground disabled:opacity-40"
                      >
                        {salvando
                          ? "Salvando…"
                          : eventoModal.form.serieToda
                            ? "Salvar série"
                            : eventoModal.evento &&
                                (horaNoFuso(
                                  eventoModal.evento.inicio,
                                  eventoModal.agenda.timezone,
                                ) !== eventoModal.form.hora ||
                                  dataNoFuso(
                                    eventoModal.evento.inicio,
                                    eventoModal.agenda.timezone,
                                  ) !== eventoModal.form.data)
                              ? "Salvar reagendamento"
                              : "Salvar"}
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactElement }) {
  return (
    <label className="text-sm font-bold">
      {label}
      <span className="mt-1 block [&>input]:min-h-11 [&>input]:w-full [&>input]:rounded-xl [&>input]:border [&>input]:px-3 [&>input]:font-normal [&>select]:min-h-11 [&>select]:w-full [&>select]:rounded-xl [&>select]:border [&>select]:bg-white [&>select]:px-3 [&>select]:font-normal">
        {children}
      </span>
    </label>
  );
}
