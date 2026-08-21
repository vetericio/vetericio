import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  OPCOES,
  PARAMETROS_BLOCO,
  ehChaveNumerica,
  nomeAnimal,
  type ChaveAtualizavel,
  type Registro,
} from "@/lib/ficha";

type Props = {
  aberto: boolean;
  onFechar: () => void;
  registros: Registro[];
  onAplicar: (chave: ChaveAtualizavel, valores: Record<string, string>) => void;
};

function normalizar(texto: string) {
  return texto
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function AtualizarEmBloco({ aberto, onFechar, registros, onAplicar }: Props) {
  const [chave, setChave] = useState<ChaveAtualizavel>("temperatura");
  const [valores, setValores] = useState<Record<string, string>>({});

  const ordenados = useMemo(
    () =>
      [...registros].sort((a, b) =>
        normalizar(a.animal).localeCompare(normalizar(b.animal), "pt-BR"),
      ),
    [registros],
  );

  const numerico = ehChaveNumerica(chave);
  const opcoes = numerico ? [] : ((OPCOES[chave as keyof typeof OPCOES] as readonly string[]) ?? []);
  const preenchidos = Object.values(valores).filter((v) => v.trim()).length;

  const trocarParametro = (nova: ChaveAtualizavel) => {
    setChave(nova);
    setValores({});
  };

  const fechar = () => {
    setValores({});
    onFechar();
  };

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && fechar()}>
      <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Atualizar em bloco</DialogTitle>
          <DialogDescription>
            Escolha o parâmetro e preencha só os animais que quer atualizar. Os valores anteriores
            são mantidos.
          </DialogDescription>
        </DialogHeader>

        <label className="block">
          <span className="text-xs font-semibold text-muted-foreground">Parâmetro</span>
          <select
            value={chave}
            onChange={(e) => trocarParametro(e.target.value as ChaveAtualizavel)}
            className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
          >
            {PARAMETROS_BLOCO.map((p) => (
              <option key={p.chave} value={p.chave}>
                {p.rotulo}
              </option>
            ))}
          </select>
        </label>

        <div className="max-h-[45vh] space-y-2 overflow-y-auto pr-1">
          {ordenados.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum animal internado.</p>
          )}
          {ordenados.map((r) => {
            const atual = r[chave].trim();
            return (
              <div
                key={r.id}
                className="flex items-center gap-2 rounded-xl border border-border bg-card p-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {nomeAnimal(r)}
                    {r.obito && (
                      <span className="ml-1 text-[0.65rem] font-semibold uppercase text-destructive">
                        óbito
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {atual ? `Atual: ${atual}` : "Sem valor"}
                  </p>
                </div>
                {numerico ? (
                  <input
                    inputMode="decimal"
                    disabled={Boolean(r.obito)}
                    value={valores[r.id] ?? ""}
                    onChange={(e) => setValores((v) => ({ ...v, [r.id]: e.target.value }))}
                    placeholder="novo"
                    className="w-24 rounded-lg border border-input bg-background px-2 py-1.5 text-base text-foreground outline-none focus:border-ring disabled:opacity-50"
                  />
                ) : (
                  <select
                    disabled={Boolean(r.obito)}
                    value={valores[r.id] ?? ""}
                    onChange={(e) => setValores((v) => ({ ...v, [r.id]: e.target.value }))}
                    className="w-32 rounded-lg border border-input bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-ring disabled:opacity-50"
                  >
                    <option value="">—</option>
                    {opcoes.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={fechar}
            className="rounded-xl bg-secondary px-3 py-2 text-xs font-semibold text-secondary-foreground hover:bg-secondary/70"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={preenchidos === 0}
            onClick={() => {
              onAplicar(chave, valores);
              setValores({});
            }}
            className="rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Atualizar todos ({preenchidos})
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
