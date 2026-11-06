import { supabase } from "@/integrations/supabase/client";
import { registerMedia } from "@/lib/posts.functions";

// Browser-side media preparation: Instagram only takes JPEG images (max 1440 px wide, 8 MB),
// feed images between 4:5 and 1.91:1, and MP4/MOV videos within each format's limits.

export type PostTipo = "imagem" | "carrossel" | "reels" | "story";

export const LIMITES = {
  imagemMaxLargura: 1440,
  imagemMaxBytes: 8 * 1024 * 1024,
  feedProporcaoMin: 4 / 5,
  feedProporcaoMax: 1.91,
  reelsMaxBytes: 300 * 1024 * 1024,
  reelsDuracao: [3, 15 * 60] as const,
  storyVideoMaxBytes: 100 * 1024 * 1024,
  storyDuracao: [3, 60] as const,
};

async function toJpeg(
  file: File,
  story: boolean,
): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const ratio = bitmap.width / bitmap.height;
  if (
    !story &&
    (ratio < LIMITES.feedProporcaoMin - 0.01 || ratio > LIMITES.feedProporcaoMax + 0.01)
  ) {
    bitmap.close();
    throw new Error(
      `A imagem tem proporção ${bitmap.width}×${bitmap.height}. No feed, o Instagram aceita de 4:5 (vertical) a 1,91:1 (horizontal). Recorte a imagem antes de enviar.`,
    );
  }
  const scale = Math.min(1, LIMITES.imagemMaxLargura / bitmap.width);
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff"; // PNG transparency would turn black in JPEG
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  for (const quality of [0.92, 0.85, 0.75]) {
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", quality));
    if (blob && blob.size <= LIMITES.imagemMaxBytes) return { blob, width, height };
  }
  throw new Error("A imagem continua acima de 8 MB mesmo comprimida.");
}

function probeVideo(file: File): Promise<{ duration: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      resolve({ duration: v.duration, width: v.videoWidth, height: v.videoHeight });
      URL.revokeObjectURL(url);
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível ler este vídeo. Use MP4 (H.264) ou MOV."));
    };
    v.src = url;
  });
}

/** Validates, converts and uploads one file for the given post type. Returns the registered asset. */
export async function uploadMedia(
  file: File,
  accountId: string,
  tipo: PostTipo,
  finalidade: "midia" | "capa" | "biblioteca" = "midia",
) {
  // Library uploads are validated against the format only when a post uses them.
  const livre = finalidade === "biblioteca";
  const isVideo = file.type.startsWith("video/");
  const isImage = file.type.startsWith("image/");
  if (!isVideo && !isImage) throw new Error(`"${file.name}" não é imagem nem vídeo.`);
  if (isVideo && finalidade === "capa") throw new Error("A capa do Reels precisa ser uma imagem.");
  if (isVideo && tipo === "imagem")
    throw new Error("Para vídeo, escolha o formato Reels, Carrossel ou Story.");
  if (isImage && tipo === "reels" && finalidade === "midia")
    throw new Error("Reels precisa de um vídeo.");

  let blob: Blob = file;
  let mime: "image/jpeg" | "video/mp4" | "video/quicktime";
  let ext: "jpg" | "mp4" | "mov";
  let largura: number | null = null;
  let altura: number | null = null;
  let duracao: number | null = null;

  if (isImage) {
    const out = await toJpeg(file, livre || tipo === "story" || finalidade === "capa");
    blob = out.blob;
    largura = out.width;
    altura = out.height;
    mime = "image/jpeg";
    ext = "jpg";
  } else {
    if (file.type !== "video/mp4" && file.type !== "video/quicktime")
      throw new Error("Use vídeo MP4 ou MOV.");
    mime = file.type;
    ext = file.type === "video/mp4" ? "mp4" : "mov";
    const meta = await probeVideo(file);
    largura = meta.width || null;
    altura = meta.height || null;
    duracao = Number.isFinite(meta.duration) ? Math.round(meta.duration * 10) / 10 : null;
    const [min, max] = tipo === "story" && !livre ? LIMITES.storyDuracao : LIMITES.reelsDuracao;
    if (duracao !== null && (duracao < min || duracao > max)) {
      throw new Error(
        `O vídeo tem ${duracao}s. Para ${tipo === "story" ? "Story" : "Reels/vídeo"} a duração deve ficar entre ${min}s e ${max}s.`,
      );
    }
    const maxBytes = tipo === "story" && !livre ? LIMITES.storyVideoMaxBytes : LIMITES.reelsMaxBytes;
    if (file.size > maxBytes)
      throw new Error(
        `O vídeo tem ${Math.round(file.size / 1048576)} MB; o limite é ${Math.round(maxBytes / 1048576)} MB. Exporte uma versão menor.`,
      );
  }

  const month = new Date().toISOString().slice(0, 7);
  const path = `uploads/${accountId}/${month}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("midia")
    .upload(path, blob, { contentType: mime, upsert: false });
  if (error) {
    throw new Error(
      /size|large|exceed/i.test(error.message)
        ? "O arquivo passou do limite de tamanho do armazenamento. Exporte uma versão menor."
        : `Falha no envio: ${error.message}`,
    );
  }
  return registerMedia({
    data: {
      instagram_account_id: accountId,
      storage_path: path,
      tipo: isImage ? "imagem" : "video",
      mime,
      tamanho_bytes: blob.size,
      largura,
      altura,
      duracao_s: duracao,
      nome_original: file.name.slice(0, 255),
    },
  });
}

export function contarHashtags(texto: string) {
  return (texto.match(/#[\p{L}\p{N}_]+/gu) ?? []).length;
}

export function contarMencoes(texto: string) {
  // An "@" inside a word (e-mail addresses) is not a mention.
  return (texto.match(/(?<![\w.])@[\w.]+/g) ?? []).length;
}

/** "2026-10-27T19:00" in the browser's time zone, for <input type="datetime-local">. */
export function toLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
