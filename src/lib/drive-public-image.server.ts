import { driveAccessToken } from "./drive-kv.server";

const MAX_PUBLIC_IMAGE_BYTES = 12 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/gif", "image/avif"]);

type DrivePermission = { type?: string; role?: string; deleted?: boolean };
type DriveImage = {
  mimeType?: string;
  size?: string;
  trashed?: boolean;
  appProperties?: { visibilidade?: string };
  permissions?: DrivePermission[];
};

const publicReader = (permission: DrivePermission) =>
  permission.type === "anyone" && permission.role === "reader" && permission.deleted !== true;

function unavailable(status = 404) {
  return new Response(null, { status, headers: { "cache-control": "no-store" } });
}

export async function getPublicDriveImage(fileId: string, headOnly = false): Promise<Response> {
  if (!/^[A-Za-z0-9_-]{12,160}$/.test(fileId)) return unavailable();

  const fileUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`;
  try {
    const token = await driveAccessToken("https://www.googleapis.com/auth/drive.readonly");
    const signal = AbortSignal.timeout(8_000);
    const headers = { authorization: `Bearer ${token}` };
    const options = { headers, signal, redirect: "error" as const };
    const fields = "mimeType,size,trashed,appProperties,permissions(type,role,deleted)";
    const metadata = await fetch(`${fileUrl}?supportsAllDrives=true&fields=${encodeURIComponent(fields)}`, options);
    if (!metadata.ok) return unavailable(metadata.status === 403 || metadata.status === 404 ? 404 : 502);

    const info = await metadata.json() as DriveImage;
    const size = Number(info.size);
    const visibility = info.appProperties?.visibilidade;
    if (info.trashed || !info.mimeType || !IMAGE_TYPES.has(info.mimeType) ||
        !Number.isSafeInteger(size) || size <= 0 || size > MAX_PUBLIC_IMAGE_BYTES ||
        (visibility && visibility !== "publico")) return unavailable();

    let shared = info.permissions?.some(publicReader);
    if (shared === undefined) {
      // Drives compartilhados podem omitir as permissões de files.get.
      const permissionFields = "permissions(type,role,deleted)";
      const permissionList = await fetch(
        `${fileUrl}/permissions?supportsAllDrives=true&pageSize=100&fields=${encodeURIComponent(permissionFields)}`,
        options,
      );
      if (!permissionList.ok) return unavailable();
      const result = await permissionList.json() as { permissions?: DrivePermission[] };
      shared = result.permissions?.some(publicReader);
    }
    if (!shared) return unavailable();

    const imageHeaders = {
      "content-type": info.mimeType,
      "content-length": String(size),
      "cache-control": "private, max-age=300",
      "content-security-policy": "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:; frame-ancestors 'none'",
      "x-content-type-options": "nosniff",
    };
    if (headOnly) return new Response(null, { headers: imageHeaders });

    const image = await fetch(`${fileUrl}?alt=media&supportsAllDrives=true`, {
      ...options,
      headers: { ...headers, range: `bytes=0-${MAX_PUBLIC_IMAGE_BYTES}` },
    });
    if (!image.ok || !image.body) return unavailable(image.status === 403 || image.status === 404 ? 404 : 502);

    // O limite também vale se o arquivo mudar entre a leitura de metadados e a dos bytes.
    const reader = image.body.getReader();
    const bytes = new Uint8Array(size);
    let offset = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (offset + value.byteLength > size) {
        await reader.cancel();
        return unavailable(502);
      }
      bytes.set(value, offset);
      offset += value.byteLength;
    }
    return offset === size ? new Response(bytes, { headers: imageHeaders }) : unavailable(502);
  } catch {
    return unavailable(502);
  }
}
