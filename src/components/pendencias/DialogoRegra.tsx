import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  PARAMETROS_ALERTA,
  PROCEDIMENTOS_PADRAO,
  ROTULO_CATEGORIA,
  ROTULO_CONDICAO,
  ROTULO_PARAMETRO,
  regraVazia,
  type CategoriaPendencia,
  type CondicaoAlerta,
  type ParametroAlerta,
  type RegraAlerta,
} from "@/lib/pendencias";

type Props = {
  aberto: boolean;
  onFechar: () => void;
  /** Regra existente (edição) ou null para criar. */
  inicial: RegraAlerta | null;
  onSalvar: (regra: RegraAlerta) => void;
};

const rotulo = "text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground";
const campo =
  "mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring";

/** Cadastro de "quando o app deve perguntar se vai cobrar". */
export function DialogoRegra({ aberto, onFechar, inicial, onSalvar }: Props) {
  const [regra, setRegra] = useState<RegraAlerta>(inicial ?? regraVazia());

  useEffect(() => {
    if (aberto) setRegra(inicial ?? regraVazia());
  }, [aberto, inicial]);

  const set = <K extends keyof RegraAlerta>(chave: K, valor: RegraAlerta[K]) =>
    setRegra((r) => ({ ...r, [chave]: valor }));

  const salvar = () => {
    const pergunta = regra.pergunta.trim();
    const itemNome = regra.itemNome.trim();
    if (!pergunta) {
      toast.error("Escreva a pergunta que vai aparecer.");
      return;
    }
    if (!itemNome) {
      toast.error("Escreva o que vai para a cobrança.");
      return;
    }
    if (regra.condicao !== "sempre" && typeof regra.limite !== "number") {
      toast.error("Escreva o valor do limite.");
      return;
    }
    onSalvar({ ...regra, pergunta, itemNome });
    onFechar();
  };

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{inicial ? "Editar aviso" : "Novo aviso"}</DialogTitle>
          <DialogDescription>
            O app pergunta na ficha e só registra a cobrança depois do seu “Sim”.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <label className="block">
            <span className={rotulo}>Parâmetro da ficha</span>
            <select
              value={regra.parametro}
              onChange={(e) => set("parametro", e.target.value as ParametroAlerta)}
              className={campo}
            >
              {PARAMETROS_ALERTA.map((p) => (
                <option key={p} value={p}>
                  {ROTULO_PARAMETRO[p]}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className={rotulo}>Quando perguntar</span>
            <select
              value={regra.condicao}
              onChange={(e) => {
                const condicao = e.target.value as CondicaoAlerta;
                setRegra((r) => ({
                  ...r,
                  condicao,
                  limite: condicao === "sempre" ? undefined : (r.limite ?? undefined),
                }));
              }}
              className={campo}
            >
              {(["sempre", "abaixo", "acima"] as CondicaoAlerta[]).map((c) => (
                <option key={c} value={c}>
                  {ROTULO_CONDICAO[c]}
                </option>
              ))}
            </select>
          </label>

          {regra.condicao !== "sempre" && (
            <label className="block">
              <span className={rotulo}>Valor do limite</span>
              <input
                value={regra.limite === undefined ? "" : String(regra.limite).replace(".", ",")}
                onChange={(e) => {
                  const bruto = e.target.value.replace(",", ".").trim();
                  const n = Number(bruto);
                  set("limite", bruto && Number.isFinite(n) ? n : undefined);
                }}
                inputMode="decimal"
                placeholder="Ex.: 90"
                className={`${campo} tabular-nums`}
              />
            </label>
          )}

          <label className="block">
            <span className={rotulo}>Pergunta que aparece</span>
            <input
              value={regra.pergunta}
              onChange={(e) => set("pergunta", e.target.value)}
              placeholder="PAS baixa. Foi iniciada norepinefrina?"
              className={campo}
            />
          </label>

          <label className="block">
            <span className={rotulo}>O que vai para a cobrança</span>
            <input
              value={regra.itemNome}
              onChange={(e) => set("itemNome", e.target.value)}
              placeholder="Glicose, Norepinefrina, Aquecimento…"
              className={campo}
            />
          </label>

          <div className="flex flex-wrap gap-2">
            {PROCEDIMENTOS_PADRAO.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => set("itemNome", p)}
                className="min-h-11 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground hover:bg-secondary/70"
              >
                {p}
              </button>
            ))}
          </div>

          <div>
            <p className={rotulo}>Tipo do item</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {(["pendencia", "medicamento", "procedimento"] as CategoriaPendencia[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => set("itemCategoria", c)}
                  className={`min-h-11 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    regra.itemCategoria === c
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/70"
                  }`}
                >
                  {ROTULO_CATEGORIA[c]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={salvar}
              className="min-h-11 flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Salvar aviso
            </button>
            <button
              type="button"
              onClick={onFechar}
              className="min-h-11 rounded-xl bg-secondary px-4 py-2.5 text-sm font-semibold text-secondary-foreground hover:bg-secondary/70"
            >
              Cancelar
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
