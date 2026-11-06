import { createFileRoute } from "@tanstack/react-router";
import { authenticateAssistant, jsonError, resolveAccount } from "@/lib/server/assistant.server";

const MAX_BYTES = 100 * 1024 * 1024;
const TIPOS: Record<string, { tipo: "imagem" | "video"; ext: string }> = {
  "image/jpeg": { tipo: "imagem", ext: "jpg" },
  "video/mp4": { tipo: "video", ext: "mp4" },
  "video/quicktime": { tipo: "video", ext: "mov" },
};

// Uploads one file (raw body) for a managed account. Headers: X-Conta (@username or id), X-Arquivo (file name).
export const Route = createFileRoute("/api/public/assistente/media")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await authenticateAssistant(request);
        if (auth instanceof Response) return auth;
        const { admin, actor } = auth;
        try {
          const account = await resolveAccount(admin, request.headers.get("x-conta") ?? "");
          const mime = (request.headers.get("content-type") ?? "")
            .split(";")[0]!
            .trim()
            .toLowerCase();
          const kind = TIPOS[mime];
          if (!kind) throw new Error("Envie JPEG, MP4 ou MOV (converta PNG para JPEG antes).");
          if (Number(request.headers.get("content-length") ?? 0) > MAX_BYTES)
            throw new Error("Arquivo acima de 100 MB.");
          const body = await request.arrayBuffer();
          if (!body.byteLength || body.byteLength > MAX_BYTES)
            throw new Error("Arquivo vazio ou acima de 100 MB.");

          const month = new Date().toISOString().slice(0, 7);
          const storage_path = `uploads/${account.id}/${month}/${crypto.randomUUID()}.${kind.ext}`;
          const { error: upErr } = await admin.storage
            .from("midia")
            .upload(storage_path, body, { contentType: mime, upsert: false });
          if (upErr) throw new Error(`Falha ao guardar o arquivo: ${upErr.message}`);
          const public_url = admin.storage.from("midia").getPublicUrl(storage_path).data.publicUrl;
          const nome = decodeURIComponent(request.headers.get("x-arquivo") ?? "arquivo").slice(
            0,
            255,
          );
          const { data: row, error } = await admin
            .from("media_assets")
            .insert({
              instagram_account_id: account.id,
              storage_path,
              tipo: kind.tipo,
              mime,
              tamanho_bytes: body.byteLength,
              nome_original: nome,
              public_url,
            })
            .select("id, tipo, public_url, nome_original")
            .single();
          if (error || !row) throw new Error("Não foi possível registrar a mídia.");
          const { audit } = await import("@/lib/server/meta.server");
          await audit(admin, {
            user_email: actor.email,
            acao: "midia_enviada_assistente",
            alvo: row.id,
            detalhes: { conta: account.username, arquivo: nome, bytes: body.byteLength },
          });
          return Response.json({ ok: true, media: row });
        } catch (e) {
          return jsonError(e);
        }
      },
    },
  },
});
