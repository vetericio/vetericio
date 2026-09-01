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

function digitos(texto: string): string {
  return texto.replace(/\D/g, "").slice(0, 6);
}

function formatar3(d: string): string {
  if (!d) return "";
  return (Number(d) / 1000).toLocaleString("pt-BR", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

function paraDigitos(valor: number): string {
  return String(Math.round(valor * 1000));
}

/** Escolha da quantidade que realmente será administrada. O cálculo é só referência. */
export function DialogoQuantidade({ pendente, onFechar, onConfirmar }: Props) {
  const solido = pendente ? usaFracao(pendente.resultado.forma ?? "") : false;
  const sugerido = pendente?.resultado.volMax ?? pendente?.resultado.volMin ?? null;
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
    } else {
      setLiquido(sugerido ? paraDigitos(sugerido) : "");
      setFracao(null);
    }
  }, [pendente, solido, sugerido]);

  const atalhos = useMemo(() => {
    if (!pendente || solido) return [] as number[];
    const { volMin, volMax } = pendente.resultado;
    const vals = [volMin, volMax].filter((v): v is number => typeof v === "number" && v > 0);
    const extra = vals.length ? Math.round((vals[vals.length - 1] as number) * 100) / 100 : null;
    if (extra && !vals.some((v) => Math.abs(v - extra) < 0.0005)) vals.push(extra);
    return Array.from(new Set(vals.map((v) => Math.round(v * 1000)))).map((d) => d / 1000);
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
      ? `${formatar3(liquido)} ${unidadeBase || "mL"}`
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
          <p className="text-center text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Quantidade a ministrar
          </p>

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
                  value={formatar3(liquido)}
                  onChange={(e) => setLiquido(digitos(e.target.value))}
                  inputMode="numeric"
                  placeholder="0,000"
                  aria-label="Quantidade a ministrar"
                  className="w-full rounded-xl border border-input bg-background px-3 py-3 pr-14 text-center text-3xl font-bold text-foreground outline-none focus:border-ring"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                  {unidadeBase || "mL"}
                </span>
              </div>
              {atalhos.length > 0 && (
                <div className="mt-2 flex flex-wrap justify-center gap-2">
                  {atalhos.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setLiquido(paraDigitos(v))}
                      className="rounded-lg bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground hover:bg-secondary/70"
                    >
                      {formatar3(paraDigitos(v))}
                    </button>
                  ))}
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
