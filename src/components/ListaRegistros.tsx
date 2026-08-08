import { formatarRegistro, nomeAnimal, type Registro } from "@/lib/ficha";
import { resumoRegistro } from "@/lib/resumo";


type Props = {
  registros: Registro[];
  onEditar: (r: Registro) => void;
  onAtualizar: (r: Registro) => void;
  onExcluir: (id: string) => void;
  onCopiar: (r: Registro) => void;
};

export function ListaRegistros({
  registros,
  onEditar,
  onAtualizar,
  onExcluir,
  onCopiar,
}: Props) {
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
        <article key={r.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-base font-semibold text-foreground">
              {dataHoraRegistro(r) && (
                <span className="mr-1 font-normal text-muted-foreground">
                  {dataHoraRegistro(r)} —
                </span>
              )}
              {r.animal.trim() || "Sem nome"}
            </h3>
            <div className="flex shrink-0 flex-wrap justify-end gap-2">
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
                onClick={() => onExcluir(r.id)}
                className="rounded-lg bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive hover:bg-destructive/20"
              >
                Excluir
              </button>
            </div>
          </div>
          <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-relaxed text-muted-foreground">
            {formatarRegistro(r).split("\n").slice(1).join("\n")}
          </pre>
        </article>
      ))}
    </div>
  );
}
