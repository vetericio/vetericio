import { Link } from "@tanstack/react-router";
import { CalendarDays, Clock3, Plus, Stethoscope } from "lucide-react";
import { useMemo } from "react";

const AGENDAS_KEY = "oricse-agendas-v2";

type EventoAgenda = {
  id: string;
  hora: string;
  data?: string;
  tipo?: string;
  paciente?: string;
  tutor?: string;
  tutorId?: string;
  animalId?: string;
  status?: string;
  pagamento?: string;
};

type Agenda = {
  id: string;
  nome: string;
  responsavel?: string;
  eventos?: EventoAgenda[];
};

type AgendamentoAnimal = EventoAgenda & {
  agendaId: string;
  agendaNome: string;
  responsavel: string;
};

function lerAgendas(): Agenda[] {
  if (typeof window === "undefined") return [];
  try {
    const valor = JSON.parse(window.localStorage.getItem(AGENDAS_KEY) || "[]");
    return Array.isArray(valor) ? valor : [];
  } catch {
    return [];
  }
}

function formatarData(data?: string) {
  if (!data) return "Data não registrada";
  const [ano, mes, dia] = data.slice(0, 10).split("-");
  if (!ano || !mes || !dia) return data;
  return `${dia}/${mes}/${ano}`;
}

function instante(item: AgendamentoAnimal) {
  if (!item.data) return Number.NEGATIVE_INFINITY;
  const valor = new Date(`${item.data.slice(0, 10)}T${item.hora || "00:00"}:00`).getTime();
  return Number.isFinite(valor) ? valor : Number.NEGATIVE_INFINITY;
}

function ordenarPorProximidade(itens: AgendamentoAnimal[]) {
  const agora = Date.now();
  const futuros = itens
    .filter((item) => instante(item) >= agora)
    .sort((a, b) => instante(a) - instante(b));
  const passados = itens
    .filter((item) => instante(item) < agora)
    .sort((a, b) => instante(b) - instante(a));
  return [...futuros, ...passados];
}

export function AgendamentosAnimal({ animalId, tutorId }: { animalId: string; tutorId: string }) {
  const agendamentos = useMemo(() => {
    const itens: AgendamentoAnimal[] = [];
    lerAgendas().forEach((agenda) => {
      (agenda.eventos || []).forEach((evento) => {
        if (evento.animalId !== animalId || evento.status === "Cancelado") return;
        itens.push({
          ...evento,
          agendaId: agenda.id,
          agendaNome: agenda.nome,
          responsavel: agenda.responsavel || "Sem responsável",
        });
      });
    });
    return ordenarPorProximidade(itens);
  }, [animalId]);

  const agora = Date.now();

  return (
    <section className="mt-4 overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/20 px-4 py-3">
        <div>
          <div className="flex items-center gap-2">
            <CalendarDays size={19} className="text-primary" />
            <h2 className="text-xl font-black">Agendamentos</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Escolha o veterinário, depois a data e um horário livre.</p>
        </div>
        <Link
          to="/encaminhar"
          search={{ tutorId, animalId, retorno: "animal" } as never}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-black text-primary-foreground"
        >
          <Plus size={16} /> Novo agendamento
        </Link>
      </div>

      <div className="p-4">
        <div className="mb-3 text-xs font-black uppercase tracking-wide text-muted-foreground">Histórico de agendamentos</div>
        {agendamentos.length ? (
          <div className="space-y-2.5">
            {agendamentos.map((item) => {
              const futuro = instante(item) >= agora;
              return (
                <article key={`${item.agendaId}-${item.id}`} className="rounded-xl border bg-white p-3.5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <strong className="text-base">{formatarData(item.data)}</strong>
                        <span className="inline-flex items-center gap-1 text-sm font-bold text-primary"><Clock3 size={14} /> {item.hora}</span>
                        {futuro && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-700">Próximo</span>}
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 text-sm font-bold"><Stethoscope size={14} className="text-primary" /> {item.responsavel}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{item.agendaNome} · {item.tipo || "Atendimento"}</div>
                    </div>
                    <div className="text-right text-xs">
                      <div className="font-bold">{item.status || "Agendado"}</div>
                      {item.pagamento && <div className="mt-1 text-muted-foreground">{item.pagamento === "Pendente" ? "Pagamento pendente" : item.pagamento}</div>}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed bg-slate-50 px-4 py-10 text-center text-muted-foreground">
            <CalendarDays className="mx-auto mb-3 opacity-30" size={34} />
            <p>Nenhum agendamento registrado para este animal.</p>
          </div>
        )}
      </div>
    </section>
  );
}
