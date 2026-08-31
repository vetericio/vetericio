import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  UNIDADES_CONCENTRACAO,
  VIAS,
  medicamentoVazio,
  viasDe,
  type Medicamento,
} from "@/lib/medicamentos";

type Props = {
  aberto: boolean;
  /** null = novo medicamento */
  inicial: Medicamento | null;
  onFechar: () => void;
  onSalvar: (item: Medicamento) => void;
};

const campo =
  "w-full rounded-xl border border-input bg-background px-3 py-2.5 text-base text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-ring";
const rotulo = "block text-xs font-semibold text-muted-foreground";

export function FormMedicamento({ aberto, inicial, onFechar, onSalvar }: Props) {
  const [item, setItem] = useState<Medicamento>(() => inicial ?? medicamentoVazio());
  const [chave, setChave] = useState("");

  // Reinicia o formulário quando o alvo muda.
  const alvo = `${aberto}-${inicial?.id ?? "novo"}`;
  if (alvo !== chave) {
    setChave(alvo);
    setItem(inicial ? { ...inicial, cao: { ...inicial.cao }, gato: { ...inicial.gato } } : medicamentoVazio());
  }

  const salvar = () => {
    const nome = item.nome.trim();
    if (!nome) {
      toast.error("Escreva o nome do medicamento.");
      return;
    }
    onSalvar({ ...item, nome, teste: false });
    toast.success(inicial ? "Medicamento atualizado." : "Medicamento cadastrado.");
    onFechar();
  };

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{inicial ? "Editar medicamento" : "Inserir novo"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className={rotulo} htmlFor="med-nome">
              Nome do medicamento
            </label>
            <input
              id="med-nome"
              value={item.nome}
              onChange={(e) => setItem({ ...item, nome: e.target.value })}
              className={campo}
              placeholder="Nome"
            />
          </div>

          <div>
            <span className={rotulo}>Via</span>
            <div className="grid grid-cols-3 gap-2">
              {VIAS.map((v) => {
                const ativo = item.vias.includes(v);
                return (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={ativo}
                    onClick={() =>
                      setItem({
                        ...item,
                        vias: ativo
                          ? item.vias.filter((x) => x !== v)
                          : VIAS.filter((x) => x === v || item.vias.includes(x)),
                      })
                    }
                    className={`rounded-xl border px-2 py-2 text-sm font-semibold transition-colors ${
                      ativo
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-foreground hover:bg-secondary"
                    }`}
                  >
                    {v}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <span className={rotulo}>Concentração</span>
            <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-2">
              <input
                value={item.concentracaoValor}
                onChange={(e) => setItem({ ...item, concentracaoValor: e.target.value })}
                inputMode="decimal"
                className={`${campo} min-w-0`}
                placeholder="50"
              />
              <input
                list="unidades-concentracao"
                value={item.concentracaoUnidade}
                onChange={(e) => setItem({ ...item, concentracaoUnidade: e.target.value })}
                className={`${campo} min-w-0`}
                placeholder="mg/mL"
              />
              <datalist id="unidades-concentracao">
                {UNIDADES_CONCENTRACAO.map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
            </div>
          </div>

          <div>
            <label className={rotulo} htmlFor="med-resumo">
              Resumo
            </label>
            <textarea
              id="med-resumo"
              value={item.resumo}
              onChange={(e) => setItem({ ...item, resumo: e.target.value })}
              rows={3}
              className={campo}
              placeholder="Anotações livres"
            />
          </div>

          <div>
            <label className={rotulo} htmlFor="med-classe">
              Classificação
            </label>
            <input
              id="med-classe"
              value={item.classificacao}
              onChange={(e) => setItem({ ...item, classificacao: e.target.value })}
              className={campo}
              placeholder="Ex.: antibiótico"
            />
          </div>

          <fieldset className="rounded-xl border border-border bg-secondary/40 p-3">
            <legend className="px-1 text-sm font-semibold text-foreground">🐶 Cão</legend>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className={rotulo}>Dose (mg/kg)</span>
                <input
                  value={item.cao.dose}
                  onChange={(e) => setItem({ ...item, cao: { ...item.cao, dose: e.target.value } })}
                  inputMode="decimal"
                  className={campo}
                />
              </div>
              <div>
                <span className={rotulo}>Intervalo (horas)</span>
                <input
                  value={item.cao.intervalo}
                  onChange={(e) =>
                    setItem({ ...item, cao: { ...item.cao, intervalo: e.target.value } })
                  }
                  inputMode="decimal"
                  className={campo}
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="rounded-xl border border-border bg-primary/5 p-3">
            <legend className="px-1 text-sm font-semibold text-foreground">🐱 Gato</legend>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className={rotulo}>Dose (mg/kg)</span>
                <input
                  value={item.gato.dose}
                  onChange={(e) =>
                    setItem({ ...item, gato: { ...item.gato, dose: e.target.value } })
                  }
                  inputMode="decimal"
                  className={campo}
                />
              </div>
              <div>
                <span className={rotulo}>Intervalo (horas)</span>
                <input
                  value={item.gato.intervalo}
                  onChange={(e) =>
                    setItem({ ...item, gato: { ...item.gato, intervalo: e.target.value } })
                  }
                  inputMode="decimal"
                  className={campo}
                />
              </div>
            </div>
          </fieldset>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={salvar}
              className="flex-1 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Salvar
            </button>
            <button
              type="button"
              onClick={onFechar}
              className="rounded-xl bg-secondary px-4 py-3 text-sm font-semibold text-secondary-foreground hover:bg-secondary/70"
            >
              Cancelar
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
