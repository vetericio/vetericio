import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CalendarDays, ClipboardList, PawPrint, Plus, UserRound } from "lucide-react";
import { AgendaDayBoard } from "@/components/agenda/AgendaDayBoard";

export const Route = createFileRoute("/recepcao")({ component: Recepcao });

function Recepcao() {
  const itens = [
    ["Adicionar / consultar tutor", "Cadastre e encontre tutores", UserRound],
    ["Adicionar / consultar animal", "Pacientes e responsáveis", PawPrint],
    ["Fila de espera", "Envie a próxima consulta", ClipboardList],
    ["Novo agendamento", "Organize os horários", CalendarDays],
    ["Aniversariantes do dia", "Datas importantes", CalendarDays],
    ["Reforços próximos", "Vacinas e vermifugação", Plus],
  ] as const;

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1500px] px-4 pb-28 pt-6 sm:px-6">
      <Link to="/" className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft size={18}/> Voltar</Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">Atendimento</p>
          <h1 className="mt-1 text-3xl font-bold">Recepção</h1>
          <p className="mt-1 text-muted-foreground">Cadastros, fila e agenda da clínica em uma única visão.</p>
        </div>
        <button type="button" className="rounded-xl bg-primary px-4 py-2.5 font-semibold text-primary-foreground">+ Novo agendamento</button>
      </div>

      <div className="mt-6">
        <AgendaDayBoard mode="recepcao" />
      </div>

      <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {itens.map(([titulo, texto, Icone]) => (
          <button key={titulo} className="rounded-2xl border bg-card p-4 text-left shadow-sm transition hover:border-primary hover:shadow-md">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10"><Icone className="text-primary" size={20}/></div>
              <div>
                <h2 className="font-semibold">{titulo}</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">{texto}</p>
              </div>
            </div>
          </button>
        ))}
      </section>
    </main>
  );
}
