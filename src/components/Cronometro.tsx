import { useEffect, useRef, useState } from "react";

function formatar(ms: number) {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mil = Math.floor(ms % 1000);
  const pad = (n: number, l = 2) => String(n).padStart(l, "0");
  const base = h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  return { base, mil: pad(mil, 3) };
}

export function Cronometro() {
  const [ms, setMs] = useState(0);
  const [rodando, setRodando] = useState(false);
  const inicio = useRef(0);

  useEffect(() => {
    if (!rodando) return;
    inicio.current = Date.now() - ms;
    let frame = 0;
    const tick = () => {
      setMs(Date.now() - inicio.current);
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rodando]);

  const { base, mil } = formatar(ms);

  return (
    <div className="flex h-full flex-col rounded-2xl border border-border bg-card p-3 shadow-sm">
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Cronômetro
      </p>
      <p className="mt-1 font-mono font-semibold tabular-nums text-foreground">
        <span className="text-2xl">{base}</span>
        <span className="text-base text-muted-foreground">.{mil}</span>
      </p>
      <div className="mt-auto flex gap-2">
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
