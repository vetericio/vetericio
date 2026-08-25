import { useState } from "react";
import {
  FATORES_SANGUE_TOTAL,
  ROTULOS_ESPECIE,
  validarTransfusao,
  type EspecieTransfusao,
} from "@/lib/transfusao";

export function TransfusaoSanguinea() {
  const [especie, setEspecie] = useState<EspecieTransfusao>("Cachorro");
  const [peso, setPeso] = useState("");
  const [vgAtual, setVgAtual] = useState("");
  const [vgUnidade, setVgUnidade] = useState("");
  const [vgAlvo, setVgAlvo] = useState("25");

  const resultado = validarTransfusao({
    especie,
    peso,
    vgAtual,
    vgUnidade,
    vgAlvo,
  });

  const inputClass =
    "w-full rounded-lg border border-input bg-background px-2 py-1.5 text-base font-semibold text-foreground outline-none focus:border-ring";
  const labelClass = "block text-[0.65rem] text-muted-foreground sm:text-xs";

  return (
    <div className="flex h-full flex-col rounded-2xl border border-border bg-card p-2.5 shadow-sm sm:p-3">
      <p className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground sm:text-[0.7rem]">
        Transfusão sanguínea
      </p>

      <div className="mt-2 grid grid-cols-2 gap-1.5 rounded-lg bg-secondary p-1">
        {(["Cachorro", "Gato"] as EspecieTransfusao[]).map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => setEspecie(e)}
            className={`rounded-md px-2 py-1 text-xs font-semibold transition-colors sm:text-sm ${
              especie === e
                ? "bg-primary text-primary-foreground"
                : "text-secondary-foreground hover:bg-secondary/70"
            }`}
          >
            {ROTULOS_ESPECIE[e]}
          </button>
        ))}
      </div>

      <div className="mt-2 space-y-2">
        <label className="block">
          <span className={labelClass}>Peso do paciente (kg)</span>
          <input
            value={peso}
            onChange={(e) => setPeso(e.target.value)}
            inputMode="decimal"
            placeholder="20"
            className={`${inputClass} mt-0.5`}
          />
        </label>

        <label className="block">
          <span className={labelClass}>Ht atual do paciente (%)</span>
          <input
            value={vgAtual}
            onChange={(e) => setVgAtual(e.target.value)}
            inputMode="decimal"
            placeholder="14"
            className={`${inputClass} mt-0.5`}
          />
        </label>

        <label className="block">
          <span className={labelClass}>Ht da bolsa (%)</span>
          <input
            value={vgUnidade}
            onChange={(e) => setVgUnidade(e.target.value)}
            inputMode="decimal"
            placeholder="48"
            className={`${inputClass} mt-0.5`}
          />
        </label>

        <label className="block">
          <span className={labelClass}>Ht alvo (%)</span>
          <input
            value={vgAlvo}
            onChange={(e) => setVgAlvo(e.target.value)}
            inputMode="decimal"
            placeholder="25"
            className={`${inputClass} mt-0.5`}
          />
        </label>
      </div>

      <div className="mt-auto pt-3">
        {resultado.erro ? (
          <p className="rounded-lg bg-destructive/10 px-2 py-1.5 text-xs font-medium text-destructive">
            {resultado.erro}
          </p>
        ) : resultado.volume !== null ? (
          <div className="rounded-lg bg-secondary px-2 py-1.5">
            <p className="text-xs font-semibold text-foreground sm:text-sm">
              {ROTULOS_ESPECIE[especie]} — {resultado.fator} mL/kg
            </p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums text-primary sm:text-lg">
              {resultado.volume} mL
            </p>
            <p className="mt-0.5 text-[0.6rem] leading-tight text-muted-foreground">
              {resultado.formula}
            </p>
          </div>
        ) : (
          <p className="text-[0.65rem] text-muted-foreground sm:text-xs">
            Preencha os campos para calcular o volume de sangue total.
          </p>
        )}

        <p className="mt-2 text-[0.6rem] leading-tight text-muted-foreground">
          O resultado é uma estimativa e deve ser ajustado conforme avaliação clínica e
          monitorização do paciente.
        </p>
      </div>
    </div>
  );
}
