import { createFileRoute } from "@tanstack/react-router";

const DRIVE_ID = /^[a-zA-Z0-9_-]{12,160}$/;
const MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const IMAGE_MAX_BYTES = 5 * 1024 * 1024;

// Um link "uc?export=view" do Google Drive pode devolver HTML em vez de
// imagem ao navegador. Esta rota entrega a mídia pública diretamente,
// sem expor tokens do Google ou permitir acesso a arquivos particulares.
export const Route = createFileRoute("/api/public/clinic-image")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const id = new URL(request.url).searchParams.get("file") || "";
        const noStore = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
        if (!DRIVE_ID.test(id)) return new Response("Imagem inválida.", { status: 400, headers: noStore });
        try {
          const { accessTokenGoogle } = await import("@/lib/drive.functions");
          const accessToken = await accessTokenGoogle();
          const headers = { Authorization: `Bearer ${accessToken}` };
          const base = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}`;
          const info = await fetch(`${base}?fields=id,mimeType,size,trashed,appProperties`, {
            headers, signal: AbortSignal.timeout(15000),
          });
          if (!info.ok) return new Response("Imagem indisponível.", { status: 404, headers: noStore });
          const file = await info.json() as {
            mimeType?: string;
            size?: string;
            trashed?: boolean;
            appProperties?: Record<string, string>;
          };
          const props = file.appProperties || {};
          const size = Number(file.size || 0);
          if (
            file.trashed ||
            !MIME_TYPES.has(file.mimeType || "") ||
            !size || size > IMAGE_MAX_BYTES ||
            props.visibilidade !== "publico" ||
            props.categoria !== "imagens" ||
            props.entidadeTipo !== "site-clinica" ||
            !props.clinicaId
          ) {
            return new Response("Imagem não autorizada.", { status: 404, headers: noStore });
          }
          const media = await fetch(`${base}?alt=media`, {
            headers, signal: AbortSignal.timeout(20000),
          });
          if (!media.ok) return new Response("Imagem indisponível.", { status: 502, headers: noStore });
          const bytes = await media.arrayBuffer();
          if (bytes.byteLength > IMAGE_MAX_BYTES) {
            return new Response("Imagem muito grande.", { status: 502, headers: noStore });
          }
          return new Response(bytes, {
            headers: {
              "Content-Type": file.mimeType!,
              "Content-Length": String(bytes.byteLength),
              "Cache-Control": "public, max-age=3600, s-maxage=86400",
              "X-Content-Type-Options": "nosniff",
              "Content-Security-Policy": "default-src 'none'; sandbox",
            },
          });
        } catch {
          return new Response("Não foi possível carregar a imagem.", { status: 503, headers: noStore });
        }
      },
    },
  },
});
