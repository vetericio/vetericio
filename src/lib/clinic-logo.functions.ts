import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  accessToken: z.string().min(20),
  clinicaId: z.string().uuid(),
  fileName: z.string().min(1).max(180),
  mimeType: z.enum(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]),
  base64: z.string().min(20),
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

    const [{ data: usuario }, { data: vinculo }] = await Promise.all([
      supabaseAdmin.from("app_users").select("role").eq("user_id", autenticacao.user.id).maybeSingle(),
      supabaseAdmin
        .from("clinica_usuarios")
        .select("papel")
        .eq("user_id", autenticacao.user.id)
        .eq("clinica_id", data.clinicaId)
        .eq("ativo", true)
        .maybeSingle(),
    ]);
    const podeEditar =
      usuario?.role === "admin" ||
      ["responsavel", "admin_clinica", "rt"].includes(vinculo?.papel || "");
    if (!podeEditar)
      throw new Error("Somente o responsável, RT ou administrador da plataforma pode alterar a logo desta clínica.");

    const bytes = Buffer.from(data.base64.replace(/^data:[^;]+;base64,/, ""), "base64");
    if (!bytes.length || bytes.length > MAX_BYTES)
      throw new Error("A imagem deve ter no máximo 5 MB.");

    // Arquivos públicos de clínicas pertencem ao Drive (pasta Imagens),
    // inclusive fotos de profissionais e banners do site. O Supabase é
    // reservado à identidade e aos vínculos dos usuários.
    const { enviarArquivoDrive } = await import("@/lib/drive.functions");
    const nome = `${data.categoria}-${Date.now()}-${nomeSeguro(data.fileName, data.mimeType)}`;
    const upload = await enviarArquivoDrive({
      data: {
        accessToken: data.accessToken,
        clinicaId: data.clinicaId,
        categoria: "imagens",
        nome,
        mimeType: data.mimeType,
        base64: data.base64,
        visibilidade: "publico",
        entidadeTipo: "site-clinica",
        entidadeId: data.categoria,
      },
    });
    const caminho = upload.arquivo.driveId;
    if (!/^[a-zA-Z0-9_-]{12,160}$/.test(caminho) || !upload.arquivo.publicUrl) {
      throw new Error("Foto enviada, mas não foi possível disponibilizá-la publicamente.");
    }
    // A URL de visualização do Drive pode servir HTML em vez de pixels.
    // O endereço ORICSE transmite apenas fotos públicas verificadas.
    const logoUrl = `https://oricse.com.br/api/public/clinic-image?file=${encodeURIComponent(caminho)}`;
    if (data.categoria === "logo") {
      const { error: erroClinica } = await supabaseAdmin
        .from("clinicas")
        .update({ logo_url: logoUrl, updated_at: new Date().toISOString() })
        .eq("id", data.clinicaId);
      if (erroClinica)
        throw new Error("Logo enviada, mas não foi possível vinculá-la à clínica.");
    }

    return { ok: true, logoUrl, caminho };
  });
