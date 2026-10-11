import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Clock3, FileSignature, PawPrint, Search, Stethoscope, UsersRound } from "lucide-react";
import { useMemo } from "react";

export const Route = createFileRoute("/consultorio")({ component: Consultorio });

type Evento = {
  id: string;
  hora: string;
  tipo: string;
  paciente: string;
  tutor: string;
  animalId?: string;
  status?: string;
};

type Agenda = {
  id: string;
  nome: string;
  responsavel?: string;
  eventos?: Evento[];
};

function carregarAgendas(): Agenda[] {
  if (typeof window === "undefined") return [];
  try {
    const valor = JSON.parse(window.localStorage.getItem("oricse-agendas-v2") || "[]");
    return Array.isArray(valor) ? valor : [];
  } catch {
    return [];
  }
}

function Consultorio() {
  const agendas = useMemo(carregarAgendas, []);
  const atendimentos = useMemo(
    () =>
      agendas
        .flatMap((agenda) =>
          (agenda.eventos || []).map((evento) => ({
            ...evento,
            agendaNome: agenda.nome,
            responsavel: agenda.responsavel || "",
          })),
        )
        .filter((evento) => evento.status !== "Finalizado" && evento.status !== "Cancelado")
        .sort((a, b) => a.hora.localeCompare(b.hora)),
    [agendas],
  );

  const proximo = atendimentos[0];

  const itens = [
    { titulo: "Pesquisar animais", texto: "Histórico e prontuários", Icone: PawPrint, to: "/animais" },
    { titulo: "Pesquisar tutores", texto: "Cadastro e atendimentos", Icone: Search, to: "/tutores" },
    { titulo: "Recepção", texto: "Fila, agendas e novos atendimentos", Icone: UsersRound, to: "/recepcao" },
    { titulo: "Termos e documentos", texto: "Documentos da clínica", Icone: FileSignature, to: "/assinar" },
  ] as const;

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1500px] px-4 pb-28 pt-6 sm:px-6">
      <Link to="/" className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground">
        <ArrowLeft size={18} /> Voltar
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">Atendimento</p>
          <h1 className="mt-1 text-3xl font-bold">Consultório</h1>
          <p className="mt-1 text-muted-foreground">Atendimentos do dia, prontuários e documentos sem travar a tela.</p>
        </div>
        {proximo?.animalId ? (
          <Link
            to="/registro-clinico"
            search={{ animalId: proximo.animalId } as never}
            className="rounded-xl bg-primary px-4 py-2.5 font-semibold text-primary-foreground"
          >
            Abrir próximo atendimento
          </Link>
        ) : (
          <Link to="/recepcao" className="rounded-xl bg-primary px-4 py-2.5 font-semibold text-primary-foreground">
            Ir para Recepção
          </Link>
        )}
      </div>

      <section className="mt-6 rounded-2xl border bg-card shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-4 sm:px-5">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold"><Stethoscope size={20} className="text-primary" /> Atendimentos</h2>
            <p className="mt-1 text-sm text-muted-foreground">Lista leve dos pacientes aguardando atendimento.</p>
          </div>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-bold text-primary">{atendimentos.length}</span>
        </div>

        {atendimentos.length ? (
          <div className="divide-y">
            {atendimentos.map((evento) => (
              <div key={`${evento.agendaNome}-${evento.id}`} className="grid gap-3 px-4 py-4 sm:grid-cols-[90px_1fr_1fr_auto] sm:items-center sm:px-5">
                <div className="flex items-center gap-2 font-bold"><Clock3 size={16} className="text-primary" /> {evento.hora}</div>
                <div>
                  <div className="font-bold">{evento.paciente || "Paciente"}</div>
                  <div className="text-sm text-muted-foreground">Tutor: {evento.tutor || "—"}</div>
                </div>
                <div>
                  <div className="font-semibold">{evento.tipo}</div>
                  <div className="text-sm text-muted-foreground">{evento.agendaNome}{evento.responsavel ? ` · ${evento.responsavel}` : ""}</div>
                </div>
                {evento.animalId ? (
                  <Link
                    to="/registro-clinico"
                    search={{ animalId: evento.animalId } as never}
                    className="rounded-xl bg-primary px-4 py-2 text-center text-sm font-bold text-primary-foreground"
                  >
                    Atender
                  </Link>
                ) : (
                  <Link to="/recepcao" className="rounded-xl border px-4 py-2 text-center text-sm font-bold hover:border-primary">
                    Vincular paciente
                  </Link>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="px-4 py-12 text-center text-muted-foreground">
            Nenhum atendimento pendente na agenda.
          </div>
        )}
      </section>

      <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {itens.map(({ titulo, texto, Icone, to }) => (
          <Link key={titulo} to={to} className="rounded-2xl border bg-card p-4 text-left shadow-sm transition hover:border-primary hover:shadow-md">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10"><Icone className="text-primary" size={20} /></div>
            <h2 className="mt-3 font-semibold">{titulo}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{texto}</p>
          </Link>
        ))}
      </section>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Link to="/receituario" className="rounded-2xl border bg-white p-4 font-semibold shadow-sm hover:border-primary">Receituário avulso</Link>
        <Link to="/assinar" className="rounded-2xl border bg-white p-4 font-semibold shadow-sm hover:border-primary">Assinar um documento</Link>
      </div>
    </main>
  );
}
