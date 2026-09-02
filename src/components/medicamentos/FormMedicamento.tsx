import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  NOME_VIA,
  ROTULO_VIA,
  UNIDADES_CONCENTRACAO,
  UNIDADES_DOSE,
  VIAS,
  faixaDe,
  medicamentoVazio,
  viasDe,
  type DoseEspecie,
  type Medicamento,
} from "@/lib/medicamentos";
import { IconeVia } from "@/components/medicamentos/IconeVia";

type Props = {
  aberto: boolean;
  /** null = novo medicamento */
  inicial: Medicamento | null;
  onFechar: () => void;
  onSalvar: (item: Medicamento) => void;
  onExcluir?: (id: string) => void;
};

const campo =
  "w-full rounded-xl border border-input bg-background px-3 py-2.5 text-base text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-ring";
const rotulo = "block text-xs font-semibold text-muted-foreground";

/** Normaliza a dose para o formato novo (mín/máx/porAnimal). */
function normalizarDose(d: DoseEspecie): DoseEspecie {
  const f = faixaDe(d);
  return {
    doseMin: f.min,
    doseMax: f.max,
    porAnimal: f.porAnimal,
    unidade: f.unidade,
    intervalo: d.intervalo ?? "",
    proibido: d.proibido === true,
  };
}

/** Cadastros antigos: trata como "mesma dose" quando cão e gato coincidem. */
function unificadoInicial(m: Medicamento): boolean {
  if (typeof m.doseUnificada === "boolean") return m.doseUnificada;
  const a = normalizarDose(m.cao);
  const b = normalizarDose(m.gato);
  if (a.proibido || b.proibido) return false;
  if (!b.doseMin && !b.doseMax) return true;
  return (
    a.doseMin === b.doseMin &&
    a.doseMax === b.doseMax &&
    a.porAnimal === b.porAnimal &&
    a.intervalo === b.intervalo
  );
}

export function FormMedicamento({ aberto, inicial, onFechar, onSalvar, onExcluir }: Props) {
  const [item, setItem] = useState<Medicamento>(() => inicial ?? medicamentoVazio());
  const [chave, setChave] = useState("");
  const [confirmando, setConfirmando] = useState(false);

  // Reinicia o formulário quando o alvo muda.
  const alvo = `${aberto}-${inicial?.id ?? "novo"}`;
  if (alvo !== chave) {
    setChave(alvo);
    setItem(
      inicial
        ? {
            ...inicial,
            vias: viasDe(inicial),
            cao: normalizarDose(inicial.cao),
            gato: normalizarDose(inicial.gato),
            doseUnificada: unificadoInicial(inicial),
          }
        : medicamentoVazio(),
    );
  }

  const salvar = () => {
    const nome = item.nome.trim();
    if (!nome) {
      toast.error("Escreva o nome do medicamento.");
      return;
    }
    const doses = item.doseUnificada
      ? { cao: { ...item.cao, proibido: false }, gato: { ...item.cao, proibido: false } }
      : { cao: item.cao, gato: item.gato };
    onSalvar({ ...item, ...doses, nome, teste: false });
    toast.success(inicial ? "Medicamento atualizado." : "Medicamento cadastrado.");
    onFechar();
  };

  const excluir = () => {
    if (!inicial || !onExcluir) return;
    onExcluir(inicial.id);
    toast.success("Medicamento excluído.");
    setConfirmando(false);
    onFechar();
  };

  const blocoDose = (especie: "cao" | "gato", titulo: string, fundo: string) => {
    const dose = item[especie];
    const f = faixaDe(dose);
    const proibido = dose.proibido === true && !item.doseUnificada;
    const atualizar = (partes: Partial<DoseEspecie>) =>
      setItem({ ...item, [especie]: { ...normalizarDose(dose), ...partes } });
    return (
      <fieldset
        className={`rounded-xl border p-3 ${
          proibido ? "border-destructive bg-destructive/5" : `border-border ${fundo}`
        }`}
      >
        <legend className="px-1 text-sm font-semibold text-foreground">{titulo}</legend>

        {!item.doseUnificada && (
          <label className="mb-2 flex items-start gap-2 text-xs font-semibold text-destructive">
            <input
              type="checkbox"
              checked={proibido}
              onChange={(e) => atualizar({ proibido: e.target.checked })}
              className="mt-0.5 h-4 w-4 accent-[hsl(var(--destructive))]"
            />
            Não pode ser ministrado nesta espécie
          </label>
        )}

        <div className="mb-2 grid grid-cols-2 gap-2">
          {(
            [
              { valor: false, rotulo: "mg/kg" },
              { valor: true, rotulo: "mg/animal" },
            ] as const
          ).map((o) => (
            <button
              key={o.rotulo}
              type="button"
              aria-pressed={f.porAnimal === o.valor}
              onClick={() => atualizar({ porAnimal: o.valor })}
              disabled={proibido}
              className={`rounded-lg border px-2 py-1.5 text-xs font-semibold transition-colors ${
                f.porAnimal === o.valor
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-foreground hover:bg-secondary"
              }`}
            >
              {o.rotulo}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <span className={rotulo}>Dose mínima</span>
            <input
              value={f.min}
              onChange={(e) => atualizar({ doseMin: e.target.value })}
              inputMode="decimal"
              disabled={proibido}
              className={`${campo} min-w-0 disabled:opacity-50`}
              placeholder="20"
            />
          </div>
          <div>
            <span className={rotulo}>Dose máxima</span>
            <input
              value={f.max}
              onChange={(e) => atualizar({ doseMax: e.target.value })}
              inputMode="decimal"
              disabled={proibido}
              className={`${campo} min-w-0 disabled:opacity-50`}
              placeholder="25"
            />
          </div>
          <div>
            <span className={rotulo}>Intervalo (h)</span>
            <input
              value={dose.intervalo}
              onChange={(e) => atualizar({ intervalo: e.target.value })}
              inputMode="decimal"
              disabled={proibido}
              className={`${campo} min-w-0 disabled:opacity-50`}
              placeholder="8"
            />
          </div>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Pode preencher só a mínima: nesse caso vale como dose única.
        </p>
      </fieldset>
    );
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

          <div>
            <span className={rotulo}>Dose</span>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { valor: true, rotulo: "🐶🐱 Mesma dose" },
                  { valor: false, rotulo: "🐶 / 🐱 Separar" },
                ] as const
              ).map((o) => {
                const ativo = (item.doseUnificada === true) === o.valor;
                return (
                  <button
                    key={o.rotulo}
                    type="button"
                    aria-pressed={ativo}
                    onClick={() => setItem({ ...item, doseUnificada: o.valor })}
                    className={`rounded-xl border px-2 py-2 text-sm font-semibold transition-colors ${
                      ativo
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-foreground hover:bg-secondary"
                    }`}
                  >
                    {o.rotulo}
                  </button>
                );
              })}
            </div>
          </div>

          {item.doseUnificada ? (
            blocoDose("cao", "🐶🐱 Cão e gato", "bg-secondary/40")
          ) : (
            <>
              {blocoDose("cao", "🐶 Cão", "bg-secondary/40")}
              {blocoDose("gato", "🐱 Gato", "bg-primary/5")}
            </>
          )}

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

          {inicial && onExcluir && (
            <button
              type="button"
              onClick={() => setConfirmando(true)}
              className="w-full rounded-xl border border-destructive px-4 py-3 text-sm font-semibold text-destructive hover:bg-destructive/10"
            >
              Excluir medicamento
            </button>
          )}
        </div>

        <AlertDialog open={confirmando} onOpenChange={setConfirmando}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir medicamento?</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir {inicial?.nome}? Essa ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={excluir}>Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
