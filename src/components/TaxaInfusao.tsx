import { useState } from "react";
import { paraNumero } from "@/lib/ficha";

function calcular(fator: number, peso: number): string | null {
  if (!isFinite(peso) || peso <= 0) return null;
  const valor = fator * Math.pow(peso, 0.75);
  return (Math.round(valor * 10) / 10).toString().replace(".", ",");
}

export function TaxaInfusao() {
  const [peso, setPeso] = useState("");
  const p = paraNumero(peso);

  return (
    <div className="rounded-2xl border border-border bg-card p-2.5 shadow-sm sm:p-3">
      <p className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground sm:text-[0.7rem]">
        Taxa de infusão
      </p>
      <label className="mt-1.5 block">
        <span className="text-[0.65rem] text-muted-foreground sm:text-xs">Peso (kg)</span>
        <input
          value={peso}
          onChange={(e) => setPeso(e.target.value)}
          inputMode="decimal"
          placeholder="5,3"
          className="mt-0.5 w-full rounded-lg border border-input bg-background px-2 py-1.5 text-base font-semibold text-foreground outline-none focus:border-ring"
        />
      </label>

      <div className="mt-2 space-y-1.5">
        {[
          { especie: "Cachorro", fator: 130 },
          { especie: "Gato", fator: 80 },
        ].map(({ especie, fator }) => {
          const resultado = calcular(fator, p);
          return (
            <div key={especie} className="rounded-lg bg-secondary px-2 py-1.5">
              <p className="text-xs font-semibold text-foreground sm:text-sm">{especie}</p>
              <p className="text-[0.6rem] leading-tight text-muted-foreground">
                {fator} × peso<sup>0,75</sup>
              </p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums text-primary sm:text-lg">
                {resultado ? `${resultado} mL/h` : "—"}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
