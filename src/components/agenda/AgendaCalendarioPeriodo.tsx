import type { VisaoAgenda } from "@/lib/agenda-operacional";

type Evento = { id: string; titulo: string; hora: string; estado: string; abrir: () => void };
type Dia = { data: string; atual: boolean; foraMes: boolean; eventos: Evento[]; abrir: () => void };
export function AgendaCalendarioPeriodo({ dias, visao }: { dias: Dia[]; visao: VisaoAgenda }) {
  const limite = visao === "mes" ? 3 : 7;
  return (
    <div
      className="mt-4 overflow-x-auto pb-2"
      aria-label={visao === "mes" ? "Calendário mensal" : "Calendário semanal"}
    >
      <div className="grid min-w-[690px] grid-cols-7 gap-2">
        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
          <div className="px-2 py-1 text-center text-xs font-bold text-muted-foreground" key={d}>
            {d}
          </div>
        ))}
        {dias.map((d) => (
          <div
            key={d.data}
            className={`min-h-28 min-w-0 space-y-1 rounded-xl border p-2 ${d.atual ? "border-primary/60 bg-primary/5" : "bg-card"} ${d.foraMes ? "opacity-55" : ""}`}
          >
            <button
              type="button"
              aria-label={`Abrir dia ${d.data}`}
              onClick={d.abrir}
              className="flex w-full items-center justify-between gap-1 rounded-md px-1 py-0.5 text-sm font-bold hover:bg-muted"
            >
              <span>{d.data.slice(-2)}</span>
              <span className="text-[10px] font-medium text-muted-foreground">
                {d.eventos.length || "—"}
              </span>
            </button>
            {d.eventos.slice(0, limite).map((e) => (
              <button
                type="button"
                key={e.id}
                onClick={e.abrir}
                className="block w-full truncate rounded-md border border-primary/15 bg-primary/5 px-1.5 py-1 text-left text-[10px] hover:border-primary"
                title={`${e.hora} ${e.titulo} · ${e.estado}`}
              >
                <strong>{e.hora}</strong> {e.titulo}
                <span className="block truncate text-muted-foreground">{e.estado}</span>
              </button>
            ))}
            {d.eventos.length > limite && (
              <button
                type="button"
                onClick={d.abrir}
                className="px-1 text-[10px] font-bold text-primary"
              >
                + {d.eventos.length - limite} horários
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
