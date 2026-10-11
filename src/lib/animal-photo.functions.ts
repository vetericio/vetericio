import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  accessToken: z.string().min(20),
  clinicaId: z.string().uuid(),
  animalId: z.string().min(1).max(180),
  driveFileId: z.string().min(8).max(220),
});

async function carregarSupabaseAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function base64Url(input: string | Buffer) {
  const buffer = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buffer.toString("base64url");
}

async function tokenServiceAccount(): Promise<string | null> {
  const email = process.env["GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL"];
  const privateKeyRaw = process.env["GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY"];
  if (!email || !privateKeyRaw) return null;
  const privateKey = privateKeyRaw.replace(/\\n/g, "\n");
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64Url(JSON.stringify({
    iss: email,
    scope: "https://www.googleapis.com/auth/drive.readonly",
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
  const json = (await response.json()) as { access_token?: string; error_description?: string; error?: string };
  if (!response.ok || !json.access_token) throw new Error(json.error_description || json.error || "Falha ao acessar o Google Drive.");
  return json.access_token;
}

async function tokenOAuth(): Promise<string | null> {
  const clientId = process.env["GOOGLE_DRIVE_CLIENT_ID"];
  const clientSecret = process.env["GOOGLE_DRIVE_CLIENT_SECRET"];
  const refreshToken = process.env["GOOGLE_DRIVE_REFRESH_TOKEN"];
  if (!clientId || !clientSecret || !refreshToken) return null;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
  });
  const json = (await response.json()) as { access_token?: string; error_description?: string; error?: string };
  if (!response.ok || !json.access_token) throw new Error(json.error_description || json.error || "Falha ao acessar o Google Drive.");
  return json.access_token;
}

async function tokenGoogle() {
  return (await tokenServiceAccount()) || (await tokenOAuth()) || Promise.reject(new Error("Google Drive ainda não foi conectado ao backend da Oricse."));
}

export const carregarFotoAnimalDrive = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    const supabaseAdmin = await carregarSupabaseAdmin();
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (authError || !authData.user) throw new Error("Sessão inválida ou expirada.");
    const userId = authData.user.id;

    const { data: plataforma } = await supabaseAdmin.from("app_users").select("role").eq("user_id", userId).maybeSingle();
    if (plataforma?.role !== "admin") {
      const { data: vinculo } = await supabaseAdmin
        .from("clinica_usuarios")
        .select("ativo")
        .eq("clinica_id", data.clinicaId)
        .eq("user_id", userId)
        .eq("ativo", true)
        .maybeSingle();
      if (!vinculo) throw new Error("Você não tem acesso a esta clínica.");
    }

    const { data: registro } = await supabaseAdmin
      .from("drive_arquivos")
      .select("drive_file_id,mime_type,entidade_tipo,entidade_id")
      .eq("clinica_id", data.clinicaId)
      .eq("drive_file_id", data.driveFileId)
      .eq("entidade_tipo", "animal")
      .eq("entidade_id", data.animalId)
      .maybeSingle();
    if (!registro) throw new Error("Foto não encontrada para este animal.");
    if (!String(registro.mime_type || "").startsWith("image/")) throw new Error("O arquivo salvo não é uma imagem.");

    const token = await tokenGoogle();
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(data.driveFileId)}?alt=media`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(`Não foi possível carregar a foto do Drive (${response.status}).`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.byteLength > 8 * 1024 * 1024) throw new Error("A foto ultrapassa o limite de 8 MB.");
    return { dataUrl: `data:${registro.mime_type || "image/jpeg"};base64,${bytes.toString("base64")}` };
  });
