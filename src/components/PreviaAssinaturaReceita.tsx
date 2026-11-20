import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type PointerEvent,
  type SetStateAction,
} from "react";
import { X } from "lucide-react";
import type { TipoSelo } from "@/lib/assinatura";
import {
  caixaSeloReceituario,
  prepararPreviaRodapeReceituario,
  type PosicaoSeloReceituario,
} from "@/lib/receituario";

type Posicoes = Partial<Record<TipoSelo, PosicaoSeloReceituario>>;
type Dimensoes = { largura: number; altura: number };

export function PreviaAssinaturaReceita({
  dados,
  selos,
  posicoes,
  setPosicoes,
}: {
  dados: Parameters<typeof prepararPreviaRodapeReceituario>[0];
  selos: Record<TipoSelo, string | null>;
  posicoes: Posicoes;
  setPosicoes: Dispatch<SetStateAction<Posicoes>>;
}) {
  const [layout, setLayout] =
    useState<Awaited<ReturnType<typeof prepararPreviaRodapeReceituario>>>();
  const [dimensoes, setDimensoes] = useState<Partial<Record<TipoSelo, Dimensoes>>>({});
  const areaRef = useRef<HTMLDivElement>(null);
  const gesto = useRef<{
    id: number;
    tipo: TipoSelo;
    modo: "mover" | "tamanho";
    inicial: PosicaoSeloReceituario;
    x: number;
    y: number;
    larguraArea: number;
    alturaArea: number;
  }>(null);

  useEffect(() => {
    let ativo = true;
    void prepararPreviaRodapeReceituario(dados).then(
      (resultado) => {
        if (ativo) setLayout(resultado);
      },
      () => {
        if (ativo) setLayout(undefined);
      },
    );
    return () => {
      ativo = false;
    };
  }, [dados]);

  useEffect(() => {
    let ativo = true;
    void Promise.all(
      (["assinatura", "carimbo"] as const).map(async (tipo) => {
        const src = selos[tipo];
        if (!src) return [tipo, undefined] as const;
        const imagem = new Image();
        imagem.src = src;
        try {
          await imagem.decode();
          return [tipo, { largura: imagem.naturalWidth, altura: imagem.naturalHeight }] as const;
        } catch {
          return [tipo, undefined] as const;
        }
      }),
    ).then((medidas) => {
      if (ativo) setDimensoes(Object.fromEntries(medidas));
    });
    return () => {
      ativo = false;
    };
  }, [selos]);

  function iniciar(evento: PointerEvent<HTMLElement>, tipo: TipoSelo, modo: "mover" | "tamanho") {
    const inicial = posicoes[tipo];
    const area = areaRef.current?.getBoundingClientRect();
    if (!inicial || !area || evento.button !== 0 || gesto.current) return;
    evento.preventDefault();
    evento.stopPropagation();
    evento.currentTarget.setPointerCapture(evento.pointerId);
    gesto.current = {
      id: evento.pointerId,
      tipo,
      modo,
      inicial,
      x: evento.clientX,
      y: evento.clientY,
      larguraArea: area.width,
      alturaArea: area.height,
    };
  }

  function mover(evento: PointerEvent) {
    const atual = gesto.current;
    if (!atual || atual.id !== evento.pointerId) return;
    const { inicial, tipo } = atual;
    const dx = (evento.clientX - atual.x) / atual.larguraArea;
    const dy = (evento.clientY - atual.y) / atual.alturaArea;
    const largura =
      atual.modo === "tamanho"
        ? Math.min(0.9, Math.max(0.08, inicial.largura + dx))
        : inicial.largura;
    const candidato = {
      largura,
      x: Math.max(0, inicial.x + (atual.modo === "mover" ? dx : 0)),
      y: Math.max(0, inicial.y + (atual.modo === "mover" ? dy : 0)),
    };
    const tamanho = dimensoes[tipo];
    if (!tamanho) return;
    const caixa = caixaSeloReceituario(candidato, tamanho, atual.larguraArea, atual.alturaArea);
    setPosicoes((anterior) => ({
      ...anterior, [tipo]: {
        x: caixa.x / atual.larguraArea,
        y: caixa.y / atual.alturaArea,
        largura,
      },
    }));
  }

  function terminar(evento: PointerEvent) {
    if (gesto.current?.id === evento.pointerId) gesto.current = null;
  }

  if (!layout)
    return <p className="mt-3 text-xs text-muted-foreground">Carregando a prévia da assinatura.</p>;

  const { areaSelos: area, larguraPagina, topo, fim, centro, linhaY, textos } = layout;
  const alturaPrevia = fim - topo;
  return (
    <div
      className="relative mt-3 rounded-xl bg-white text-black ring-1 ring-inset ring-border"
      style={{ aspectRatio: larguraPagina / alturaPrevia }}
    >
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox={`0 ${topo} ${larguraPagina} ${alturaPrevia}`}
        role="img"
        aria-label="Prévia do rodapé da receita"
        fontFamily="Arial, Helvetica, sans-serif"
      >
        <line
          x1={centro - 80}
          x2={centro + 80}
          y1={linhaY}
          y2={linhaY}
          stroke="#5a5a5a"
          strokeWidth={0.5}
        />
        {textos.map((texto, indice) => (
          <text
            key={indice}
            x={texto.x}
            y={texto.y}
            fontSize={texto.tamanho}
            textLength={texto.largura}
            lengthAdjust="spacingAndGlyphs"
            textAnchor={texto.alinhamento === "right" ? "end" : "middle"}
          >
            {texto.valor}
          </text>
        ))}
      </svg>
      <div
        ref={areaRef}
        className="absolute select-none"
        style={{
          left: `${(area.x / larguraPagina) * 100}%`,
          top: `${((area.y - topo) / alturaPrevia) * 100}%`,
          width: `${(area.largura / larguraPagina) * 100}%`,
          height: `${(area.altura / alturaPrevia) * 100}%`,
        }}
        onPointerMove={mover}
        onLostPointerCapture={terminar}
      >
        {(["assinatura", "carimbo"] as const).map((tipo) => {
          const selo = selos[tipo];
          const posicao = posicoes[tipo];
          const tamanho = dimensoes[tipo];
          if (!selo || !posicao || !tamanho) return null;
          const caixa = caixaSeloReceituario(posicao, tamanho, area.largura, area.altura);
          return (
            <div
              key={tipo}
              onPointerDown={(evento) => iniciar(evento, tipo, "mover")}
              className="absolute cursor-move touch-none outline outline-1 outline-dashed outline-primary/60"
              style={{
                left: `${(caixa.x / area.largura) * 100}%`,
                top: `${(caixa.y / area.altura) * 100}%`,
                width: `${(caixa.largura / area.largura) * 100}%`,
                height: `${(caixa.altura / area.altura) * 100}%`,
              }}
            >
              <img
                src={selo}
                alt={tipo === "assinatura" ? "Assinatura" : "Carimbo"}
                draggable={false}
                className="pointer-events-none h-full w-full"
              />
              <button
                type="button"
                onPointerDown={(evento) => evento.stopPropagation()}
                onClick={() => setPosicoes((atual) => ({ ...atual, [tipo]: undefined }))}
                className="absolute -left-2 -top-2 rounded-full bg-destructive p-0.5 text-destructive-foreground"
                aria-label={`Remover ${tipo}`}
              >
                <X className="h-3 w-3" />
              </button>
              <span
                onPointerDown={(evento) => iniciar(evento, tipo, "tamanho")}
                title={`Redimensionar ${tipo}`}
                className="absolute -bottom-2 -right-2 h-4 w-4 cursor-se-resize rounded-full border border-white bg-primary"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
