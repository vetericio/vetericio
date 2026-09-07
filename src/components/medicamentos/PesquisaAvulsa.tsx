import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ResultadoAplicar } from "@/components/medicamentos/ResultadoAplicar";
import { SeletorEspecie } from "@/components/medicamentos/SeletorEspecie";
import {
  UNIDADES_CONCENTRACAO,
  UNIDADES_DOSE,
  calcularDose,
  doseDaEspecie,
  faixaDe,
  viasDe,
  type Especie,
  type Medicamento,
} from "@/lib/medicamentos";
import { normalizarNomeMedicamento } from "@/lib/nomes";

type Props = {
  aberto: boolean;
  onFechar: () => void;
  /** Quando vem de um cartão, os campos já entram preenchidos. */
  medicamento?: Medicamento | null;
  especieInicial?: Especie;
  /** Peso do topo da tela, já formatado. */
  pesoInicial?: string;
};

const campo =
  "w-full rounded-xl border border-input bg-background px-3 py-3 text-base text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-ring";
const rotulo = "block text-xs font-semibold text-muted-foreground";

/** Calculadora independente: não salva nada. */
export function PesquisaAvulsa({
  aberto,
  onFechar,
  medicamento,
  especieInicial,
  pesoInicial,
}: Props) {
  const [peso, setPeso] = useState("");
  const [especie, setEspecie] = useState<Especie>(especieInicial ?? "cao");
  const [dose, setDose] = useState("");
  const [unidadeDose, setUnidadeDose] = useState<string>("mg/kg");
  const [concentracao, setConcentracao] = useState("");
  const [unidadeConcentracao, setUnidadeConcentracao] = useState<string>("mg/mL");
  const [via, setVia] = useState("");

  const vias = useMemo(() => (medicamento ? viasDe(medicamento) : []), [medicamento]);

  // Pré-preenche a partir do medicamento tocado no cartão.
  useEffect(() => {
    if (!aberto) return;
    if (especieInicial) setEspecie(especieInicial);
    if (pesoInicial) setPeso(pesoInicial);
    if (!medicamento) return;
    const alvo = especieInicial ?? "cao";
    const f = faixaDe(doseDaEspecie(medicamento, alvo));
    setDose(f.min);
    setUnidadeDose(f.unidade);
    setConcentracao(medicamento.concentracaoValor);
    setUnidadeConcentracao(medicamento.concentracaoUnidade || "mg/mL");
    setVia(viasDe(medicamento)[0] ?? "");
  }, [aberto, medicamento, especieInicial, pesoInicial]);


  // Trocar a espécie no diálogo atualiza a dose cadastrada correspondente.
  const trocarEspecie = (e: Especie) => {
    setEspecie(e);
    if (!medicamento) return;
    const f = faixaDe(doseDaEspecie(medicamento, e));
    setDose(f.min);
    setUnidadeDose(f.unidade);
  };

  const faixa = medicamento ? faixaDe(doseDaEspecie(medicamento, especie)) : null;

  const calcular = (valor: string) =>
    calcularDose({
      peso,
      dose: valor,
      unidadeDose,
      concentracaoValor: concentracao,
      concentracaoUnidade: unidadeConcentracao,
    });

  const resultado = calcular(dose);
  const resMin = faixa?.min ? calcular(faixa.min) : null;
  const resMax = faixa?.max && faixa.max !== faixa.min ? calcular(faixa.max) : null;

  const nome = medicamento
    ? [medicamento.nomeMenor, medicamento.nome]
        .map((n) => normalizarNomeMedicamento(n ?? ""))
        .filter(Boolean)
        .join(" ")
    : "";

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{medicamento ? "Consulta avulsa" : "Pesquisa avulsa"}</DialogTitle>
          <DialogDescription>
            {nome ? `${nome} — nada é registrado aqui.` : "Cálculo pontual, nada é registrado."}
          </DialogDescription>
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

          <SeletorEspecie valor={especie} onChange={trocarEspecie} />

          {vias.length > 1 && (
            <div>
              <label className={rotulo} htmlFor="avulsa-via">
                Via
              </label>
              <select
                id="avulsa-via"
                value={via}
                onChange={(e) => setVia(e.target.value)}
                className={campo}
              >
                {vias.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <span className={rotulo}>Dose</span>
            <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-2">
              <input
                value={dose}
                onChange={(e) => setDose(e.target.value)}
                inputMode="decimal"
                placeholder="5"
                className={`${campo} min-w-0`}
              />
              <input
                list="avulsa-unidades-dose"
                value={unidadeDose}
                onChange={(e) => setUnidadeDose(e.target.value)}
                className={`${campo} min-w-0`}

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

          {faixa && (resMin || resMax) && (
            <div className="grid grid-cols-2 gap-2 text-center text-xs">
              <div className="rounded-xl bg-secondary/60 px-2 py-2">
                <p className="font-semibold uppercase text-muted-foreground">Mínima</p>
                <p className="text-base font-bold text-foreground">
                  {resMin?.ok ? `${resMin.volumeTexto} ${resMin.unidade}` : "—"}
                </p>
                <p className="text-muted-foreground">
                  {faixa.min} {faixa.unidade}
                </p>
              </div>
              <div className="rounded-xl bg-secondary/60 px-2 py-2">
                <p className="font-semibold uppercase text-muted-foreground">Máxima</p>
                <p className="text-base font-bold text-foreground">
                  {resMax?.ok
                    ? `${resMax.volumeTexto} ${resMax.unidade}`
                    : resMin?.ok
                      ? `${resMin.volumeTexto} ${resMin.unidade}`
                      : "—"}
                </p>
                <p className="text-muted-foreground">
                  {faixa.max || faixa.min} {faixa.unidade}
                </p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
