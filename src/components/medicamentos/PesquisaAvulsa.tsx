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
  UNIDADES_CONCENTRACAO,
  UNIDADES_DOSE,
  calcularDose,
  type Especie,
} from "@/lib/medicamentos";

type Props = { aberto: boolean; onFechar: () => void };

const campo =
  "w-full rounded-xl border border-input bg-background px-3 py-3 text-base text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-ring";
const rotulo = "block text-xs font-semibold text-muted-foreground";

/** Calculadora independente: não salva nada. */
export function PesquisaAvulsa({ aberto, onFechar }: Props) {
  const [peso, setPeso] = useState("");
  const [especie, setEspecie] = useState<Especie>("cao");
  const [dose, setDose] = useState("");
  const [unidadeDose, setUnidadeDose] = useState<string>("mg/kg");
  const [concentracao, setConcentracao] = useState("");
  const [unidadeConcentracao, setUnidadeConcentracao] = useState<string>("mg/mL");

  const resultado = calcularDose({
    peso,
    dose,
    concentracaoValor: concentracao,
    concentracaoUnidade: unidadeConcentracao,
  });

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pesquisa avulsa</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className={rotulo} htmlFor="avulsa-peso">
              Peso do animal (kg)
            </label>
            <input
              id="avulsa-peso"
              value={peso}
              onChange={(e) => setPeso(e.target.value)}
              inputMode="decimal"
              autoFocus
              placeholder="0"
              className={`${campo} text-lg font-semibold`}
            />
          </div>

          <SeletorEspecie valor={especie} onChange={setEspecie} />

          <div>
            <span className={rotulo}>Dose</span>
            <div className="flex gap-2">
              <input
                value={dose}
                onChange={(e) => setDose(e.target.value)}
                inputMode="decimal"
                placeholder="5"
                className={`${campo} min-w-0 flex-1`}
              />
              <input
                list="avulsa-unidades-dose"
                value={unidadeDose}
                onChange={(e) => setUnidadeDose(e.target.value)}
                className={`${campo} w-28 shrink-0`}
                placeholder="mg/kg"
              />
              <datalist id="avulsa-unidades-dose">
                {UNIDADES_DOSE.map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
            </div>
          </div>

          <div>
            <span className={rotulo}>Concentração</span>
            <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-2">
              <input
                value={concentracao}
                onChange={(e) => setConcentracao(e.target.value)}
                inputMode="decimal"
                placeholder="50"
                className={`${campo} min-w-0`}
              />
              <input
                list="avulsa-unidades-conc"
                value={unidadeConcentracao}
                onChange={(e) => setUnidadeConcentracao(e.target.value)}
                className={`${campo} min-w-0`}
                placeholder="mg/mL"
              />
              <datalist id="avulsa-unidades-conc">
                {UNIDADES_CONCENTRACAO.map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
            </div>
          </div>

          <ResultadoAplicar resultado={resultado} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
