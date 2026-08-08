import { usePlantaoAtual } from "@/hooks/usePlantaoAtual";

export function DialogoTurno() {
  const { plantao, definirTurno, carregado } = usePlantaoAtual();

  if (!carregado || plantao) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center shadow-lg">
        <h2 className="font-display text-lg font-semibold text-foreground">
          Qual é o plantão de hoje?
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Escolha o turno para registrar a data das fichas.
        </p>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => definirTurno("diurno")}
            className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            ☀️ Diurno
          </button>
          <button
            type="button"
            onClick={() => definirTurno("noturno")}
            className="rounded-xl bg-secondary px-4 py-3 text-sm font-semibold text-secondary-foreground hover:bg-secondary/70"
          >
            🌙 Noturno
          </button>
        </div>
      </div>
    </div>
  );
}
