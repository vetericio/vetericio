import { useEffect } from "react";
import { adiarAlarmeAtivo, pararAlarmeAtivo, useAlarmes } from "@/hooks/useAlarmes";
import { NOME_PLATAFORMA, idYoutube } from "@/lib/alarmes";
import { pararToque, pararVibracao, tocarToque, vibrar } from "@/lib/toques";

export function AlarmeAtivo() {
  const { alarmeTocando } = useAlarmes();
  const videoYoutube =
    alarmeTocando?.plataforma === "youtube" && alarmeTocando.linkExterno
      ? idYoutube(alarmeTocando.linkExterno)
      : undefined;

  useEffect(() => {
    if (!alarmeTocando) {
      pararToque();
      pararVibracao();
      return;
    }
    if (!videoYoutube) tocarToque(alarmeTocando.toque, true);
    vibrar();
    const revibrar = window.setInterval(vibrar, 18000);
    return () => {
      window.clearInterval(revibrar);
      pararToque();
      pararVibracao();
    };
  }, [alarmeTocando, videoYoutube]);

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

      {videoYoutube && (
        <iframe
          title="Música do alarme"
          src={`https://www.youtube.com/embed/${videoYoutube}?autoplay=1&loop=1&playlist=${videoYoutube}`}
          allow="autoplay; encrypted-media"
          className="h-28 w-full max-w-xs rounded-xl border border-border"
        />
      )}

      <div className="flex w-full max-w-xs flex-col gap-3">
        {alarmeTocando.linkExterno && !videoYoutube && (
          <a
            href={alarmeTocando.linkExterno}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl bg-accent px-4 py-3 text-base font-semibold text-accent-foreground hover:bg-accent/80"
          >
            Abrir minha música
            {alarmeTocando.plataforma ? ` no ${NOME_PLATAFORMA[alarmeTocando.plataforma]}` : ""}
          </a>
        )}
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
