/**
 * Assinatura e carimbo guardados no próprio aparelho (data URL PNG).
 * Entram no backup e na sincronização como itens simples.
 */
export const CHAVE_ASSINATURA = "veterico-assinatura-v1";
export const CHAVE_CARIMBO = "veterico-carimbo-v1";

export type TipoSelo = "assinatura" | "carimbo";

export const CHAVE_SELO: Record<TipoSelo, string> = {
  assinatura: CHAVE_ASSINATURA,
  carimbo: CHAVE_CARIMBO,
};

export function lerSelo(tipo: TipoSelo): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(CHAVE_SELO[tipo]);
  } catch {
    return null;
  }
}

export function gravarSelo(tipo: TipoSelo, dataUrl: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (dataUrl) window.localStorage.setItem(CHAVE_SELO[tipo], dataUrl);
    else window.localStorage.removeItem(CHAVE_SELO[tipo]);
  } catch {
    /* armazenamento indisponível */
  }
  window.dispatchEvent(new Event("veterico-selos"));
}

/** Lê o arquivo escolhido como data URL. */
export function lerArquivoComoDataUrl(arquivo: File): Promise<string> {
  return new Promise((ok, erro) => {
    const leitor = new FileReader();
    leitor.onload = () => ok(String(leitor.result));
    leitor.onerror = () => erro(new Error("Não foi possível ler o arquivo"));
    leitor.readAsDataURL(arquivo);
  });
}

function carregarImagem(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, erro) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => erro(new Error("Imagem inválida"));
    img.src = src;
  });
}

/**
 * Deixa o fundo claro transparente e recorta as sobras em volta.
 * Tudo feito no aparelho, com canvas.
 */
export async function removerFundoBranco(dataUrl: string, limiar = 235): Promise<string> {
  const img = await carregarImagem(dataUrl);
  const largura = Math.min(img.naturalWidth, 1600);
  const escala = largura / img.naturalWidth;
  const altura = Math.round(img.naturalHeight * escala);

  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, largura, altura);

  const dados = ctx.getImageData(0, 0, largura, altura);
  const p = dados.data;
  let minX = largura;
  let minY = altura;
  let maxX = -1;
  let maxY = -1;

  for (let i = 0; i < p.length; i += 4) {
    const r = p[i]!;
    const g = p[i + 1]!;
    const b = p[i + 2]!;
    const claro = (r + g + b) / 3;
    if (claro >= limiar) {
      p[i + 3] = 0;
      continue;
    }
    // Transição suave nas bordas do traço.
    if (claro > limiar - 30) p[i + 3] = Math.round(((limiar - claro) / 30) * 255);
    const idx = i / 4;
    const x = idx % largura;
    const y = Math.floor(idx / largura);
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  ctx.putImageData(dados, 0, 0);

  if (maxX < 0) return canvas.toDataURL("image/png");

  const folga = 4;
  const cx = Math.max(0, minX - folga);
  const cy = Math.max(0, minY - folga);
  const cw = Math.min(largura - cx, maxX - minX + folga * 2);
  const ch = Math.min(altura - cy, maxY - minY + folga * 2);

  const recorte = document.createElement("canvas");
  recorte.width = cw;
  recorte.height = ch;
  const ctx2 = recorte.getContext("2d");
  if (!ctx2) return canvas.toDataURL("image/png");
  ctx2.drawImage(canvas, cx, cy, cw, ch, 0, 0, cw, ch);
  return recorte.toDataURL("image/png");
}

/** Proporção largura/altura de uma imagem em data URL. */
export async function proporcao(dataUrl: string): Promise<number> {
  const img = await carregarImagem(dataUrl);
  return img.naturalWidth / (img.naturalHeight || 1);
}

/** "contrato.pdf" -> "contrato (assinado vetericio).pdf" */
export function nomeAssinado(nomeArquivo: string): string {
  const base = nomeArquivo.replace(/\.[^.]+$/, "") || "documento";
  return `${base} (assinado vetericio).pdf`;
}
