import { useEffect, useState } from "react";
import { calcularNorep, formatarNorep } from "@/lib/norep";

export function CalculadoraNorep() {
  const [peso, setPeso] = useState("");
  const [dose, setDose] = useState("");
  const [taxa, setTaxa] = useState("");
  const [ultimoEditado, setUltimoEditado] = useState<"dose" | "taxa" | null>(null);
  const [resultado, setResultado] = useState(calcularNorep({ peso: "", dose: "", taxa: "" }, null));

  useEffect(() => {
    setResultado(calcularNorep({ peso, dose, taxa }, ultimoEditado));
  }, [peso, dose, taxa, ultimoEditado]);

  const inputClass =
    "w-full rounded-lg border border-input bg-background px-2 py-1.5 text-base font-semibold text-foreground outline-none placeholder:font-normal placeholder:text-muted-foreground/40 focus:border-ring";
  const labelClass = "block text-[0.65rem] text-muted-foreground sm:text-xs";

  const doseValor = resultado.doseCalculada;
  const taxaValor = resultado.taxaCalculada;

  return (
    <div className="flex h-full flex-col rounded-2xl border border-border bg-card p-2.5 shadow-sm sm:p-3">
      <p className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground sm:text-[0.7rem]">
        Norepinefrina (NOREP)
      </p>
      <p className="mt-1 text-[0.6rem] leading-tight text-muted-foreground sm:text-xs">
        Diluição: 4 mL de norepinefrina + 96 mL de SF = 40 mcg/mL
      </p>

      <div className="mt-2 space-y-2">
        <label className="block">
          <span className={labelClass}>Peso (kg) *</span>
          <input
            value={peso}
            onChange={(e) => setPeso(e.target.value)}
            inputMode="decimal"
            placeholder="5,3"
            className={`${inputClass} mt-0.5`}
          />
        </label>

        <label className="block">
          <span className={labelClass}>Dose (mcg/kg/min)</span>
          <input
            value={dose}
            onChange={(e) => {
              setDose(e.target.value);
              setUltimoEditado("dose");
            }}
            inputMode="decimal"
            placeholder="0,2"
            className={`${inputClass} mt-0.5`}
          />
        </label>

        <label className="block">
          <span className={labelClass}>Taxa de infusão (mL/h)</span>
          <input
            value={taxa}
            onChange={(e) => {
              setTaxa(e.target.value);
              setUltimoEditado("taxa");
            }}
            inputMode="decimal"
            placeholder="1,59"
            className={`${inputClass} mt-0.5`}
          />
        </label>
      </div>

      <div className="mt-auto space-y-2 pt-3">
        {resultado.erro ? (
          <p className="rounded-lg bg-destructive/10 px-2 py-1.5 text-xs font-medium text-destructive">
            {resultado.erro}
          </p>
        ) : (
          <div className="rounded-lg bg-secondary px-2 py-1.5">
            {doseValor !== null ? (
              <>
                <p className="text-xs font-semibold text-foreground sm:text-sm">Dose calculada</p>
                <p className="mt-0.5 text-sm font-semibold tabular-nums text-primary sm:text-lg">
                  {formatarNorep(doseValor, "mcg/kg/min")}
                </p>
              </>
            ) : taxaValor !== null ? (
              <>
                <p className="text-xs font-semibold text-foreground sm:text-sm">Taxa de infusão</p>
                <p className="mt-0.5 text-sm font-semibold tabular-nums text-primary sm:text-lg">
                  {formatarNorep(taxaValor, "mL/h")}
                </p>
              </>
            ) : (
              <p className="text-xs font-semibold text-muted-foreground">
                Informe peso + dose ou peso + taxa.
              </p>
            )}
            {resultado.formula && (
              <p className="mt-1 text-[0.6rem] leading-tight text-muted-foreground">
                {resultado.formula}
              </p>
            )}
          </div>
        )}

        <p className="text-[0.6rem] leading-tight text-muted-foreground">
          O resultado é uma estimativa e deve ser ajustado conforme avaliação clínica e
          monitorização do paciente.
        </p>
      </div>
    </div>
  );
}
