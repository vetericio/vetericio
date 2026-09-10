import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

  const diaEscolhido = mostrarData ? dia : undefined;

  const iniciar = (turno: "diurno" | "noturno") => {
    definirTurno(turno, diaEscolhido);
    setMostrarData(false);
    setDia(diaDeHoje());
    onFechar();
  };

  return (
    <Dialog open={aberto} onOpenChange={(a) => !a && onFechar()}>
      <DialogContent className="max-w-sm text-center">
        <DialogHeader>
          <DialogTitle>Qual é o turno?</DialogTitle>
          <DialogDescription>
            O turno serve só para registrar a data das fichas. Nada é apagado.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => iniciar("diurno")}
            className="min-h-11 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            ☀️ Diurno
          </button>
          <button
            type="button"
            onClick={() => iniciar("noturno")}
            className="min-h-11 rounded-xl bg-secondary px-4 py-3 text-sm font-semibold text-secondary-foreground hover:bg-secondary/70"
          >
            🌙 Noturno
          </button>
        </div>

        {mostrarData ? (
          <div className="mt-4 text-left">
            <label htmlFor="data-plantao" className="text-xs font-semibold text-muted-foreground">
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
              className="mt-2 min-h-11 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Usar a data de hoje
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setMostrarData(true)}
            className="mt-4 min-h-11 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Escolher outra data
          </button>
        )}
      </DialogContent>
    </Dialog>
  );
}
