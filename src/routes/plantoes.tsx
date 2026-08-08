import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { usePlantoes } from "@/hooks/usePlantoes";
import { formatarTodos, rotuloPlantao, type Plantao } from "@/lib/ficha";
import { rotuloPlantaoPdfDe } from "@/lib/plantao";
import { exportarPdf } from "@/lib/pdf";

export const Route = createFileRoute("/plantoes")({
  head: () => ({
    meta: [
      { title: "Plantões salvos — Veterício" },
      {
        name: "description",
        content:
          "Histórico dos 10 últimos plantões da internação, com texto completo, cópia, exportação em PDF e exclusão.",
      },
      { property: "og:title", content: "Plantões salvos — Veterício" },
      {
        property: "og:description",
        content: "Consulte, copie e exporte em PDF os plantões da internação já fechados.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Plantoes,
});

function Plantoes() {
  const { plantoes, setPlantoes } = usePlantoes();
  const [aberto, setAberto] = useState<string | null>(null);
  const [baixando, setBaixando] = useState<string | null>(null);

  const copiar = async (p: Plantao) => {
    try {
      await navigator.clipboard.writeText(formatarTodos(p.registros));
      toast.success("Texto copiado.");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  const pdf = async (p: Plantao) => {
    try {
      await exportarPdf(p.registros, {
        legenda: rotuloPlantaoPdfDe(p.data, p.turno),
        arquivo: `veterico-plantao-${p.data}.pdf`,
      });
      toast.success("PDF gerado.");
    } catch {
      toast.error("Não foi possível gerar o PDF.");
    }
  };

  const baixarTodos = async () => {
    if (plantoes.length === 0) {
      toast.info("Nenhum plantão salvo para baixar.");
      return;
    }
    try {
      for (let i = 0; i < plantoes.length; i++) {
        const p = plantoes[i]!;
        setBaixando(`${i + 1} de ${plantoes.length}`);
        await exportarPdf(p.registros, {
          legenda: rotuloPlantaoPdfDe(p.data, p.turno),
          arquivo: `veterico-plantao-${p.data}.pdf`,
        });
        await new Promise((r) => setTimeout(r, 400));
      }
      toast.success("Todos os plantões foram baixados.", {
        description: "Se algum arquivo não apareceu, libere downloads múltiplos no navegador.",
      });
    } catch {
      toast.error("Não foi possível baixar todos os PDFs.");
    } finally {
      setBaixando(null);
    }
  };

  const apagarTodos = () => {
    if (plantoes.length === 0) {
      toast.info("Nenhum plantão salvo.");
      return;
    }
    const perguntas = [
      "Apagar todos os plantões salvos?",
      "Tem certeza? Isso remove o histórico completo.",
      "Esta ação é permanente e não pode ser desfeita.",
      "Última confirmação: apagar para sempre?",
    ];
    for (const q of perguntas) {
      if (!window.confirm(q)) {
        toast.info("Nada foi apagado.");
        return;
      }
    }
    setPlantoes([]);
    toast.success("Todos os plantões foram apagados.");
  };

  const excluir = (p: Plantao) => {
    if (!window.confirm(`Excluir o plantão de ${rotuloPlantao(p)}?`)) return;
    setPlantoes((ps) => ps.filter((x) => x.id !== p.id));
    toast.success("Plantão excluído.");
  };

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6">
      <h2 className="font-display text-lg font-semibold text-foreground">
        Plantões salvos ({plantoes.length})
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Todos os plantões ficam guardados neste aparelho.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={baixarTodos}
          disabled={baixando !== null}
          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {baixando ? `Baixando ${baixando}...` : "Baixar todos os plantões (PDF)"}
        </button>
        <button
          type="button"
          onClick={apagarTodos}
          className="rounded-lg bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/20"
        >
          Apagar todos os plantões
        </button>
      </div>

      {plantoes.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Nenhum plantão salvo ainda. Feche um plantão na página de animais registrados.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {plantoes.map((p) => (
            <article key={p.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-semibold text-foreground">{rotuloPlantao(p)}</h3>
                  <p className="text-xs text-muted-foreground">
                    {p.registros.length} {p.registros.length === 1 ? "animal" : "animais"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setAberto(aberto === p.id ? null : p.id)}
                    className="rounded-lg bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground hover:bg-secondary/70"
                  >
                    {aberto === p.id ? "Fechar" : "Ver texto"}
                  </button>
                  <button
                    type="button"
                    onClick={() => copiar(p)}
                    className="rounded-lg bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground hover:bg-secondary/70"
                  >
                    Copiar
                  </button>
                  <button
                    type="button"
                    onClick={() => pdf(p)}
                    className="rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                  >
                    PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => excluir(p)}
                    className="rounded-lg bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive hover:bg-destructive/20"
                  >
                    Excluir
                  </button>
                </div>
              </div>

              {aberto === p.id && (
                <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-xl bg-secondary p-3 font-sans text-sm leading-relaxed text-foreground">
                  {formatarTodos(p.registros)}
                </pre>
              )}
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
