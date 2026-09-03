import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usaFracao, type ResultadoFaixa } from "@/lib/medicamentos";

/** Contexto da medicação escolhida, enquanto a quantidade não foi confirmada. */
export type QuantidadePendente = {
  nome: string;
  /** Complemento opcional exibido antes do nome, ex.: "Besilato de". */
  nomeMenor?: string;
  via: string;
  duracao: string;
  resultado: Extract<ResultadoFaixa, { ok: true }>;
};

type Props = {
  pendente: QuantidadePendente | null;
  onFechar: () => void;
  /** quantidade já formatada, ex.: "0,15 mL" ou "½ comprimido" */
  onConfirmar: (quantidade: string) => void;
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

/** Escolha da quantidade que realmente será administrada. O cálculo é só referência. */
export function DialogoQuantidade({ pendente, onFechar, onConfirmar }: Props) {
  const solido = pendente ? usaFracao(pendente.resultado.forma ?? "") : false;
  const sugerido = pendente?.resultado.volMax ?? pendente?.resultado.volMin ?? null;
  const [casas, setCasas] = useState<2 | 3>(2);
  const [liquido, setLiquido] = useState("");
  const [fracao, setFracao] = useState<number | null>(null);

  useEffect(() => {
    if (!pendente) return;
    if (solido) {
      const alvo = sugerido ?? 1;
      const perto = FRACOES.reduce((a, b) =>
        Math.abs(b.valor - alvo) < Math.abs(a.valor - alvo) ? b : a,
      );
      setFracao(perto.valor);
      setLiquido("");
      return;
    }
    // volumes muito pequenos exigem 3 casas para não perder precisão
    const precisao: 2 | 3 = sugerido !== null && sugerido > 0 && sugerido < 0.1 ? 3 : lerPrecisao();
    setCasas(precisao);
    setLiquido(sugerido ? paraDigitos(sugerido, precisao) : "");
    setFracao(null);
  }, [pendente, solido, sugerido]);

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
    if (!pendente || solido) return [] as { rotulo: string; valor: number }[];
    const { volMin, volMax } = pendente.resultado;
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
  }, [pendente, solido]);

  if (!pendente) return null;
  const { resultado } = pendente;
  const unidadeBase = resultado.forma ?? "";
  const textoFracao = FRACOES.find((f) => f.valor === fracao)?.texto ?? "";

  const quantidadeFinal = solido
    ? textoFracao
      ? `${textoFracao} ${unidadeBase}`
      : ""
    : liquido && Number(liquido) > 0
      ? `${formatar(liquido, casas)} ${unidadeBase || "mL"}`
      : "";

  const confirmar = () => {
    if (!quantidadeFinal) return;
    onConfirmar(quantidadeFinal);
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{pendente.nome}</DialogTitle>
          <DialogDescription>
            Cálculo apenas para referência. Você escolhe a quantidade que vai administrar.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl bg-secondary/60 px-3 py-2 text-sm text-muted-foreground">
          <p>{resultado.referencia}</p>
          <p>{resultado.doseTexto}</p>
          {resultado.volumeTexto && (
            <p>
              {resultado.volumeTexto} {resultado.unidade}
            </p>
          )}
        </div>

        <div className="rounded-2xl border-2 border-primary bg-primary/10 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Quantidade a ministrar
            </p>
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
                  autoFocus
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

        <button
          type="button"
          onClick={confirmar}
          disabled={!quantidadeFinal}
          className="w-full rounded-xl bg-primary px-3 py-3 text-base font-bold uppercase tracking-wide text-primary-foreground disabled:bg-secondary disabled:text-muted-foreground"
        >
          Confirmar aplicação
        </button>
      </DialogContent>
    </Dialog>
  );
}
