import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Trash2, X } from "lucide-react";

import {
  gravarSelo,
  lerArquivoComoDataUrl,
  lerSelo,
  nomeAssinado,
  proporcao,
  removerFundoBranco,
  type TipoSelo,
} from "@/lib/assinatura";

type Pagina = { imagem: string; largura: number; altura: number };

type Documento = {
  nome: string;
  bytes: ArrayBuffer | null; // PDF original; null quando a origem é imagem
  imagem: string | null; // imagem original quando a origem é foto
  paginas: Pagina[];
};

type Item = {
  id: string;
  tipo: TipoSelo;
  pagina: number;
  /** posição do canto superior esquerdo, em fração da página */
  x: number;
  y: number;
  /** largura em fração da página */
  largura: number;
  /** largura/altura da imagem */
  prop: number;
};

const ROTULO: Record<TipoSelo, string> = { assinatura: "Assinatura", carimbo: "Carimbo" };

async function pdfParaPaginas(bytes: ArrayBuffer): Promise<Pagina[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const worker = await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes.slice(0)) }).promise;
  const paginas: Pagina[] = [];
  for (let n = 1; n <= doc.numPages; n += 1) {
    const pagina = await doc.getPage(n);
    const base = pagina.getViewport({ scale: 1 });
    const escala = Math.min(1400 / base.width, 2);
    const viewport = pagina.getViewport({ scale: escala });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    await pagina.render({ canvasContext: ctx, viewport }).promise;
    paginas.push({ imagem: canvas.toDataURL("image/jpeg", 0.85), largura: base.width, altura: base.height });
  }
  return paginas;
}

export function AssinarDocumento() {
  const [selos, setSelos] = useState<Record<TipoSelo, string | null>>({
    assinatura: null,
    carimbo: null,
  });
  const [doc, setDoc] = useState<Documento | null>(null);
  const [pagina, setPagina] = useState(0);
  const [itens, setItens] = useState<Item[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const areaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ler = () =>
      setSelos({ assinatura: lerSelo("assinatura"), carimbo: lerSelo("carimbo") });
    ler();
    window.addEventListener("veterico-selos", ler);
    return () => window.removeEventListener("veterico-selos", ler);
  }, []);

  const subirSelo = async (tipo: TipoSelo, arquivo: File | undefined) => {
    if (!arquivo) return;
    try {
      const bruto = await lerArquivoComoDataUrl(arquivo);
      const limpo = await removerFundoBranco(bruto);
      gravarSelo(tipo, limpo);
      toast.success(`${ROTULO[tipo]} salva neste aparelho`);
    } catch {
      toast.error("Não foi possível usar esta imagem");
    }
  };

  const abrirDocumento = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    setCarregando(true);
    setItens([]);
    setPagina(0);
    try {
      if (arquivo.type === "application/pdf" || /\.pdf$/i.test(arquivo.name)) {
        const bytes = await arquivo.arrayBuffer();
        const paginas = await pdfParaPaginas(bytes);
        if (paginas.length === 0) throw new Error("PDF vazio");
        setDoc({ nome: arquivo.name, bytes, imagem: null, paginas });
      } else {
        const dataUrl = await lerArquivoComoDataUrl(arquivo);
        const prop = await proporcao(dataUrl);
        const largura = 1000;
        setDoc({
          nome: arquivo.name,
          bytes: null,
          imagem: dataUrl,
          paginas: [{ imagem: dataUrl, largura, altura: Math.round(largura / prop) }],
        });
      }
    } catch (e) {
      console.error("abrir documento", e);
      toast.error("Não foi possível abrir este arquivo");
    } finally {
      setCarregando(false);
    }
  };

  const adicionar = async (tipo: TipoSelo) => {
    const url = selos[tipo];
    if (!url) {
      toast.error(`Suba primeiro a sua ${ROTULO[tipo].toLowerCase()}`);
      return;
    }
    if (!doc) {
      toast.error("Escolha primeiro o arquivo");
      return;
    }
    const prop = await proporcao(url);
    setItens((a) => [
      ...a,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        tipo,
        pagina,
        x: 0.15,
        y: 0.6,
        largura: 0.3,
        prop,
      },
    ]);
  };

  /** Arrastar e redimensionar com o dedo. */
  const iniciarGesto = (
    e: React.PointerEvent,
    id: string,
    modo: "mover" | "tamanho",
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const area = areaRef.current;
    if (!area) return;
    const caixa = area.getBoundingClientRect();
    const inicial = itens.find((i) => i.id === id);
    if (!inicial) return;
    const x0 = e.clientX;
    const y0 = e.clientY;
    const alvo = e.currentTarget as HTMLElement;
    alvo.setPointerCapture(e.pointerId);

    const mover = (ev: PointerEvent) => {
      const dx = (ev.clientX - x0) / caixa.width;
      const dy = (ev.clientY - y0) / caixa.height;
      setItens((lista) =>
        lista.map((i) => {
          if (i.id !== id) return i;
          if (modo === "mover") {
            return {
              ...i,
              x: Math.min(1 - i.largura, Math.max(0, inicial.x + dx)),
              y: Math.min(1, Math.max(0, inicial.y + dy)),
            };
          }
          return { ...i, largura: Math.min(1, Math.max(0.05, inicial.largura + dx)) };
        }),
      );
    };
    const soltar = () => {
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
    };
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
  };

  const salvar = async () => {
    if (!doc) return;
    if (itens.length === 0) {
      toast.error("Coloque a assinatura ou o carimbo antes de salvar");
      return;
    }
    setSalvando(true);
    try {
      const { PDFDocument } = await import("pdf-lib");
      let pdf;
      if (doc.bytes) {
        pdf = await PDFDocument.load(doc.bytes.slice(0));
      } else {
        pdf = await PDFDocument.create();
        const dataUrl = doc.imagem!;
        const bin = await (await fetch(dataUrl)).arrayBuffer();
        const img = /^data:image\/png/i.test(dataUrl)
          ? await pdf.embedPng(bin)
          : await pdf.embedJpg(bin);
        const p = pdf.addPage([img.width, img.height]);
        p.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
      }

      const cache = new Map<string, Awaited<ReturnType<typeof pdf.embedPng>>>();
      for (const item of itens) {
        const url = selos[item.tipo];
        if (!url) continue;
        let img = cache.get(item.tipo);
        if (!img) {
          const bin = await (await fetch(url)).arrayBuffer();
          img = await pdf.embedPng(bin);
          cache.set(item.tipo, img);
        }
        const p = pdf.getPage(item.pagina);
        const { width, height } = p.getSize();
        const w = width * item.largura;
        const h = w / item.prop;
        p.drawImage(img, { x: width * item.x, y: height * (1 - item.y) - h, width: w, height: h });
      }

      const bytes = await pdf.save();
      const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nomeAssinado(doc.nome);
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      toast.success("PDF assinado gerado");
    } catch {
      toast.error("Não foi possível gerar o PDF assinado");
    } finally {
      setSalvando(false);
    }
  };

  const atual = doc?.paginas[pagina];
  const itensDaPagina = itens.filter((i) => i.pagina === pagina);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-5">
      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="font-display text-base font-semibold text-foreground">
          Minha assinatura e carimbo
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Ficam guardados neste aparelho até você trocar, e vão no backup e na sincronização.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {(["assinatura", "carimbo"] as TipoSelo[]).map((tipo) => (
            <div key={tipo} className="rounded-xl border border-border p-2 text-center">
              <p className="text-xs font-semibold text-foreground">{ROTULO[tipo]}</p>
              <div className="mt-2 flex h-20 items-center justify-center rounded-lg bg-secondary/40">
                {selos[tipo] ? (
                  <img
                    src={selos[tipo]!}
                    alt={ROTULO[tipo]}
                    className="max-h-20 max-w-full object-contain"
                  />
                ) : (
                  <span className="text-[11px] text-muted-foreground">nada salvo</span>
                )}
              </div>
              <div className="mt-2 flex justify-center gap-2">
                <label className="cursor-pointer rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground hover:bg-secondary/70">
                  {selos[tipo] ? "Trocar" : "Subir"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      void subirSelo(tipo, e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
                {selos[tipo] && (
                  <button
                    type="button"
                    onClick={() => gravarSelo(tipo, null)}
                    className="rounded-lg border border-border px-2 py-1.5 text-xs text-muted-foreground hover:bg-secondary"
                    aria-label={`Apagar ${ROTULO[tipo]}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="font-display text-base font-semibold text-foreground">
          Assinar um documento
        </h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="cursor-pointer rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
            Escolher arquivo
            <input
              type="file"
              accept="application/pdf,image/*"
              className="hidden"
              onChange={(e) => {
                void abrirDocumento(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          {doc && <span className="text-xs text-muted-foreground">{doc.nome}</span>}
        </div>

        {carregando && <p className="mt-3 text-sm text-muted-foreground">Abrindo o arquivo…</p>}

        {doc && atual && (
          <>
            {doc.paginas.length > 1 && (
              <div className="mt-3 flex items-center justify-center gap-3 text-sm">
                <button
                  type="button"
                  onClick={() => setPagina((p) => Math.max(0, p - 1))}
                  disabled={pagina === 0}
                  className="rounded-lg border border-border p-1.5 disabled:opacity-40"
                  aria-label="Página anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-muted-foreground">
                  página {pagina + 1} de {doc.paginas.length}
                </span>
                <button
                  type="button"
                  onClick={() => setPagina((p) => Math.min(doc.paginas.length - 1, p + 1))}
                  disabled={pagina >= doc.paginas.length - 1}
                  className="rounded-lg border border-border p-1.5 disabled:opacity-40"
                  aria-label="Próxima página"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}

            <div
              ref={areaRef}
              className="relative mx-auto mt-3 w-full touch-none select-none overflow-hidden rounded-lg border border-border bg-white"
              style={{ aspectRatio: `${atual.largura} / ${atual.altura}` }}
            >
              <img src={atual.imagem} alt="Documento" className="h-full w-full object-contain" />
              {itensDaPagina.map((item) => (
                <div
                  key={item.id}
                  onPointerDown={(e) => iniciarGesto(e, item.id, "mover")}
                  className="absolute cursor-move rounded border border-dashed border-primary/60"
                  style={{
                    left: `${item.x * 100}%`,
                    top: `${item.y * 100}%`,
                    width: `${item.largura * 100}%`,
                  }}
                >
                  <img
                    src={selos[item.tipo] ?? ""}
                    alt={ROTULO[item.tipo]}
                    className="pointer-events-none w-full"
                  />
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => setItens((a) => a.filter((i) => i.id !== item.id))}
                    className="absolute -left-2 -top-2 rounded-full bg-destructive p-0.5 text-destructive-foreground"
                    aria-label="Remover"
                  >
                    <X className="h-3 w-3" />
                  </button>
                  <span
                    onPointerDown={(e) => iniciarGesto(e, item.id, "tamanho")}
                    className="absolute -bottom-2 -right-2 h-5 w-5 cursor-se-resize rounded-full border border-border bg-primary"
                    aria-label="Ajustar tamanho"
                  />
                </div>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void adicionar("assinatura")}
                className="rounded-xl bg-secondary px-3 py-2 text-sm font-semibold text-secondary-foreground hover:bg-secondary/70"
              >
                + Assinatura
              </button>
              <button
                type="button"
                onClick={() => void adicionar("carimbo")}
                className="rounded-xl bg-secondary px-3 py-2 text-sm font-semibold text-secondary-foreground hover:bg-secondary/70"
              >
                + Carimbo
              </button>
              <button
                type="button"
                onClick={() => void salvar()}
                disabled={salvando}
                className="ml-auto rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {salvando ? "Gerando…" : "Salvar PDF assinado"}
              </button>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Salva como “{nomeAssinado(doc.nome)}”. Tudo acontece neste aparelho, sem internet.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
