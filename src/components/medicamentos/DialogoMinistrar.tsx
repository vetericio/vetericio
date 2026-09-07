import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  calcularFaixaDose,
  doseDaEspecie,
  doseEfetiva,
  faixaDe,
  numero,
  usaFracao,
  viasDe,
  NOME_ESPECIE,
  type Especie,
  type Medicamento,
} from "@/lib/medicamentos";
import { normalizarNomeMedicamento } from "@/lib/nomes";
import type { AplicacaoPendente } from "@/components/medicamentos/DialogoAplicar";

type Props = {
  medicamento: Medicamento | null;
  especie: Especie;
  /** peso do topo da tela, já formatado ("3,500") */
  pesoInicial: string;
  onFechar: () => void;
  onConfirmar: (a: AplicacaoPendente) => void;
};

const FRACOES = [
  { texto: "¼", valor: 0.25 },
  { texto: "⅓", valor: 1 / 3 },
  { texto: "½", valor: 0.5 },
  { texto: "1", valor: 1 },
  { texto: "1½", valor: 1.5 },
  { texto: "2", valor: 2 },
];

const CHAVE_PRECISAO = "veterico:precisao-ml";

function lerPrecisao(): 2 | 3 {
  if (typeof window === "undefined") return 2;
  return window.localStorage.getItem(CHAVE_PRECISAO) === "3" ? 3 : 2;
}

function digitos(texto: string): string {
  return texto.replace(/\D/g, "").slice(0, 6);
}

function formatar(d: string, casas: 2 | 3): string {
  if (!d) return "";
  return (Number(d) / 10 ** casas).toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
}

function paraDigitos(valor: number, casas: 2 | 3): string {
  return String(Math.round(valor * 10 ** casas));
}

const campo =
  "w-full rounded-xl border border-input bg-background px-3 py-2.5 text-base text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-ring";
const rotulo = "block text-xs font-bold uppercase tracking-wide text-muted-foreground";

/** "Medições do animal": confere tudo e só grava ao confirmar a ministração. */
export function DialogoMinistrar({
  medicamento,
  especie,
  pesoInicial,
  onFechar,
  onConfirmar,
}: Props) {
  const [peso, setPeso] = useState(pesoInicial);
  const [via, setVia] = useState("");
  const [observacao, setObservacao] = useState("");
  const [casas, setCasas] = useState<2 | 3>(2);
  const [liquido, setLiquido] = useState("");
  const [fracao, setFracao] = useState<number | null>(null);

  const dose = medicamento ? doseDaEspecie(medicamento, especie) : null;
  const faixa = dose ? faixaDe(dose) : null;
  const vias = useMemo(() => (medicamento ? viasDe(medicamento) : []), [medicamento]);

  const resultado = useMemo(() => {
    if (!medicamento || !dose) return null;
    return calcularFaixaDose({
      peso,
      dose,
      concentracaoValor: medicamento.concentracaoValor,
      concentracaoUnidade: medicamento.concentracaoUnidade,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [medicamento, especie, peso]);

  const solido = resultado?.ok ? usaFracao(resultado.forma ?? "") : false;
  // pré-preenche a dose padrão (cadastrada; sem ela, média da faixa)
  const dPadrao = dose ? doseEfetiva(dose) : null;
  const dMin = faixa ? numero(faixa.min) : null;
  const sugerido = useMemo(() => {
    if (!resultado?.ok) return null;
    const { volMin, volMax } = resultado;
    // O volume é linear na dose: projeta a partir da mínima calculada.
    if (volMin !== null && dMin !== null && dMin > 0 && dPadrao !== null)
      return volMin * (dPadrao / dMin);
    if (volMin !== null && volMax !== null) return (volMin + volMax) / 2;
    return volMax ?? volMin ?? null;
  }, [resultado, dMin, dPadrao]);


  useEffect(() => {
    if (!medicamento) return;
    setPeso(pesoInicial);
    setObservacao("");
    setVia(viasDe(medicamento)[0] ?? "");
  }, [medicamento, pesoInicial]);

  // Pré-preenche a quantidade sugerida (o usuário pode mudar).
  useEffect(() => {
    if (!medicamento) return;
    if (solido) {
      const alvo = sugerido ?? 1;
      const perto = FRACOES.reduce((a, b) =>
        Math.abs(b.valor - alvo) < Math.abs(a.valor - alvo) ? b : a,
      );
      setFracao(perto.valor);
      setLiquido("");
      return;
    }
    const precisao: 2 | 3 = sugerido !== null && sugerido > 0 && sugerido < 0.1 ? 3 : lerPrecisao();
    setCasas(precisao);
    setLiquido(sugerido ? paraDigitos(sugerido, precisao) : "");
    setFracao(null);
  }, [medicamento, solido, sugerido]);

  const trocarCasas = (novo: 2 | 3) => {
    if (novo === casas) return;
    const valor = liquido ? Number(liquido) / 10 ** casas : 0;
    setCasas(novo);
    setLiquido(valor > 0 ? paraDigitos(valor, novo) : "");
    if (typeof window !== "undefined") {
      window.localStorage.setItem(CHAVE_PRECISAO, String(novo));
    }
  };

  const atalhos = useMemo(() => {
    if (!resultado?.ok || solido) return [] as { rotulo: string; valor: number }[];
    const { volMin, volMax } = resultado;
    const min = typeof volMin === "number" && volMin > 0 ? volMin : null;
    const max = typeof volMax === "number" && volMax > 0 ? volMax : null;
    if (min === null && max === null) return [];
    if (min === null || max === null || Math.abs((max ?? 0) - (min ?? 0)) < 0.0005) {
      return [{ rotulo: "Dose calculada", valor: (max ?? min) as number }];
    }
    return [
      { rotulo: "Mínimo", valor: min },
      { rotulo: "Médio", valor: (min + max) / 2 },
      { rotulo: "Máximo", valor: max },
    ];
  }, [resultado, solido]);

  if (!medicamento || !dose || !faixa) return null;

  const nome = [medicamento.nomeMenor, medicamento.nome]
    .map((n) => normalizarNomeMedicamento(n ?? ""))
    .filter(Boolean)
    .join(" ");
  const concentracao = medicamento.concentracaoValor
    ? `${medicamento.concentracaoValor} ${medicamento.concentracaoUnidade}`
    : "—";
  const frequencia = dose.intervalo ? `${dose.intervalo}h` : "";
  const unidadeBase = resultado?.ok ? (resultado.forma ?? "") : "";
  const textoFracao = FRACOES.find((f) => f.valor === fracao)?.texto ?? "";

  const quantidadeFinal = solido
    ? textoFracao
      ? `${textoFracao} ${unidadeBase}`
      : ""
    : liquido && Number(liquido) > 0
      ? `${formatar(liquido, casas)} ${unidadeBase || "mL"}`
      : "";

  const confirmar = () => {
    if (!resultado?.ok || !quantidadeFinal) return;
    onConfirmar({
      nome: medicamento.nome,
      ...(medicamento.nomeMenor ? { nomeMenor: medicamento.nomeMenor } : {}),
      dose: `${resultado.doseTexto}${resultado.referencia ? ` (${resultado.referencia})` : ""}`,
      quantidade: quantidadeFinal,
      via,
      duracao: frequencia ? `a cada ${frequencia}` : "",
      ...(peso.trim() ? { peso: `${peso.trim()} kg` } : {}),
      ...(observacao.trim() ? { observacao: observacao.trim() } : {}),
    });
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-h-[92vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Medições do animal</DialogTitle>
          <DialogDescription>
            {nome} — confira os dados e confirme a ministração.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1 rounded-xl bg-secondary/60 px-3 py-2 text-sm text-muted-foreground">
          <p>
            <span className="font-semibold text-foreground">{nome}</span> • {concentracao}
          </p>
          <p>
            Dose cadastrada ({NOME_ESPECIE[especie]}): {faixa.min || "—"}
            {faixa.max && faixa.max !== faixa.min ? ` – ${faixa.max}` : ""} {faixa.unidade}
          </p>
          <p>
            Mínima: {faixa.min || "—"} {faixa.unidade} • Máxima: {faixa.max || faixa.min || "—"}{" "}
            {faixa.unidade}
          </p>
          <p>Intervalo: {frequencia || "—"}</p>
          {resultado?.ok ? (
            <>
              <p>Dose calculada: {resultado.doseTexto}</p>
              <p>
                Volume calculado:{" "}
                {resultado.volumeTexto
                  ? `${resultado.volumeTexto} ${resultado.unidade ?? ""}`
                  : (resultado.motivoVolume ?? "—")}
              </p>
            </>
          ) : (
            <p className="font-semibold text-destructive">{resultado?.motivo}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={rotulo} htmlFor="ministrar-peso">
              Peso (kg)
            </label>
            <input
              id="ministrar-peso"
              value={peso}
              onChange={(e) => setPeso(e.target.value)}
              inputMode="decimal"
              placeholder="0,000"
              className={`${campo} mt-1 font-bold`}
            />
          </div>
          <div>
            <label className={rotulo} htmlFor="ministrar-via">
              Via
            </label>
            {vias.length > 1 ? (
              <select
                id="ministrar-via"
                value={via}
                onChange={(e) => setVia(e.target.value)}
                className={`${campo} mt-1`}
              >
                {vias.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            ) : (
              <p className={`${campo} mt-1`}>{vias[0] ?? "—"}</p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border-2 border-primary bg-primary/10 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className={rotulo}>Quantidade a ministrar</p>
            {!solido && (
              <div className="flex overflow-hidden rounded-lg border border-border">
                {([2, 3] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => trocarCasas(c)}
                    aria-label={`Usar ${c} casas decimais`}
                    className={`px-2 py-1 text-[11px] font-bold ${
                      casas === c
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-muted-foreground"
                    }`}
                  >
                    {c === 2 ? "0,00" : "0,000"}
                  </button>
                ))}
              </div>
            )}
          </div>

          {solido ? (
            <div className="mt-2 grid grid-cols-3 gap-2">
              {FRACOES.map((f) => (
                <button
                  key={f.texto}
                  type="button"
                  onClick={() => setFracao(f.valor)}
                  className={`rounded-xl border px-2 py-3 text-lg font-bold ${
                    fracao === f.valor
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-foreground"
                  }`}
                >
                  {f.texto}
                </button>
              ))}
              <p className="col-span-3 text-center text-xs text-muted-foreground">
                {textoFracao ? `${textoFracao} ${unidadeBase}` : "Escolha a fração"}
              </p>
            </div>
          ) : (
            <>
              <div className="relative mt-2">
                <input
                  value={formatar(liquido, casas)}
                  onChange={(e) => setLiquido(digitos(e.target.value))}
                  inputMode="numeric"
                  placeholder={casas === 2 ? "0,00" : "0,000"}
                  aria-label="Quantidade a ministrar"
                  className="w-full rounded-xl border border-input bg-background px-3 py-3 pr-14 text-center text-3xl font-bold text-foreground outline-none focus:border-ring"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                  {unidadeBase || "mL"}
                </span>
              </div>
              {atalhos.length > 0 && (
                <div className="mt-2">
                  <p className="text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Atalhos rápidos (referência calculada)
                  </p>
                  <div className="mt-1 flex flex-wrap justify-center gap-2">
                    {atalhos.map((a) => (
                      <button
                        key={a.rotulo}
                        type="button"
                        onClick={() => setLiquido(paraDigitos(a.valor, casas))}
                        className="rounded-lg bg-secondary px-2.5 py-1 text-center text-secondary-foreground hover:bg-secondary/70"
                      >
                        <span className="block text-[10px] font-semibold uppercase opacity-75">
                          {a.rotulo}
                        </span>
                        <span className="block text-xs font-bold">
                          {formatar(paraDigitos(a.valor, casas), casas)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div>
          <label className={rotulo} htmlFor="ministrar-obs">
            Observação (opcional)
          </label>
          <textarea
            id="ministrar-obs"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            rows={2}
            placeholder="Ex.: aceitou bem, sem reação"
            className={`${campo} mt-1 resize-none`}
          />
        </div>

        <button
          type="button"
          onClick={confirmar}
          disabled={!quantidadeFinal}
          className="w-full rounded-xl bg-primary px-3 py-3 text-base font-bold uppercase tracking-wide text-primary-foreground disabled:bg-secondary disabled:text-muted-foreground"
        >
          Confirmar ministração
        </button>
      </DialogContent>
    </Dialog>
  );
}
