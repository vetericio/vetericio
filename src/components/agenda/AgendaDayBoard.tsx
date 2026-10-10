import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  RotateCcw,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export type AgendaMode = "recepcao" | "veterinario";
type Tom = "azul" | "verde" | "amarelo" | "rosa" | "roxo";
type Origem = "Tutor no app" | "Recepção";
type Pagamento = "Pago" | "Pendente" | "Presencial" | "Isento";
type StatusEvento = "Agendado" | "Em atendimento" | "Finalizado" | "Cancelado";
type Especie = "Cão" | "Gato" | "Ave" | "Hamster" | "Cobra" | "Bovino" | "Equino" | "Outro";

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
  eventos: Evento[];
};

const BASE: ColunaAgenda[] = [
  {
    id: "agenda-1",
    nome: "Agenda 1",
    responsavel: "Dra. Ana Costa",
    eventos: [
      { id: "e1", hora: "08:00", tipo: "Consulta", paciente: "Max", tutor: "Carlos Souza", especie: "Cão", origem: "Tutor no app", pagamento: "Pago", status: "Agendado", tom: "azul" },
      { id: "e2", hora: "09:30", tipo: "Vacina", paciente: "Luna", tutor: "Renata Lima", especie: "Gato", origem: "Recepção", pagamento: "Presencial", status: "Agendado", tom: "verde" },
      { id: "e3", hora: "11:00", tipo: "Retorno", paciente: "Thor", tutor: "Marcos Silva", especie: "Cão", origem: "Tutor no app", pagamento: "Pago", status: "Em atendimento", tom: "amarelo" },
      { id: "e4", hora: "14:00", tipo: "Consulta", paciente: "Maya", tutor: "Fernanda Alves", especie: "Gato", origem: "Recepção", pagamento: "Pendente", status: "Agendado", tom: "azul" },
    ],
  },
  {
    id: "agenda-2",
    nome: "Agenda 2",
    responsavel: "Dr. Bruno Almeida",
    eventos: [
      { id: "e5", hora: "08:30", tipo: "Banho", paciente: "Mel", tutor: "Paula Costa", especie: "Cão", origem: "Tutor no app", pagamento: "Pago", status: "Agendado", tom: "roxo" },
      { id: "e6", hora: "10:00", tipo: "Tosa", paciente: "Bob", tutor: "João Freitas", especie: "Cão", origem: "Recepção", pagamento: "Presencial", status: "Agendado", tom: "rosa" },
      { id: "e7", hora: "13:00", tipo: "Consulta", paciente: "Nina", tutor: "Lívia Rocha", especie: "Gato", origem: "Tutor no app", pagamento: "Pago", status: "Agendado", tom: "azul" },
    ],
  },
  {
    id: "agenda-3",
    nome: "Agenda 3",
    responsavel: "Dra. Juliana Ribeiro",
    eventos: [
      { id: "e8", hora: "08:00", tipo: "Consulta", paciente: "Bidu", tutor: "André Martins", especie: "Ave", origem: "Recepção", pagamento: "Presencial", status: "Agendado", tom: "azul" },
      { id: "e9", hora: "10:30", tipo: "Retorno", paciente: "Maggie", tutor: "Sofia Mendes", especie: "Hamster", origem: "Tutor no app", pagamento: "Pago", status: "Agendado", tom: "amarelo" },
      { id: "e10", hora: "14:00", tipo: "Vacina", paciente: "Zoe", tutor: "Pedro Lima", especie: "Cão", origem: "Recepção", pagamento: "Pendente", status: "Agendado", tom: "verde" },
    ],
  },
  {
    id: "agenda-4",
    nome: "Agenda 4",
    responsavel: "Banho e tosa",
    eventos: [
      { id: "e11", hora: "09:00", tipo: "Banho", paciente: "Simba", tutor: "Marina Prado", especie: "Cão", origem: "Tutor no app", pagamento: "Pago", status: "Agendado", tom: "roxo" },
      { id: "e12", hora: "11:00", tipo: "Tosa", paciente: "Nina", tutor: "Clara Nunes", especie: "Gato", origem: "Recepção", pagamento: "Presencial", status: "Agendado", tom: "rosa" },
      { id: "e13", hora: "15:00", tipo: "Banho", paciente: "Fred", tutor: "Lucas Dias", especie: "Cão", origem: "Tutor no app", pagamento: "Pago", status: "Agendado", tom: "roxo" },
    ],
  },
];

const TOM: Record<Tom, string> = {
  azul: "bg-sky-50 text-sky-800 border-sky-100",
  verde: "bg-emerald-50 text-emerald-800 border-emerald-100",
  amarelo: "bg-amber-50 text-amber-800 border-amber-100",
  rosa: "bg-rose-50 text-rose-800 border-rose-100",
  roxo: "bg-violet-50 text-violet-800 border-violet-100",
};

const TIPOS: Record<string, Tom> = {
  Consulta: "azul",
  Cirurgia: "rosa",
  Retorno: "amarelo",
  Vacina: "verde",
  Banho: "roxo",
  Tosa: "rosa",
  Procedimento: "verde",
};

const ESPECIES: Especie[] = ["Cão", "Gato", "Ave", "Hamster", "Cobra", "Bovino", "Equino", "Outro"];

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

function gerarHorarios(duracao: number) {
  const intervalo = Math.max(5, Number(duracao) || 30);
  const horarios: string[] = [];
  for (let minuto = 8 * 60; minuto < 24 * 60; minuto += intervalo) {
    horarios.push(minutosEmHora(minuto));
  }
  return horarios;
}

function ordenarEventos(eventos: Evento[]) {
  return [...eventos].sort((a, b) => horaEmMinutos(a.hora) - horaEmMinutos(b.hora));
}

function normalizarAgendas(agendas: ColunaAgenda[]): ColunaAgenda[] {
  return agendas.map((agenda) => ({
    ...agenda,
    eventos: ordenarEventos(agenda.eventos.map((evento) => ({ ...evento, especie: evento.especie || "Outro" }))),
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

export function AgendaDayBoard({ mode }: { mode: AgendaMode }) {
  const [agendas, setAgendas] = useState<ColunaAgenda[]>(carregarAgendas);
  const [data, setData] = useState(() => new Date());
  const [filtro, setFiltro] = useState("todas");
  const [eventoAberto, setEventoAberto] = useState<{ agendaId: string; evento: Evento } | null>(null);
  const [animalAberto, setAnimalAberto] = useState<Evento | null>(null);
  const [criandoAgenda, setCriandoAgenda] = useState(false);
  const [confirmacao, setConfirmacao] = useState<{ agendaId: string; evento: Evento } | null>(null);
  const [novaAgenda, setNovaAgenda] = useState({ nome: "Consultas", responsavel: "" });
  const [duracaoPadrao, setDuracaoPadrao] = useState(30);

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
        const { data: vinculo } = await (supabase as any)
          .from("clinica_usuarios")
          .select("clinica_id")
          .eq("user_id", userId)
          .eq("ativo", true)
          .limit(1)
          .maybeSingle();
        if (!vinculo?.clinica_id) return;
        const { data: clinica } = await (supabase as any)
          .from("clinicas")
          .select("duracao_padrao_atendimento_min")
          .eq("id", vinculo.clinica_id)
          .maybeSingle();
        const valor = Number(clinica?.duracao_padrao_atendimento_min);
        if (ativo && Number.isFinite(valor) && valor >= 5 && valor <= 720) setDuracaoPadrao(valor);
      } catch (e) {
        console.error("Não foi possível carregar a duração padrão da clínica:", e);
      }
    }
    void carregarDuracaoDaClinica();
    return () => { ativo = false; };
  }, []);

  const visiveis = useMemo(() => filtro === "todas" ? agendas : agendas.filter((a) => a.id === filtro), [agendas, filtro]);
  const titulo = mode === "recepcao" ? "Agenda do dia" : "Minha agenda";
  const subtitulo = mode === "recepcao"
    ? "Visualize os horários da clínica, organize chegadas e acompanhe a fila."
    : "Acompanhe consultas, retornos e procedimentos previstos para hoje.";

  function mudarDia(delta: number) {
    setData((atual) => {
      const d = new Date(atual);
      d.setDate(d.getDate() + delta);
      return d;
    });
  }

  function criarAgenda() {
    if (agendas.length >= 10) return;
    const id = `agenda-${Date.now()}`;
    const nome = novaAgenda.nome.trim() || `Agenda ${agendas.length + 1}`;
    setAgendas((lista) => [...lista, { id, nome, responsavel: novaAgenda.responsavel.trim() || "Sem responsável", eventos: [] }]);
    setFiltro(id);
    setNovaAgenda({ nome: "Consultas", responsavel: "" });
    setCriandoAgenda(false);
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
    return gerarHorarios(duracaoPadrao).find((hora) => !horarioConflita(agenda, hora)) || null;
  }

  function adicionarHorario(agendaId: string) {
    const agenda = agendas.find((a) => a.id === agendaId);
    if (!agenda) return;
    const horaLivre = proximoHorarioLivre(agenda);
    if (!horaLivre) {
      toast.error("Não há horário livre nesta agenda para a duração configurada.");
      return;
    }
    const novo: Evento = {
      id: `evento-${Date.now()}`,
      hora: horaLivre,
      tipo: "Consulta",
      paciente: "Novo paciente",
      tutor: "Tutor",
      especie: "Cão",
      origem: "Recepção",
      pagamento: "Pendente",
      status: "Agendado",
      tom: "azul",
    };
    setEventoAberto({ agendaId, evento: novo });
  }

  function salvarEvento(agendaId: string, evento: Evento) {
    const agenda = agendas.find((a) => a.id === agendaId);
    if (!agenda) return;
    if (horarioConflita(agenda, evento.hora, evento.id, evento.status)) {
      toast.error("Agenda ocupada neste horário. Escolha outro horário disponível.");
      return;
    }
    setAgendas((lista) => lista.map((a) => {
      if (a.id !== agendaId) return a;
      const existe = a.eventos.some((e) => e.id === evento.id);
      const eventos = existe ? a.eventos.map((e) => e.id === evento.id ? evento : e) : [...a.eventos, evento];
      return { ...a, eventos: ordenarEventos(eventos) };
    }));
    setEventoAberto(null);
  }

  function definirStatus(agendaId: string, eventoId: string, status: StatusEvento) {
    setAgendas((lista) => lista.map((a) => a.id === agendaId ? { ...a, eventos: ordenarEventos(a.eventos.map((e) => e.id === eventoId ? { ...e, status } : e)) } : a));
  }

  function confirmarFinalizacao() {
    if (!confirmacao) return;
    definirStatus(confirmacao.agendaId, confirmacao.evento.id, "Finalizado");
    setConfirmacao(null);
    setEventoAberto(null);
  }

  return (
    <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CalendarDays size={22} className="text-primary" />
            <h2 className="text-2xl font-bold">{titulo}</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{subtitulo}</p>
          <p className="mt-1 text-xs font-semibold text-primary">Duração padrão definida pela clínica: {duracaoPadrao} min</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={filtro} onChange={(e) => setFiltro(e.target.value)} className="min-h-11 rounded-xl border bg-white px-3 text-sm font-semibold">
            <option value="todas">Todas as agendas</option>
            {agendas.map((a) => <option key={a.id} value={a.id}>{a.nome} · {a.responsavel}</option>)}
          </select>
          <button type="button" onClick={() => setCriandoAgenda(true)} disabled={agendas.length >= 10} className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm font-semibold disabled:opacity-40">
            <Plus size={16} /> Criar agenda
          </button>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-[#f8faf8] p-3 sm:p-4">
        <button type="button" onClick={() => mudarDia(-1)} className="rounded-xl border bg-white p-3" aria-label="Dia anterior"><ChevronLeft size={20} /></button>
        <button type="button" onClick={() => setData(new Date())} className="min-w-[280px] flex-1 px-4 text-center">
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-primary">DATA DA AGENDA</div>
          <div className="mt-1 text-xl font-black tracking-tight sm:text-2xl">{formatarData(data)}</div>
          <div className="mt-1 text-xs text-muted-foreground">Clique para voltar para hoje</div>
        </button>
        <button type="button" onClick={() => mudarDia(1)} className="rounded-xl border bg-white p-3" aria-label="Próximo dia"><ChevronRight size={20} /></button>
      </div>

      <div className={`mt-5 grid gap-3 ${visiveis.length === 1 ? "max-w-xl grid-cols-1" : "xl:grid-cols-4"}`}>
        {visiveis.map((agenda) => (
          <article key={agenda.id} className="overflow-hidden rounded-xl border bg-[#fcfcfb]">
            <header className="border-b bg-white px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-emerald-600" /><h3 className="font-bold">{agenda.nome}</h3></div>
                <button type="button" onClick={() => {
                  const nome = window.prompt("Nome da agenda", agenda.nome);
                  const responsavel = window.prompt("Responsável", agenda.responsavel);
                  if (nome) setAgendas((l) => l.map((x) => x.id === agenda.id ? { ...x, nome, responsavel: responsavel || x.responsavel } : x));
                }} className="rounded-lg p-1.5 text-muted-foreground hover:bg-slate-100"><Pencil size={15} /></button>
              </div>
              <p className="mt-0.5 pl-[18px] text-xs text-muted-foreground">{agenda.responsavel}</p>
            </header>

            <div className="space-y-3 p-3">
              {ordenarEventos(agenda.eventos).map((evento) => {
                const finalizado = evento.status === "Finalizado";
                return (
                  <div key={evento.id} className={`rounded-xl border p-3.5 ${finalizado ? "border-slate-200 bg-slate-50 text-slate-700" : TOM[evento.tom]}`}>
                    <button type="button" onClick={() => setEventoAberto({ agendaId: agenda.id, evento })} className="flex w-full items-baseline gap-2 text-left">
                      <strong className="text-sm font-black text-slate-900">{formatarHora(evento.hora)}</strong>
                      <span className="text-sm font-bold">{evento.tipo}</span>
                      {finalizado && <span className="ml-auto text-[10px] font-bold uppercase tracking-wide text-slate-500">Finalizado</span>}
                    </button>
                    <button type="button" onClick={() => setAnimalAberto(evento)} className="mt-2 block w-full text-left text-sm font-black text-slate-950 underline-offset-2 hover:underline">
                      <span className="mr-1.5" aria-hidden="true">{emojiEspecie(evento.especie)}</span>
                      {evento.paciente.toUpperCase()} <span className="font-medium text-slate-600">({evento.tutor})</span>
                    </button>
                    <div className="mt-1.5 text-xs font-semibold text-slate-600">
                      {origemCurta(evento.origem)} <span className="px-1 text-slate-400">·</span> <span className={evento.pagamento === "Pago" ? "text-emerald-700" : evento.pagamento === "Pendente" ? "text-amber-700" : "text-slate-700"}>{evento.pagamento}</span>
                    </div>
                    {!finalizado ? (
                      <button type="button" onClick={() => setConfirmacao({ agendaId: agenda.id, evento })} className="mt-3 inline-flex min-h-9 items-center gap-1.5 font-bold text-emerald-700 hover:underline">
                        <CheckCircle2 size={15} /> Finalizar atendimento
                      </button>
                    ) : (
                      <button type="button" onClick={() => definirStatus(agenda.id, evento.id, "Em atendimento")} className="mt-3 inline-flex min-h-9 items-center gap-1.5 font-bold text-slate-700 hover:underline">
                        <RotateCcw size={15} /> Voltar atendimento
                      </button>
                    )}
                  </div>
                );
              })}
              <button type="button" onClick={() => adicionarHorario(agenda.id)} className="w-full rounded-lg border border-dashed px-3 py-2 text-xs font-semibold text-muted-foreground hover:border-primary hover:text-primary">
                + Adicionar horário
              </button>
            </div>
          </article>
        ))}
      </div>

      {criandoAgenda && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between"><h3 className="text-xl font-bold">Criar agenda</h3><button onClick={() => setCriandoAgenda(false)}><X /></button></div>
            <p className="mt-1 text-sm text-muted-foreground">Crie por setor, serviço ou profissional. Máximo de 10 agendas.</p>
            <div className="mt-4 space-y-3">
              <label className="block text-sm font-semibold">Nome da agenda
                <select value={novaAgenda.nome} onChange={(e) => setNovaAgenda({ ...novaAgenda, nome: e.target.value })} className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal">
                  <option>Consultas</option><option>Cirurgias</option><option>Banhos e tosas</option><option>Vacinação</option><option>Internação</option><option>Dr. Luciano Rodrigues</option><option>Dr. Márcio Mendes</option><option>Dra. Mariana Lima</option>
                </select>
              </label>
              <label className="block text-sm font-semibold">Responsável / descrição
                <input value={novaAgenda.responsavel} onChange={(e) => setNovaAgenda({ ...novaAgenda, responsavel: e.target.value })} placeholder="Ex.: Dr. Luciano Rodrigues" className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal" />
              </label>
              <button onClick={criarAgenda} className="w-full rounded-xl bg-primary px-4 py-3 font-bold text-primary-foreground">Criar agenda</button>
            </div>
          </div>
        </div>
      )}

      {eventoAberto && (() => {
        const agendaAtual = agendas.find((a) => a.id === eventoAberto.agendaId);
        if (!agendaAtual) return null;
        return (
          <EditorEvento
            value={eventoAberto.evento}
            agenda={agendaAtual}
            duracaoPadrao={duracaoPadrao}
            onClose={() => setEventoAberto(null)}
            onSave={(evento) => salvarEvento(eventoAberto.agendaId, evento)}
            onFinish={() => setConfirmacao({ agendaId: eventoAberto.agendaId, evento: eventoAberto.evento })}
            conflita={(hora, eventoId, status) => horarioConflita(agendaAtual, hora, eventoId, status)}
          />
        );
      })()}

      {confirmacao && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-xl font-bold">Finalizar atendimento</h3>
            <p className="mt-3 text-sm text-slate-700">Tem certeza que deseja finalizar o atendimento de <strong>{confirmacao.evento.paciente.toUpperCase()}</strong>?</p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setConfirmacao(null)} className="rounded-xl border px-4 py-2.5 font-semibold">Cancelar</button>
              <button onClick={confirmarFinalizacao} className="rounded-xl bg-primary px-4 py-2.5 font-bold text-primary-foreground">Sim, finalizar</button>
            </div>
          </div>
        </div>
      )}

      {animalAberto && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/25" onClick={() => setAnimalAberto(null)}>
          <aside onClick={(e) => e.stopPropagation()} className="h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-primary">Ficha do animal</p>
                <h3 className="mt-1 text-3xl font-black">{emojiEspecie(animalAberto.especie)} {animalAberto.paciente.toUpperCase()}</h3>
                <p className="text-muted-foreground">Tutor: {animalAberto.tutor}</p>
              </div>
              <button onClick={() => setAnimalAberto(null)}><X /></button>
            </div>
            <div className="mt-6 grid gap-3">
              <div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Espécie</p><p className="mt-1 font-bold">{animalAberto.especie || "Outro"}</p></div>
              <div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Atendimento agendado</p><p className="mt-1 font-bold">{animalAberto.tipo} · {animalAberto.hora}</p></div>
              <div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Origem</p><p className="mt-1 font-bold">{animalAberto.origem}</p></div>
              <div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Pagamento</p><p className="mt-1 font-bold">{animalAberto.pagamento}</p></div>
            </div>
            <div className="mt-6 grid gap-2">
              <button className="rounded-xl bg-primary px-4 py-3 font-bold text-primary-foreground">Abrir cadastro e prontuário</button>
              <button className="rounded-xl border px-4 py-3 font-semibold">Histórico de atendimentos</button>
              <button className="rounded-xl border px-4 py-3 font-semibold">Exames e receitas</button>
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}

function EditorEvento({
  value,
  agenda,
  duracaoPadrao,
  onClose,
  onSave,
  onFinish,
  conflita,
}: {
  value: Evento;
  agenda: ColunaAgenda;
  duracaoPadrao: number;
  onClose: () => void;
  onSave: (evento: Evento) => void;
  onFinish: () => void;
  conflita: (hora: string, eventoId?: string, status?: StatusEvento) => boolean;
}) {
  const [evento, setEvento] = useState<Evento>({ ...value, especie: value.especie || "Outro" });
  const horarios = useMemo(() => gerarHorarios(duracaoPadrao), [duracaoPadrao]);

  const horariosComAtual = useMemo(() => {
    if (horarios.includes(evento.hora)) return horarios;
    return [...horarios, evento.hora].sort((a, b) => horaEmMinutos(a) - horaEmMinutos(b));
  }, [horarios, evento.hora]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between"><h3 className="text-xl font-bold">Editar agendamento</h3><button onClick={onClose}><X /></button></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold">Horário
            <select value={evento.hora} onChange={(e) => setEvento({ ...evento, hora: e.target.value })} className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal">
              {horariosComAtual.map((hora) => {
                const ocupado = hora !== value.hora && conflita(hora, evento.id, evento.status);
                return <option key={hora} value={hora} disabled={ocupado}>{hora}{ocupado ? " — ocupado" : ""}</option>;
              })}
            </select>
            <span className="mt-1 block text-[11px] font-medium text-muted-foreground">Intervalos de {duracaoPadrao} min definidos pela clínica.</span>
          </label>
          <label className="text-sm font-semibold">Tipo
            <select value={evento.tipo} onChange={(e) => setEvento({ ...evento, tipo: e.target.value, tom: TIPOS[e.target.value] || "azul" })} className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal">
              {Object.keys(TIPOS).map((x) => <option key={x}>{x}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold">Animal
            <input value={evento.paciente} onChange={(e) => setEvento({ ...evento, paciente: e.target.value })} className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal" />
          </label>
          <label className="text-sm font-semibold">Tutor
            <input value={evento.tutor} onChange={(e) => setEvento({ ...evento, tutor: e.target.value })} className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal" />
          </label>
          <label className="text-sm font-semibold">Espécie
            <select value={evento.especie || "Outro"} onChange={(e) => setEvento({ ...evento, especie: e.target.value as Especie })} className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal">
              {ESPECIES.map((especie) => <option key={especie} value={especie}>{emojiEspecie(especie)} {especie}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold">Quem marcou
            <select value={evento.origem} onChange={(e) => setEvento({ ...evento, origem: e.target.value as Origem })} className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal">
              <option>Tutor no app</option><option>Recepção</option>
            </select>
          </label>
          <label className="text-sm font-semibold">Pagamento
            <select value={evento.pagamento} onChange={(e) => setEvento({ ...evento, pagamento: e.target.value as Pagamento })} className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal">
              <option>Pago</option><option>Pendente</option><option>Presencial</option><option>Isento</option>
            </select>
          </label>
          <label className="text-sm font-semibold">Status
            <select value={evento.status} onChange={(e) => setEvento({ ...evento, status: e.target.value as StatusEvento })} className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal">
              <option>Agendado</option><option>Em atendimento</option><option>Finalizado</option><option>Cancelado</option>
            </select>
          </label>
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button onClick={onFinish} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 font-semibold text-emerald-700"><CheckCircle2 size={16} /> Finalizar</button>
          <button onClick={() => onSave(evento)} className="rounded-xl bg-primary px-4 py-2.5 font-bold text-primary-foreground">Salvar alterações</button>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">Agenda: {agenda.nome} · horários ocupados ficam indisponíveis.</p>
      </div>
    </div>
  );
}
