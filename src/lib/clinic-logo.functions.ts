import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { exigirPermissaoClinica } from "@/lib/permissao-clinica.server";
import { normalizeClinicMediaUrl } from "@/lib/clinic-site";
import { isClinicLogoPreview, MAX_CLINIC_LOGO_PREVIEW_LENGTH, storedClinicLogoPreview } from "@/lib/clinic-logo-preview";

import { excluirArquivoDrive, enviarArquivoDrive } from "@/lib/drive.functions";
const inputSchema = z.object({
  accessToken: z.string().min(20),
  clinicaId: z.string().uuid(),
  fileName: z.string().min(1).max(180),
  mimeType: z.enum(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]),
  base64: z.string().min(20),
  preview: z.string().max(MAX_CLINIC_LOGO_PREVIEW_LENGTH).optional(),
  categoria: z.enum(["logo", "site"]).default("logo"),
});
const MAX_BYTES = 5 * 1024 * 1024;

function nomeSeguro(nome: string, mime: string) {
  const ext =
    mime === "image/png" ? ".png" :
    mime === "image/jpeg" ? ".jpg" :
    mime === "image/webp" ? ".webp" : ".svg";
  const limpo = nome
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 140);
  return /\.(png|jpe?g|webp|svg)$/i.test(limpo) ? limpo : `${limpo || "logo"}${ext}`;
}

export const enviarLogoClinica = createServerFn({ method: "POST" })
  .validator((i: unknown) => inputSchema.parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: autenticacao, error: erroAutenticacao } =
      await supabaseAdmin.auth.getUser(data.accessToken);
    if (erroAutenticacao || !autenticacao.user)
      throw new Error("Sessão inválida ou expirada. Entre novamente e tente enviar a logo.");

    await exigirPermissaoClinica(
      supabaseAdmin, autenticacao.user.id, data.clinicaId, ["administracao.site"], data.accessToken,
      { permitirBloqueadaParaAdmin: data.categoria === "logo" },
    );

    const bytes = Buffer.from(data.base64.replace(/^data:[^;]+;base64,/, ""), "base64");
    if (!bytes.length || bytes.length > MAX_BYTES)
      throw new Error("A imagem deve ter no máximo 5 MB.");
    const preview = isClinicLogoPreview(data.preview) ? data.preview : null;
    if (data.categoria === "logo" && !preview)
      throw new Error("Não foi possível validar a prévia da logo. Atualize a página e envie a imagem novamente.");

    const caminho = `${Date.now()}-${nomeSeguro(data.fileName, data.mimeType)}`;
    const upload = await enviarArquivoDrive({
      data: {
        accessToken: data.accessToken,
        clinicaId: data.clinicaId,
        categoria: "identidade",
        nome: caminho,
        mimeType: data.mimeType,
        base64: data.base64,
        visibilidade: "publico",
        entidadeTipo: "branding_clinica",
        entidadeId: data.clinicaId,
        metadata: { categoria: data.categoria },
      },
    });
    const logoUrl = normalizeClinicMediaUrl(upload.arquivo.publicUrl);
    if (!logoUrl) throw new Error("Não foi possível gerar o endereço público da logo.");
    if (data.categoria === "logo") {
      const { data: clinicaAtualizada, error: erroClinica } = await supabaseAdmin
        .from("clinicas")
        .update({ logo_url: logoUrl, logo_previa: { origem: logoUrl, imagem: preview }, updated_at: new Date().toISOString() })
        .eq("id", data.clinicaId)
        .is("excluido_em", null)
        .select("id,logo_previa")
        .maybeSingle();
      if (erroClinica || !clinicaAtualizada) {
        try {
          await excluirArquivoDrive({
            data: {
              accessToken: data.accessToken,
              clinicaId: data.clinicaId,
              registroId: upload.registroId,
            },
          });
        } catch {
          // Preserve a falha original; a limpeza poderá ser repetida pela equipe.
        }
        throw new Error("Não foi possível vincular a logo à clínica.");
      }
      if (storedClinicLogoPreview(clinicaAtualizada.logo_previa, logoUrl) !== preview) {
        throw new Error("A logo foi vinculada, mas a prévia não pôde ser confirmada.");
      }
    }

    return { ok: true, logoUrl, preview, caminho: upload.registroId };
  });
