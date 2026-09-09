import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useMedicamentos } from "@/hooks/useMedicamentos";
import { VIAS } from "@/lib/medicamentos";
import { normalizarNomeMedicamento } from "@/lib/nomes";
import {
  ANIMAL_GERAL,
  PROCEDIMENTOS_PADRAO,
  ROTULO_CATEGORIA,
  itemVazio,
  type CategoriaPendencia,
  type ItemPendencia,
} from "@/lib/pendencias";

export type AnimalOpcao = { chave: string; nome: string; especie?: string };

type Props = {
  aberto: boolean;
  onFechar: () => void;
  animais: AnimalOpcao[];
  /** Item existente (edição) ou apenas a categoria escolhida (criação). */
  inicial: ItemPendencia | null;
  onSalvar: (item: ItemPendencia) => void;
};

const rotulo = "text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground";
const campo =
  "mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring";

export function DialogoNovoItem({ aberto, onFechar, animais, inicial, onSalvar }: Props) {
  const { medicamentos } = useMedicamentos();
  const [item, setItem] = useState<ItemPendencia>(inicial ?? itemVazio("pendencia"));

  useEffect(() => {
    if (aberto && inicial) setItem(inicial);
  }, [aberto, inicial]);

  const set = <K extends keyof ItemPendencia>(chave: K, valor: ItemPendencia[K]) =>
    setItem((i) => ({ ...i, [chave]: valor }));

  const trocarCategoria = (categoria: CategoriaPendencia) => set("categoria", categoria);

  const especiais = medicamentos
    .filter((m) => m.especial)
    .map((m) => normalizarNomeMedicamento(m.nome))
    .sort((a, b) => a.localeCompare(b, "pt-BR"));

  const salvar = () => {
    const nome = item.nome.trim();
    if (!nome) {
      toast.error("Escreva o nome.");
      return;
    }
    onSalvar({ ...item, nome, atualizadoEm: new Date().toISOString() });
    onFechar();
  };

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{ROTULO_CATEGORIA[item.categoria]}</DialogTitle>
          <DialogDescription>
            O que for lançado aqui não entra no PDF da ficha.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <p className={rotulo}>Tipo</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {(["pendencia", "medicamento", "procedimento"] as CategoriaPendencia[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => trocarCategoria(c)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    item.categoria === c
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/70"
                  }`}
                >
                  {ROTULO_CATEGORIA[c]}
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className={rotulo}>Animal</span>
            <select
              value={item.animalChave}
              onChange={(e) => {
                const alvo = animais.find((a) => a.chave === e.target.value);
                setItem((i) => ({
                  ...i,
                  animalChave: alvo?.chave ?? "",
                  animalNome: alvo?.nome ?? ANIMAL_GERAL,
                  especie: alvo?.especie ?? "",
                }));
              }}
              className={campo}
            >
              <option value="">{ANIMAL_GERAL}</option>
              {animais.map((a) => (
                <option key={a.chave} value={a.chave}>
                  {a.nome}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className={rotulo}>Nome</span>
            <input
              value={item.nome}
              onChange={(e) => set("nome", e.target.value)}
              list={item.categoria === "medicamento" ? "pendencias-especiais" : undefined}
              placeholder={
                item.categoria === "procedimento"
                  ? "Glicose, oxigênio, aquecimento…"
                  : item.categoria === "medicamento"
                    ? "Medicação cadastrada ou nova"
                    : "O que precisa ser feito"
              }
              className={campo}
            />
            {item.categoria === "medicamento" && (
              <datalist id="pendencias-especiais">
                {especiais.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            )}
          </label>

          {item.categoria === "procedimento" && (
            <div className="flex flex-wrap gap-2">
              {PROCEDIMENTOS_PADRAO.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => set("nome", p)}
                  className="rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground hover:bg-secondary/70"
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          {item.categoria !== "pendencia" && (
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block">
                <span className={rotulo}>Dose / qtd.</span>
                <input
                  value={item.dose ?? ""}
                  onChange={(e) => set("dose", e.target.value)}
                  placeholder="Opcional"
                  className={campo}
                />
              </label>
              <label className="block">
                <span className={rotulo}>Unidade</span>
                <input
                  value={item.unidade ?? ""}
                  onChange={(e) => set("unidade", e.target.value)}
                  placeholder="mL, mg, cp…"
                  className={campo}
                />
              </label>
              <label className="block">
                <span className={rotulo}>Via</span>
                <select
                  value={item.via ?? ""}
                  onChange={(e) => set("via", e.target.value)}
                  className={campo}
                >
                  <option value="">—</option>
                  {VIAS.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          <label className="block">
            <span className={rotulo}>Observação</span>
            <textarea
              value={item.observacao ?? ""}
              onChange={(e) => set("observacao", e.target.value)}
              rows={2}
              placeholder="Opcional"
              className={campo}
            />
          </label>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={salvar}
              className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Salvar
            </button>
            <button
              type="button"
              onClick={onFechar}
              className="rounded-xl bg-secondary px-4 py-2.5 text-sm font-semibold text-secondary-foreground hover:bg-secondary/70"
            >
              Cancelar
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
