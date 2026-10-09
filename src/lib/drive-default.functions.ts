import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  accessToken: z.string().min(20),
  clinicaId: z.string().uuid(),
});

async function accessTokenGoogle(): Promise<string> {
  const clientId = process.env["GOOGLE_DRIVE_CLIENT_ID"];
  const clientSecret = process.env["GOOGLE_DRIVE_CLIENT_SECRET"];
  const refreshToken = process.env["GOOGLE_DRIVE_REFRESH_TOKEN"];
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Google Drive da Oricse ainda não está configurado.");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const json = (await response.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!response.ok || !json.access_token) {
    throw new Error(json.error_description || json.error || "Não foi possível autenticar o Google Drive da Oricse.");
  }
  return json.access_token;
}

function limparSlug(valor: string | null | undefined) {
  return String(valor || "").replace(/@/g, "").trim().toLowerCase();
}

async function buscarOuCriarPasta(token: string, parentId: string, nome: string): Promise<string> {
  const escaped = nome.replace(/'/g, "\\'");
  const q = encodeURIComponent(
    `'${parentId}' in parents and name='${escaped}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
  );
  const list = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=10`,
    { headers: { authorization: `Bearer ${token}` } },
  );
  if (!list.ok) throw new Error(`Google Drive: ${list.status} ${await list.text()}`);
  const listJson = (await list.json()) as { files?: Array<{ id: string; name: string }> };
  const existente = listJson.files?.find((arquivo) => arquivo.name === nome);
  if (existente?.id) return existente.id;

  const create = await fetch("https://www.googleapis.com/drive/v3/files?fields=id", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      name: nome,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    }),
  });
  if (!create.ok) throw new Error(`Google Drive: ${create.status} ${await create.text()}`);
  const json = (await create.json()) as { id: string };
  return json.id;
}

export const garantirPastaOricse = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (authError || !authData.user) throw new Error("Sessão inválida ou expirada.");

    const userId = authData.user.id;
    const { data: plataformaUser } = await supabaseAdmin
      .from("app_users")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    if (plataformaUser?.role !== "admin") {
      const { data: vinculo } = await supabaseAdmin
        .from("clinica_usuarios")
        .select("ativo")
        .eq("clinica_id", data.clinicaId)
        .eq("user_id", userId)
        .eq("ativo", true)
        .maybeSingle();
      if (!vinculo) throw new Error("Você não tem acesso a esta clínica.");
    }

    const [{ data: clinica, error: clinicaError }, { data: config, error: configError }] = await Promise.all([
      supabaseAdmin.from("clinicas").select("nome,slug").eq("id", data.clinicaId).single(),
      supabaseAdmin.from("drive_plataforma_config").select("clinicas_folder_id").eq("id", 1).single(),
    ]);

    if (clinicaError || !clinica) throw new Error("Clínica não encontrada.");
    if (configError || !config?.clinicas_folder_id) throw new Error("Pasta central de clínicas da Oricse não está configurada.");

    const slug = limparSlug(clinica.slug);
    const nomePasta = slug ? `${clinica.nome} (@${slug})` : clinica.nome;
    const token = await accessTokenGoogle();
    const folderId = await buscarOuCriarPasta(token, config.clinicas_folder_id, nomePasta);
    const folderUrl = `https://drive.google.com/drive/folders/${folderId}`;

    const { error: salvarError } = await supabaseAdmin.from("clinica_drive_config").upsert({
      clinica_id: data.clinicaId,
      modo: "oricse",
      root_folder_id: folderId,
      root_folder_url: folderUrl,
      status: "conectado",
      verificado_em: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    if (salvarError) throw new Error(`Pasta criada, mas não foi possível salvar a configuração: ${salvarError.message}`);

    return { ok: true, folderId, folderUrl, nomePasta };
  });
