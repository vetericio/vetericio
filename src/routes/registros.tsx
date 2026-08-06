import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ListaRegistros } from "@/components/ListaRegistros";
import { useRegistros } from "@/hooks/useRegistros";
import { formatarTodos } from "@/lib/ficha";

export const Route = createFileRoute("/registros")({
  head: () => ({
    meta: [
      { title: "Animais registrados — Veterício" },
      {
        name: "description",
        content:
          "Lista dos animais avaliados na internação, com edição, exclusão e exportação de todos os dados em texto.",
      },
      { property: "og:title", content: "Animais registrados — Veterício" },
      {
        property: "og:description",
        content: "Consulte, edite e exporte as avaliações de internação registradas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Registros,
});

function Registros() {
  const { registros, setRegistros } = useRegistros();
  const navigate = useNavigate();

  const apagarTudo = () => {
    if (registros.length === 0) {
      toast.info("Não há registros salvos.");
      return;
    }
    if (window.confirm("Apagar todos os registros salvos neste aparelho?")) {
      setRegistros([]);
      toast.success("Todos os registros foram apagados.");
    }
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(formatarTodos(registros));
      toast.success("Texto copiado.");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  const compartilhar = async () => {
    const texto = formatarTodos(registros);
    try {
      if (navigator.share) {
        await navigator.share({ text: texto });
        return;
      }
      await copiar();
    } catch {
      /* cancelado */
    }
  };

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h1 className="truncate font-display text-xl font-semibold text-foreground">
            Animais registrados ({registros.length})
          </h1>
          <p className="text-xs text-muted-foreground">Veterício — Ficha de Internação</p>
        </div>
        <Link
          to="/"
          className="shrink-0 rounded-xl bg-secondary px-3 py-2 text-xs font-semibold text-secondary-foreground hover:bg-secondary/70"
        >
          Nova ficha
        </Link>
      </header>

      <div className="mt-4 flex flex-wrap gap-2">
          {registros.length > 0 && (
          <button
            type="button"
            onClick={copiar}
            className="rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Copiar texto
          </button>
          <button
            type="button"
            onClick={compartilhar}
            className="rounded-xl bg-secondary px-3 py-2 text-xs font-semibold text-secondary-foreground hover:bg-secondary/70"
          >
            Compartilhar
          </button>
          )}
          <button
            type="button"
            onClick={apagarTudo}
            className="rounded-xl bg-destructive px-3 py-2 text-xs font-semibold text-destructive-foreground hover:bg-destructive/90"
          >
            Apagar todos os registros
          </button>
      </div>

      <div className="mt-4">
        <ListaRegistros
          registros={registros}
          onEditar={(r) => {
            window.localStorage.setItem("veterico-editar-id", r.id);
            navigate({ to: "/" });
          }}
          onExcluir={(id) => {
            const alvo = registros.find((r) => r.id === id);
            if (!window.confirm(`Excluir o registro de ${alvo?.animal.trim() || "sem nome"}?`)) return;
            setRegistros((rs) => rs.filter((x) => x.id !== id));
            toast.success("Registro excluído.");
          }}
        />
      </div>

      {registros.length > 0 && (
        <section className="mt-8 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h2 className="font-display text-base font-semibold text-foreground">Texto exportado</h2>
          <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded-xl bg-secondary p-3 font-sans text-sm leading-relaxed text-foreground">
            {formatarTodos(registros)}
          </pre>
        </section>
      )}
    </main>
  );
}
