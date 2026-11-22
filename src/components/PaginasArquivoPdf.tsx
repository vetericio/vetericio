import { useEffect, useRef, useState } from "react";

/**
 * Visualização de PDF em canvas, sem iframe/blob:. A CSP da clínica proíbe
 * frames com blob:, então o navegador não consegue mostrar o visor nativo.
 */
export function PaginasArquivoPdf({ bytes, rotulo = "Documento" }: {
  bytes: Uint8Array;
  rotulo?: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [pagina, setPagina] = useState(1);
  const [paginas, setPaginas] = useState(0);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    let tarefa: ReturnType<typeof import("pdfjs-dist")["getDocument"]> | undefined;
    let renderizacao: import("pdfjs-dist").RenderTask | undefined;
    setCarregando(true);
    setErro("");

    void (async () => {
      const [pdfjs, worker] = await Promise.all([
        import("pdfjs-dist"),
        import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
      ]);
      if (!ativo) return;
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      tarefa = pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false });
      const pdf = await tarefa.promise;
      if (!ativo) return;
      setPaginas(pdf.numPages);
      const folha = await pdf.getPage(Math.min(pagina, pdf.numPages));
      if (!ativo || !canvas.current) return;
      const contexto = canvas.current.getContext("2d");
      if (!contexto) throw new Error("Canvas não disponível neste navegador.");
      const viewport = folha.getViewport({ scale: 1.7 });
      canvas.current.width = Math.ceil(viewport.width);
      canvas.current.height = Math.ceil(viewport.height);
      renderizacao = folha.render({ canvasContext: contexto, viewport });
      await renderizacao.promise;
      if (ativo) setCarregando(false);
    })().catch((falha) => {
      if (ativo) {
        setCarregando(false);
        setErro(falha instanceof Error ? falha.message : "Falha na renderização.");
      }
    });

    return () => {
      ativo = false;
      renderizacao?.cancel();
      void tarefa?.destroy().catch(() => {});
    };
  }, [bytes, pagina]);

  return <div className="mx-auto w-full max-w-2xl space-y-3">
    {erro && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
      Não foi possível renderizar a prévia neste painel. Utilize o botão Baixar para abrir o PDF.
      <span className="mt-1 block text-xs">{erro}</span>
    </div>}
    {carregando && <p role="status" className="text-center text-sm text-muted-foreground">
      Preparando visualização do PDF…
    </p>}
    <canvas ref={canvas} role="img" aria-label={rotulo + ", página " + pagina + " de " + (paginas || 1)}
      className={"h-auto w-full rounded border bg-white shadow-sm " + (erro ? "hidden" : "")} />
    {paginas > 1 && <nav aria-label="Navegação do PDF" className="flex items-center justify-center gap-3">
      <button type="button" disabled={pagina <= 1}
        onClick={() => setPagina(atual => Math.max(1, atual - 1))}
        className="min-h-10 rounded-lg border bg-background px-3 text-sm font-semibold disabled:opacity-40">
        Anterior
      </button>
      <span className="text-sm font-semibold">{pagina} de {paginas}</span>
      <button type="button" disabled={pagina >= paginas}
        onClick={() => setPagina(atual => Math.min(paginas, atual + 1))}
        className="min-h-10 rounded-lg border bg-background px-3 text-sm font-semibold disabled:opacity-40">
        Próxima
      </button>
    </nav>}
  </div>;
}
