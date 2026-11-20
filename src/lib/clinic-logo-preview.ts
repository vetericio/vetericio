const PNG_DATA_PREFIX = "data:image/png;base64,";
export const MAX_CLINIC_LOGO_PREVIEW_LENGTH = 120_000;
const MAX_PREVIEW_SIZE = 256;

export function isClinicLogoPreview(value: unknown): value is string {
  if (typeof value !== "string" || value.length > MAX_CLINIC_LOGO_PREVIEW_LENGTH ||
      !value.startsWith(PNG_DATA_PREFIX)) return false;
  const encoded = value.slice(PNG_DATA_PREFIX.length);
  if (encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) return false;

  const header = atob(encoded.slice(0, 32));
  if (header.length < 24 || header.slice(0, 8) !== "\x89PNG\r\n\x1a\n" ||
      header.slice(12, 16) !== "IHDR") return false;
  if (!atob(encoded.slice(-20)).endsWith("\x00\x00\x00\x00IEND\xaeB\x60\x82")) return false;
  const bytes = new Uint8Array(8);
  for (let i = 0; i < bytes.length; i++) bytes[i] = header.charCodeAt(i + 16);
  const dimensions = new DataView(bytes.buffer);
  return [dimensions.getUint32(0), dimensions.getUint32(4)]
    .every(size => size >= 1 && size <= MAX_PREVIEW_SIZE);
}

export function storedClinicLogoPreview(value: unknown, source: string): string | null {
  if (!value || typeof value !== "object" || !("origem" in value) || !("imagem" in value)) return null;
  return value.origem === source && isClinicLogoPreview(value.imagem) ? value.imagem : null;
}

export async function createClinicLogoPreview(dataUrl: string): Promise<string> {
  const image = new Image();
  image.src = dataUrl;
  try {
    await image.decode();
  } catch {
    throw new Error("Não foi possível abrir a imagem da logo. Confira o arquivo e tente novamente.");
  }
  if (!image.naturalWidth || !image.naturalHeight) {
    throw new Error("A imagem da logo não tem dimensões válidas.");
  }

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("O navegador não conseguiu preparar a prévia da logo.");

  for (const limit of [MAX_PREVIEW_SIZE, 192, 128, 96]) {
    const scale = Math.min(1, limit / Math.max(image.naturalWidth, image.naturalHeight));
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const preview = canvas.toDataURL("image/png");
    if (isClinicLogoPreview(preview)) return preview;
  }

  throw new Error("Não foi possível preparar a prévia da logo. Tente uma imagem menor.");
}
