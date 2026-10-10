import { CalendarDays, ChevronLeft, ChevronRight, Clock3, PawPrint } from "lucide-react";

export type AgendaMode = "recepcao" | "veterinario";

type Evento = {
  hora: string;
  tipo: string;
  paciente: string;
  tutor?: string;
  tom: "azul" | "verde" | "amarelo" | "rosa" | "roxo";
};

type ColunaAgenda = {
  nome: string;
  responsavel: string;
  eventos: Evento[];
};

const agendas: ColunaAgenda[] = [
  {
    nome: "Agenda 1",
    responsavel: "Dra. Ana Costa",
    eventos: [
      { hora: "08:00", tipo: "Consulta", paciente: "Max", tutor: "Carlos", tom: "azul" },
      { hora: "09:30", tipo: "Vacina", paciente: "Luna", tutor: "Renata", tom: "verde" },
      { hora: "11:00", tipo: "Retorno", paciente: "Thor", tutor: "Marcos", tom: "amarelo" },
      { hora: "14:00", tipo: "Consulta", paciente: "Maya", tutor: "Fernanda", tom: "azul" },
    ],
  },
  {
    nome: "Agenda 2",
    responsavel: "Dr. Bruno Almeida",
    eventos: [
      { hora: "08:30", tipo: "Banho", paciente: "Mel", tutor: "Paula", tom: "roxo" },
      { hora: "10:00", tipo: "Tosa", paciente: "Bob", tutor: "João", tom: "rosa" },
      { hora: "13:00", tipo: "Consulta", paciente: "Nina", tutor: "Lívia", tom: "azul" },
      { hora: "15:30", tipo: "Retorno", paciente: "Apolo", tutor: "Raquel", tom: "amarelo" },
    ],
  },
  {
    nome: "Agenda 3",
    responsavel: "Dra. Juliana Ribeiro",
    eventos: [
      { hora: "08:00", tipo: "Consulta", paciente: "Bidu", tutor: "André", tom: "azul" },
      { hora: "10:30", tipo: "Retorno", paciente: "Maggie", tutor: "Sofia", tom: "amarelo" },
      { hora: "14:00", tipo: "Vacina", paciente: "Zoe", tutor: "Pedro", tom: "verde" },
    ],
  },
  {
    nome: "Agenda 4",
    responsavel: "Banho e tosa",
    eventos: [
      { hora: "09:00", tipo: "Banho", paciente: "Simba", tutor: "Marina", tom: "roxo" },
      { hora: "11:00", tipo: "Tosa", paciente: "Nina", tutor: "Clara", tom: "rosa" },
      { hora: "15:00", tipo: "Banho", paciente: "Fred", tutor: "Lucas", tom: "roxo" },
    ],
  },
];

const TOM: Record<Evento["tom"], string> = {
  azul: "bg-sky-50 text-sky-700 border-sky-100",
  verde: "bg-emerald-50 text-emerald-700 border-emerald-100",
  amarelo: "bg-amber-50 text-amber-700 border-amber-100",
  rosa: "bg-rose-50 text-rose-700 border-rose-100",
  roxo: "bg-violet-50 text-violet-700 border-violet-100",
};

function dataHoje() {
  const hoje = new Date();
  return hoje.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
}

export function AgendaDayBoard({ mode }: { mode: AgendaMode }) {
  const titulo = mode === "recepcao" ? "Agenda do dia" : "Minha agenda";
  const subtitulo = mode === "recepcao"
    ? "Visualize os horários da clínica, organize chegadas e acompanhe a fila."
    : "Acompanhe consultas, retornos e procedimentos previstos para hoje.";

  return (
    <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <CalendarDays size={20} className="text-primary" />
            <h2 className="text-xl font-bold">{titulo}</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{subtitulo}</p>
        </div>
        <div className="flex items-center overflow-hidden rounded-xl border bg-white">
          <button type="button" className="p-2.5 hover:bg-slate-50" aria-label="Dia anterior"><ChevronLeft size={17}/></button>
          <div className="border-x px-4 py-2 text-sm font-semibold capitalize">{dataHoje()}</div>
          <button type="button" className="p-2.5 hover:bg-slate-50" aria-label="Próximo dia"><ChevronRight size={17}/></button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 xl:grid-cols-4">
        {agendas.map((agenda) => (
          <article key={agenda.nome} className="overflow-hidden rounded-xl border bg-[#fcfcfb]">
            <header className="border-b bg-white px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
                <h3 className="font-bold">{agenda.nome}</h3>
              </div>
              <p className="mt-0.5 pl-[18px] text-xs text-muted-foreground">{agenda.responsavel}</p>
            </header>
            <div className="space-y-2 p-3">
              {agenda.eventos.map((evento, indice) => (
                <button key={`${agenda.nome}-${evento.hora}-${indice}`} type="button" className="grid w-full grid-cols-[52px_1fr] items-center gap-2 text-left">
                  <span className="flex items-center gap-1 text-xs font-semibold text-slate-500"><Clock3 size={12}/>{evento.hora}</span>
                  <span className={`rounded-lg border px-2.5 py-2 ${TOM[evento.tom]}`}>
                    <span className="flex items-center justify-between gap-2">
                      <strong className="text-xs">{evento.tipo}</strong>
                      <PawPrint size={13}/>
                    </span>
                    <span className="mt-0.5 block truncate text-xs opacity-80">{evento.paciente}{mode === "recepcao" && evento.tutor ? ` · ${evento.tutor}` : ""}</span>
                  </span>
                </button>
              ))}
              <button type="button" className="w-full rounded-lg border border-dashed px-3 py-2 text-xs font-semibold text-muted-foreground hover:border-primary hover:text-primary">+ Adicionar horário</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
