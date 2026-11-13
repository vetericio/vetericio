import { supabaseBanco } from "@/integrations/supabase/client";

export type TipoSelo = "assinatura" | "carimbo";

async function usuarioDosSelos() {
  const { data, error } = await supabaseBanco.auth.getSession();
  if (error || !data.session) throw new Error("Entre novamente para acessar sua assinatura e seu carimbo.");
  return data.session.user.id;
}

export async function lerSelos() {
  const userId = await usuarioDosSelos();
  const { data, error } = await supabaseBanco.from("oricse_selos_profissionais")
    .select("assinatura,carimbo").eq("user_id", userId).maybeSingle();
  if (error) throw new Error("Não foi possível carregar a assinatura e o carimbo do seu perfil.");
  return data ?? { assinatura: null, carimbo: null };
}

export async function gravarSelo(tipo: TipoSelo, dataUrl: string | null) {
  const userId = await usuarioDosSelos();
  if (dataUrl && (!dataUrl.startsWith("data:image/png;base64,") || dataUrl.length > 6_000_000)) {
    throw new Error("Use uma imagem menor para a assinatura ou o carimbo.");
  }
  const selo = tipo === "assinatura"
    ? { user_id: userId, assinatura: dataUrl }
    : { user_id: userId, carimbo: dataUrl };
  const { error } = await supabaseBanco.from("oricse_selos_profissionais").upsert(selo);
  if (error) throw new Error("Não foi possível salvar a alteração no seu perfil.");
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

/** "contrato.pdf" -> "contrato (assinado oricse).pdf" */
export function nomeAssinado(nomeArquivo: string): string {
  const base = nomeArquivo.replace(/\.[^.]+$/, "") || "documento";
  return `${base} (assinado oricse).pdf`;
}
