import { alteracoesDoRegistro, comVirgula, nomeAnimal, type Registro } from "@/lib/ficha";

type Props = {
  registros: Registro[];
  onEditar: (r: Registro) => void;
  onAtualizar: (r: Registro) => void;
  onExcluir: (id: string) => void;
  onCopiar: (r: Registro) => void;
  onObito: (r: Registro) => void;
};

export function AnimaisAtencao({
  registros,
  onEditar,
  onAtualizar,
  onExcluir,
  onCopiar,
  onObito,
}: Props) {
  if (registros.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Nenhum animal com parâmetro alterado agora.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {registros.map((r) => {
        const alteracoes = alteracoesDoRegistro(r);
        return (
          <article
            key={r.id}
            id={`atencao-${r.id}`}
            className="scroll-mt-28 rounded-2xl border border-border bg-card p-4 shadow-sm"
          >
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onCopiar(r)}
                className="rounded-lg bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground hover:bg-secondary/70"
              >
                Copiar
              </button>
              <button
                type="button"
                onClick={() => onEditar(r)}
                className="rounded-lg bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground hover:bg-secondary/70"
              >
                Editar
              </button>
              <button
                type="button"
                onClick={() => onAtualizar(r)}
                className="rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Atualizar
              </button>
              <button
                type="button"
                onClick={() => onObito(r)}
                className="rounded-lg bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground hover:bg-secondary/70"
              >
                {r.obito ? "Desfazer óbito" : "Óbito"}
              </button>
              <button
                type="button"
                onClick={() => onExcluir(r.id)}
                className="rounded-lg bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive hover:bg-destructive/20"
              >
                Excluir
              </button>
            </div>

            <h3 className="mt-3 text-base font-semibold text-foreground">
              {nomeAnimal(r)}
              {r.obito && (
                <span className="ml-2 rounded-md bg-destructive/10 px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-destructive">
                  Óbito {r.obito.hora}
                </span>
              )}
            </h3>

            <ul className="mt-2 space-y-1.5">
              {alteracoes.map((a) => {
                const acima = a.direcao === "acima";
                return (
                  <li
                    key={a.chave}
                    className={
                      "flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-xl border px-3 py-2 text-sm " +
                      (acima
                        ? "border-destructive/30 bg-destructive/10 text-destructive"
                        : "border-primary/30 bg-primary/10 text-primary")
                    }
                  >
                    <span className="text-base font-bold leading-none">{acima ? "↑" : "↓"}</span>
                    <span className="font-semibold">
                      {a.rotulo} {a.valor} {a.unidade}
                    </span>
                    <span className="text-xs font-medium opacity-90">
                      {a.termo === "apneia" ? "apneia" : `${a.direcao} — ${a.termo}`}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      faixa {comVirgula(String(a.faixa[0]))}–{comVirgula(String(a.faixa[1]))}
                    </span>
                  </li>
                );
              })}
            </ul>
          </article>
        );
      })}
    </div>
  );
}
