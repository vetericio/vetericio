import { useEffect } from "react";
import { adiarAlarmeAtivo, pararAlarmeAtivo, useAlarmes } from "@/hooks/useAlarmes";
import { pararToque, pararVibracao, tocarToque, vibrar } from "@/lib/toques";

export function AlarmeAtivo() {
  const { alarmeTocando } = useAlarmes();

  useEffect(() => {
    if (!alarmeTocando) {
      pararToque();
      pararVibracao();
      return;
    }
    tocarToque(alarmeTocando.toque, true);
    vibrar();
    const revibrar = window.setInterval(vibrar, 18000);
    return () => {
      window.clearInterval(revibrar);
      pararToque();
      pararVibracao();
    };
  }, [alarmeTocando]);

  if (!alarmeTocando) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background/95 px-6 text-center backdrop-blur">
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
        Alarme
      </p>
      <h2 className="font-display text-3xl font-semibold text-foreground">
        {alarmeTocando.rotulo}
      </h2>
      <p className="text-sm text-muted-foreground">
        {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
      </p>
      <div className="flex w-full max-w-xs flex-col gap-3">
        <button
          type="button"
          onClick={() => pararAlarmeAtivo()}
          className="rounded-xl bg-primary px-4 py-3 text-base font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Parar
        </button>
        <button
          type="button"
          onClick={() => adiarAlarmeAtivo(5)}
          className="rounded-xl bg-secondary px-4 py-3 text-base font-semibold text-secondary-foreground hover:bg-secondary/70"
        >
          Soneca 5 min
        </button>
      </div>
    </div>
  );
}
