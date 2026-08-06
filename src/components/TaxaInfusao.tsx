import { useState } from "react";
import { paraNumero } from "@/lib/ficha";

function calcular(fator: number, peso: number) {
  if (!isFinite(peso) || peso <= 0) return "—";
  const valor = fator * Math.pow(peso, 0.75);
  return `${(Math.round(valor * 10) / 10).toString().replace(".", ",")} mL/h`;
}

export function TaxaInfusao() {
  const [peso, setPeso] = useState("");
  const p = paraNumero(peso);

  return (
    <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Taxa de infusão
      </p>
      <label className="mt-2 block">
        <span className="text-xs text-muted-foreground">Peso (kg)</span>
        <input
          value={peso}
          onChange={(e) => setPeso(e.target.value)}
          inputMode="decimal"
          placeholder="5,3"
          className="mt-1 w-full rounded-lg border border-input bg-background px-2 py-1.5 text-base font-semibold text-foreground outline-none focus:border-ring"
        />
      </label>

      <div className="mt-3 space-y-2">
        {[
          { especie: "Cachorro", fator: 130 },
          { especie: "Gato", fator: 80 },
        ].map(({ especie, fator }) => (
          <div key={especie} className="rounded-lg bg-secondary px-2.5 py-2">
            <p className="text-sm font-semibold text-foreground">{especie}</p>
            <p className="text-[0.65rem] text-muted-foreground">
              {fator} × peso elevado a 0,75
            </p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-primary">
              {calcular(fator, p)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
