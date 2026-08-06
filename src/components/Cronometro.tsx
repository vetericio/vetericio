import { useEffect, useRef, useState } from "react";

function formatar(ms: number) {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function Cronometro() {
  const [ms, setMs] = useState(0);
  const [rodando, setRodando] = useState(false);
  const inicio = useRef(0);

  useEffect(() => {
    if (!rodando) return;
    inicio.current = Date.now() - ms;
    const id = window.setInterval(() => setMs(Date.now() - inicio.current), 200);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rodando]);

  return (
    <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Cronômetro
      </p>
      <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-foreground">
        {formatar(ms)}
      </p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => setRodando((r) => !r)}
          className="flex-1 rounded-lg bg-primary px-2 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {rodando ? "Pausar" : "Iniciar"}
        </button>
        <button
          type="button"
          onClick={() => {
            setRodando(false);
            setMs(0);
          }}
          className="flex-1 rounded-lg bg-secondary px-2 py-1.5 text-xs font-semibold text-secondary-foreground transition-colors hover:bg-secondary/70"
        >
          Zerar
        </button>
      </div>
    </div>
  );
}
