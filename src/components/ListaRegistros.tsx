import { formatarRegistro, nomeAnimal, type Registro } from "@/lib/ficha";
import { useAnamneses } from "@/hooks/useAnamneses";



type Props = {
  registros: Registro[];
  onEditar: (r: Registro) => void;
  onAtualizar: (r: Registro) => void;
  onExcluir: (id: string) => void;
  onCopiar: (r: Registro) => void;
  onObito: (r: Registro) => void;
};


export function ListaRegistros({
  registros,
  onEditar,
  onAtualizar,
  onExcluir,
  onCopiar,
  onObito,
}: Props) {
  const { anamneses } = useAnamneses();

  if (registros.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Nenhum animal registrado ainda. Preencha a ficha e toque em Enviar.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {registros.map((r) => (
        <article
          key={r.id}
          id={`animal-${r.id}`}
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

          <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-relaxed text-muted-foreground">
            {formatarRegistro(r, { anamneses }).split("\n").slice(1).join("\n")}
          </pre>
        </article>

      ))}
    </div>
  );
}
