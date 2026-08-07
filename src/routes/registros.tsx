import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ListaRegistros } from "@/components/ListaRegistros";
import { useRegistros } from "@/hooks/useRegistros";
import { usePlantoes } from "@/hooks/usePlantoes";
import {
  MAX_PLANTOES,
  formatarRegistro,
  formatarTodos,
  type Registro,
} from "@/lib/ficha";
import { exportarPdf } from "@/lib/pdf";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/registros")({
  head: () => ({
    meta: [
      { title: "Animais registrados — Veterício" },
      {
        name: "description",
        content:
          "Lista dos animais avaliados na internação, com edição, exclusão, cópia, exportação em PDF e fechamento de plantão.",
      },
      { property: "og:title", content: "Animais registrados — Veterício" },
      {
        property: "og:description",
        content: "Consulte, edite, copie e exporte as avaliações de internação registradas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Registros,
});

function hoje() {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

function Registros() {
  const { registros, setRegistros } = useRegistros();
  const { setPlantoes } = usePlantoes();
  const navigate = useNavigate();
  const [fechando, setFechando] = useState(false);
  const [data, setData] = useState(hoje);
  const [turno, setTurno] = useState("");

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

  const copiarTexto = async (texto: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success("Texto copiado.");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  const exportar = async () => {
    try {
      await exportarPdf(registros);
      toast.success("PDF gerado.");
    } catch {
      toast.error("Não foi possível gerar o PDF.");
    }
  };

  const fecharPlantao = () => {
    if (!data) {
      toast.error("Informe a data do plantão.");
      return;
    }
    const plantao = {
      id: crypto.randomUUID(),
      data,
      turno,
      registros,
      criadoEm: new Date().toISOString(),
    };
    setPlantoes((ps) => [plantao, ...ps].slice(0, MAX_PLANTOES));
    setRegistros([]);
    setFechando(false);
    setTurno("");
    setData(hoje());
    toast.success("Plantão salvo no histórico.");
    navigate({ to: "/plantoes" });
  };

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6">
      <h2 className="font-display text-lg font-semibold text-foreground">
        Animais registrados ({registros.length})
      </h2>

      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          to="/plantoes"
          className="rounded-xl bg-secondary px-3 py-2 text-xs font-semibold text-secondary-foreground hover:bg-secondary/70"
        >
          Plantões
        </Link>
        <Link
          to="/evolucao"
          className="rounded-xl bg-secondary px-3 py-2 text-xs font-semibold text-secondary-foreground hover:bg-secondary/70"
        >
          Evolução
        </Link>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {registros.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => copiarTexto(formatarTodos(registros))}
              className="rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Copiar todos
            </button>
            <button
              type="button"
              onClick={exportar}
              className="rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Exportar PDF
            </button>
            <button
              type="button"
              onClick={() => setFechando((v) => !v)}
              className="rounded-xl bg-secondary px-3 py-2 text-xs font-semibold text-secondary-foreground hover:bg-secondary/70"
            >
              Fechar plantão
            </button>
          </>
        )}
        <button
          type="button"
          onClick={apagarTudo}
          className="rounded-xl bg-destructive px-3 py-2 text-xs font-semibold text-destructive-foreground hover:bg-destructive/90"
        >
          Apagar todos os registros
        </button>
      </div>

      {fechando && registros.length > 0 && (
        <section className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h3 className="font-display text-sm font-semibold text-foreground">Fechar plantão</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Os {registros.length} animais vão para o histórico e a lista fica vazia para o próximo
            plantão.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs text-muted-foreground">Data</span>
              <input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="mt-1 w-full rounded-lg border border-input bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-ring"
              />
            </label>
            <div>
              <span className="text-xs text-muted-foreground">Turno (opcional)</span>
              <div className="mt-1 flex gap-2">
                {["Diurno", "Noturno"].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTurno(turno === t ? "" : t)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                      turno === t
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground hover:bg-secondary/70"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={fecharPlantao}
              className="rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Salvar plantão
            </button>
            <button
              type="button"
              onClick={() => setFechando(false)}
              className="rounded-xl bg-secondary px-3 py-2 text-xs font-semibold text-secondary-foreground hover:bg-secondary/70"
            >
              Cancelar
            </button>
          </div>
        </section>
      )}

      <div className="mt-4">
        <ListaRegistros
          registros={registros}
          onCopiar={(r: Registro) => copiarTexto(formatarRegistro(r))}
          onEditar={(r) => {
            window.localStorage.setItem("veterico-editar-id", r.id);
            navigate({ to: "/" });
          }}
          onExcluir={(id) => {
            const alvo = registros.find((r) => r.id === id);
            if (!window.confirm(`Excluir o registro de ${alvo?.animal.trim() || "sem nome"}?`))
              return;
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
