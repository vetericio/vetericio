import { useState } from "react";
import { usePlantaoAtual } from "@/hooks/usePlantaoAtual";
import { diaDeHoje } from "@/lib/plantao";

type Props = {
  aberto: boolean;
  onFechar: () => void;
};

export function DialogoTurno({ aberto, onFechar }: Props) {
  const { definirTurno } = usePlantaoAtual();
  const [mostrarData, setMostrarData] = useState(false);
  const [dia, setDia] = useState(diaDeHoje());

  if (!aberto) return null;

  const diaEscolhido = mostrarData ? dia : undefined;

  const iniciar = (turno: "diurno" | "noturno") => {
    definirTurno(turno, diaEscolhido);
    setMostrarData(false);
    setDia(diaDeHoje());
    onFechar();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center shadow-lg">
        <h2 className="font-display text-lg font-semibold text-foreground">
          Tem certeza que deseja iniciar o plantão?
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Escolha o turno para registrar a data das fichas.
        </p>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => iniciar("diurno")}
            className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            ☀️ Diurno
          </button>
          <button
            type="button"
            onClick={() => iniciar("noturno")}
            className="rounded-xl bg-secondary px-4 py-3 text-sm font-semibold text-secondary-foreground hover:bg-secondary/70"
          >
            🌙 Noturno
          </button>
        </div>

        {mostrarData ? (
          <div className="mt-4 text-left">
            <label
              htmlFor="data-plantao"
              className="text-xs font-semibold text-muted-foreground"
            >
              Data do plantão
            </label>
            <input
              id="data-plantao"
              type="date"
              value={dia}
              onChange={(e) => setDia(e.target.value || diaDeHoje())}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
            <button
              type="button"
              onClick={() => {
                setMostrarData(false);
                setDia(diaDeHoje());
              }}
              className="mt-2 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Usar a data de hoje
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setMostrarData(true)}
            className="mt-4 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Escolher outra data
          </button>
        )}

        <button
          type="button"
          onClick={onFechar}
          className="mt-4 block w-full text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
