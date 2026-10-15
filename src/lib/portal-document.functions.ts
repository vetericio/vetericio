import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  accessToken: z.string().min(20),
  documentoId: z.string().uuid(),
});

async function carregarAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function base64Url(input: string | Buffer) {
  const buffer = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buffer.toString("base64url");
}

async function tokenServiceAccount() {
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
  const json = await response.json() as { access_token?: string; error_description?: string; error?: string };
  if (!response.ok || !json.access_token) throw new Error(json.error_description || json.error || "Falha ao acessar o Google Drive.");
  return json.access_token;
}

async function tokenOAuth() {
  const clientId = process.env["GOOGLE_DRIVE_CLIENT_ID"];
  const clientSecret = process.env["GOOGLE_DRIVE_CLIENT_SECRET"];
  const refreshToken = process.env["GOOGLE_DRIVE_REFRESH_TOKEN"];
  if (!clientId || !clientSecret || !refreshToken) return null;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
  });
  const json = await response.json() as { access_token?: string; error_description?: string; error?: string };
  if (!response.ok || !json.access_token) throw new Error(json.error_description || json.error || "Falha ao acessar o Google Drive.");
  return json.access_token;
}

async function tokenGoogle() {
  return (await tokenServiceAccount()) || (await tokenOAuth()) || (() => { throw new Error("Google Drive ainda não está conectado ao backend da Oricse."); })();
}

async function portalIncluido(admin: Awaited<ReturnType<typeof carregarAdmin>>, clinicaId: string) {
  const [{ data: clinica }, { data: excecao }, { data: planos }] = await Promise.all([
    admin.from("clinicas").select("plano,status").eq("id", clinicaId).maybeSingle(),
    admin.from("oricse_clinica_funcionalidade_excecoes").select("permitido,expira_em").eq("clinica_id", clinicaId).eq("funcionalidade_codigo", "portal_tutor.acesso").maybeSingle(),
    admin.from("oricse_planos").select("id,codigo,nome,ativo").eq("ativo", true),
  ]);
  if (!clinica || clinica.status !== "ativa") return false;
  if (excecao && (!excecao.expira_em || new Date(excecao.expira_em).getTime() > Date.now())) return Boolean(excecao.permitido);
  const plano = (planos || []).find((p) => p.codigo === clinica.plano || p.nome === clinica.plano);
  if (!plano) return false;
  const { data: matriz } = await admin.from("oricse_plano_funcionalidades").select("permitido").eq("plano_id", plano.id).eq("funcionalidade_codigo", "portal_tutor.acesso").maybeSingle();
  return Boolean(matriz?.permitido);
}

export const baixarDocumentoPortal = createServerFn({ method: "POST" })
  .validator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    const admin = await carregarAdmin();
    const { data: authData, error: authError } = await admin.auth.getUser(data.accessToken);
    if (authError || !authData.user) throw new Error("Sessão inválida ou expirada.");

    const { data: documento } = await admin.from("oricse_portal_documentos")
      .select("id,clinica_id,animal_id,drive_arquivo_id,titulo,visivel_tutor")
      .eq("id", data.documentoId)
      .eq("visivel_tutor", true)
      .maybeSingle();
    if (!documento?.drive_arquivo_id) throw new Error("Este documento ainda não possui um arquivo disponível para download.");
    if (!(await portalIncluido(admin, documento.clinica_id))) throw new Error("Portal indisponível para esta clínica.");

    const { data: portal } = await admin.from("oricse_portal_tutores")
      .select("tutor_id,ativo")
      .eq("auth_user_id", authData.user.id)
      .eq("clinica_id", documento.clinica_id)
      .eq("ativo", true)
      .maybeSingle();
    if (!portal) throw new Error("Você não tem acesso a este documento.");

    const { data: animal } = await admin.from("oricse_animais")
      .select("id")
      .eq("id", documento.animal_id)
      .eq("clinica_id", documento.clinica_id)
      .eq("tutor_id", portal.tutor_id)
      .maybeSingle();
    if (!animal) throw new Error("Você não tem acesso a este documento.");

    const { data: arquivo } = await admin.from("drive_arquivos")
      .select("id,clinica_id,nome,mime_type,tamanho_bytes,drive_file_id")
      .eq("id", documento.drive_arquivo_id)
      .eq("clinica_id", documento.clinica_id)
      .maybeSingle();
    if (!arquivo?.drive_file_id) throw new Error("Arquivo não encontrado.");
    if (Number(arquivo.tamanho_bytes || 0) > 20_000_000) throw new Error("Este arquivo é grande demais para abrir pelo portal.");

    const token = await tokenGoogle();
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(arquivo.drive_file_id)}?alt=media`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error("Não foi possível baixar o arquivo do Google Drive.");
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.byteLength > 20_000_000) throw new Error("Este arquivo é grande demais para abrir pelo portal.");

    return {
      nome: arquivo.nome || documento.titulo,
      mimeType: arquivo.mime_type || "application/octet-stream",
      base64: bytes.toString("base64"),
    };
  });
