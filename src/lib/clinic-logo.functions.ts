import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  accessToken: z.string().min(20),
  clinicaId: z.string().uuid(),
  fileName: z.string().min(1).max(180),
  mimeType: z.enum(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]),
  base64: z.string().min(20),
});

const MAX_BYTES = 5 * 1024 * 1024;

function base64Url(input: string | Buffer) {
  const buffer = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buffer.toString("base64url");
}

async function accessTokenServiceAccount(): Promise<string | null> {
  const email = process.env["GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL"];
  const privateKeyRaw = process.env["GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY"];
  if (!email || !privateKeyRaw) return null;

  const privateKey = privateKeyRaw.replace(/\\n/g, "\n");
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64Url(JSON.stringify({
    iss: email,
    scope: "https://www.googleapis.com/auth/drive",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${payload}`;
  const { createSign } = await import("node:crypto");
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const assertion = `${unsigned}.${base64Url(signer.sign(privateKey))}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  const json = (await response.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!response.ok || !json.access_token) {
    throw new Error(json.error_description || json.error || "Falha ao autenticar a conta de serviço do Google Drive.");
  }
  return json.access_token;
}

async function accessTokenOAuth(): Promise<string | null> {
  const clientId = process.env["GOOGLE_DRIVE_CLIENT_ID"];
  const clientSecret = process.env["GOOGLE_DRIVE_CLIENT_SECRET"];
  const refreshToken = process.env["GOOGLE_DRIVE_REFRESH_TOKEN"];
  if (!clientId || !clientSecret || !refreshToken) return null;

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

async function accessTokenGoogle(): Promise<string> {
  const serviceAccount = await accessTokenServiceAccount();
  if (serviceAccount) return serviceAccount;

  const oauthToken = await accessTokenOAuth();
  if (oauthToken) return oauthToken;

  throw new Error("Google Drive da Oricse ainda não está configurado.");
}

async function buscarOuCriarPasta(token: string, parentId: string, nome: string): Promise<string> {
  const escaped = nome.replace(/'/g, "\\'");
  const q = encodeURIComponent(`'${parentId}' in parents and name='${escaped}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  const list = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=10`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!list.ok) {
    const details = await list.text();
    if (list.status === 403 && /ACCESS_TOKEN_SCOPE_INSUFFICIENT|insufficient authentication scopes/i.test(details)) {
      throw new Error("A conexão central do Google Drive precisa ser autorizada novamente com permissão de arquivos. A imagem não foi enviada.");
    }
    throw new Error(`Google Drive: ${list.status} ${details}`);
  }
  const listJson = (await list.json()) as { files?: Array<{ id: string; name: string }> };
  const existente = listJson.files?.find((arquivo) => arquivo.name === nome);
  if (existente?.id) return existente.id;

  const create = await fetch("https://www.googleapis.com/drive/v3/files?fields=id", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ name: nome, mimeType: "application/vnd.google-apps.folder", parents: [parentId] }),
  });
  if (!create.ok) throw new Error(`Google Drive: ${create.status} ${await create.text()}`);
  const json = (await create.json()) as { id: string };
  return json.id;
}

function nomeSeguro(nome: string, mimeType: string) {
  const extPadrao = mimeType === "image/png" ? ".png" : mimeType === "image/jpeg" ? ".jpg" : mimeType === "image/webp" ? ".webp" : ".svg";
  const limpo = nome.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").slice(0, 140);
  return /\.(png|jpe?g|webp|svg)$/i.test(limpo) ? limpo : `${limpo || "logo"}${extPadrao}`;
}

export const enviarLogoClinica = createServerFn({ method: "POST" })
  .validator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (authError || !authData.user) throw new Error("Sessão inválida ou expirada.");

    const userId = authData.user.id;
    const { data: plataformaUser } = await supabaseAdmin.from("app_users").select("role").eq("user_id", userId).maybeSingle();
    if (plataformaUser?.role !== "admin") throw new Error("Apenas o administrador da plataforma pode alterar a logo da clínica.");

    const { data: driveConfig, error: driveError } = await supabaseAdmin
      .from("clinica_drive_config")
      .select("root_folder_id,status")
      .eq("clinica_id", data.clinicaId)
      .maybeSingle();
    if (driveError || !driveConfig?.root_folder_id) throw new Error("Configure primeiro a pasta da clínica no Google Drive.");

    const bytes = Buffer.from(data.base64, "base64");
    if (!bytes.length || bytes.length > MAX_BYTES) throw new Error("A imagem deve ter no máximo 5 MB.");

    const token = await accessTokenGoogle();
    const logoFolderId = await buscarOuCriarPasta(token, driveConfig.root_folder_id, "Logo");
    const finalName = `${Date.now()}-${nomeSeguro(data.fileName, data.mimeType)}`;

    const boundary = `oricse_${crypto.randomUUID()}`;
    const metadata = JSON.stringify({ name: finalName, parents: [logoFolderId] });
    const prefix = Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${data.mimeType}\r\n\r\n`);
    const suffix = Buffer.from(`\r\n--${boundary}--`);
    const body = Buffer.concat([prefix, bytes, suffix]);

    const upload = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,webViewLink", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": `multipart/related; boundary=${boundary}`,
        "content-length": String(body.length),
      },
      body,
    });
    if (!upload.ok) throw new Error(`Google Drive: ${upload.status} ${await upload.text()}`);
    const arquivo = (await upload.json()) as { id: string; name: string; mimeType?: string; size?: string; webViewLink?: string };

    const permissao = await fetch(`https://www.googleapis.com/drive/v3/files/${arquivo.id}/permissions`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ role: "reader", type: "anyone", allowFileDiscovery: false }),
    });
    if (!permissao.ok) throw new Error(`Logo enviada, mas não foi possível liberar sua visualização: ${await permissao.text()}`);

    const logoUrl = `https://drive.google.com/uc?export=view&id=${arquivo.id}`;

    const { error: clinicaError } = await supabaseAdmin
      .from("clinicas")
      .update({ logo_url: logoUrl, updated_at: new Date().toISOString() })
      .eq("id", data.clinicaId);
    if (clinicaError) throw new Error(`Logo enviada, mas não foi possível atualizar a clínica: ${clinicaError.message}`);

    const { error: indexError } = await supabaseAdmin.from("drive_arquivos").insert({
      clinica_id: data.clinicaId,
      categoria: "logo",
      nome: arquivo.name,
      mime_type: data.mimeType,
      tamanho_bytes: Number(arquivo.size || bytes.length),
      drive_file_id: arquivo.id,
      drive_folder_id: logoFolderId,
      visibilidade: "publico",
      entidade_tipo: "clinica",
      entidade_id: data.clinicaId,
      metadata: { logo_url: logoUrl, web_view_link: arquivo.webViewLink || null },
      enviado_por: userId,
    });
    if (indexError) console.error("Logo enviada, mas falhou ao indexar em drive_arquivos:", indexError.message);

    return { ok: true, logoUrl, driveFileId: arquivo.id, logoFolderId, webViewLink: arquivo.webViewLink || null };
  });
