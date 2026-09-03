import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ordenarMedicamentos, type Medicamento } from "@/lib/medicamentos";
import { normalizarNomeMedicamento } from "@/lib/nomes";

type Props = {
  aberto: boolean;
  medicamentos: Medicamento[];
  onFechar: () => void;
  onEscolher: (m: Medicamento) => void;
};

export function DialogoEscolherMedicamento({
  aberto,
  medicamentos,
  onFechar,
  onEscolher,
}: Props) {
  const [busca, setBusca] = useState("");

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const ordenada = ordenarMedicamentos(medicamentos);
    if (!termo) return ordenada;
    return ordenada.filter((m) =>
      `${m.nomeMenor ?? ""} ${m.nome}`.toLowerCase().includes(termo),
    );
  }, [medicamentos, busca]);

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Atualizar medicamento</DialogTitle>
        </DialogHeader>

        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="🔎 Buscar medicação..."
          className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-base text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-ring"
        />

        <ul className="space-y-1.5">
          {lista.length === 0 && (
            <li className="rounded-xl bg-secondary/60 px-3 py-3 text-sm text-muted-foreground">
              Nenhuma medicação cadastrada.
            </li>
          )}
          {lista.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => onEscolher(m)}
                className="w-full rounded-xl border border-border bg-card/60 px-3 py-2 text-left leading-tight hover:bg-secondary/60"
              >
                {m.nomeMenor?.trim() && (
                  <span className="block text-[11px] text-muted-foreground">
                    {normalizarNomeMedicamento(m.nomeMenor)}
                  </span>
                )}
                <span className="block text-base font-semibold text-foreground">
                  {normalizarNomeMedicamento(m.nome)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
