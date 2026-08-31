import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ResultadoAplicar } from "@/components/medicamentos/ResultadoAplicar";
import { SeletorEspecie } from "@/components/medicamentos/SeletorEspecie";
import {
  calcularDose,
  doseDaEspecie,
  viasDe,
  type Especie,
  type Medicamento,
} from "@/lib/medicamentos";

type Props = {
  medicamento: Medicamento | null;
  onFechar: () => void;
};

const campo =
  "w-full rounded-xl border border-input bg-background px-3 py-3 text-lg font-semibold text-foreground outline-none placeholder:font-normal placeholder:text-muted-foreground/50 focus:border-ring";

export function CalculadoraDose({ medicamento, onFechar }: Props) {
  const [peso, setPeso] = useState("");
  const [especie, setEspecie] = useState<Especie>("cao");

  if (!medicamento) return null;
  const dose = doseDaEspecie(medicamento, especie);
  const resultado = calcularDose({
    peso,
    dose: dose.dose,
    concentracaoValor: medicamento.concentracaoValor,
    concentracaoUnidade: medicamento.concentracaoUnidade,
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="uppercase">{medicamento.nome}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground" htmlFor="calc-peso">
              Peso do animal (kg)
            </label>
            <input
              id="calc-peso"
              value={peso}
              onChange={(e) => setPeso(e.target.value)}
              inputMode="decimal"
              autoFocus
              placeholder="0"
              className={campo}
            />
          </div>

          <SeletorEspecie valor={especie} onChange={setEspecie} />

          <div className="rounded-xl bg-secondary/60 px-3 py-2 text-sm text-foreground">
            <p>Dose cadastrada: {dose.dose ? `${dose.dose} mg/kg` : "—"}</p>
            <p>Intervalo: {dose.intervalo ? `a cada ${dose.intervalo} horas` : "—"}</p>
            <p>Via: {viasDe(medicamento).join(" · ") || "—"}</p>
            <p>
              Concentração:{" "}
              {medicamento.concentracaoValor
                ? `${medicamento.concentracaoValor} ${medicamento.concentracaoUnidade}`
                : "—"}
            </p>
          </div>

          <ResultadoAplicar resultado={resultado} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
