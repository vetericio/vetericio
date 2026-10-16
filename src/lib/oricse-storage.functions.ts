import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  accessToken: z.string().min(20),
});

const salvarSchema = inputSchema.extend({
  alteracoes: z.array(z.object({
    chave: z.string().min(1).max(240),
    valor: z.string().nullable(),
  })).min(1).max(500),
});

type SupabaseAdmin = Awaited<ReturnType<typeof carregarSupabaseAdmin>>;

async function carregarSupabaseAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

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
  const json = await response.json() as { access_token?: string; error?: string; error_description?: string };
  if (!response.ok || !json.access_token) throw new Error(json.error_description || json.error || "Falha ao autenticar o Google Drive.");
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
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
  });
  const json = await response.json() as { access_token?: string; error?: string; error_description?: string };
  if (!response.ok || !json.access_token) throw new Error(json.error_description || json.error || "Falha ao autenticar o Google Drive.");
  return json.access_token;
}

async function tokenGoogle(): Promise<string> {
  const sa = await accessTokenServiceAccount();
  if (sa) return sa;
  const oauth = await accessTokenOAuth();
  if (oauth) return oauth;
  throw new Error("Google Drive não está configurado no backend.");
}

async function googleJson(token: string, url: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${token}`);
  const response = await fetch(url, { ...init, headers });
  if (!response.ok) throw new Error(`Google Drive: ${response.status} ${await response.text().catch(() => response.statusText)}`);
  return response;
}

async function buscarOuCriarPasta(token: string, parentId: string, nome: string): Promise<string> {
  const escaped = nome.replace(/'/g, "\\'");
  const q = encodeURIComponent(`'${parentId}' in parents and name='${escaped}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  const lista = await googleJson(token, `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=10`);
  const json = await lista.json() as { files?: Array<{ id: string; name: string }> };
  const existente = json.files?.find((arquivo) => arquivo.name === nome);
  if (existente?.id) return existente.id;
  const criado = await googleJson(token, "https://www.googleapis.com/drive/v3/files?fields=id", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: nome, mimeType: "application/vnd.google-apps.folder", parents: [parentId] }),
  });
  return ((await criado.json()) as { id: string }).id;
}

async function contextoUsuario(admin: SupabaseAdmin, accessToken: string) {
  const { data: auth, error } = await admin.auth.getUser(accessToken);
  if (error || !auth.user) throw new Error("Sessão inválida ou expirada.");
  const userId = auth.user.id;
  const { data: perfil } = await admin.from("app_users").select("role").eq("user_id", userId).maybeSingle();
  if (perfil?.role === "admin") return { userId, clinicaId: null as string | null, admin: true };
  const { data: vinculos, error: vinculoErro } = await admin.from("clinica_usuarios")
    .select("clinica_id").eq("user_id", userId).eq("ativo", true).limit(2);
  if (vinculoErro) throw vinculoErro;
  if (!vinculos?.length) throw new Error("Usuário sem vínculo ativo com clínica.");
  if (vinculos.length !== 1) throw new Error("Usuário possui mais de uma clínica ativa.");
  return { userId, clinicaId: vinculos[0].clinica_id as string, admin: false };
}

async function raizPersistencia(admin: SupabaseAdmin, token: string, contexto: { userId: string; clinicaId: string | null; admin: boolean }) {
  let raiz = process.env["ORICSE_DRIVE_ROOT_FOLDER_ID"] || process.env["GOOGLE_DRIVE_ROOT_FOLDER_ID"] || "";
  if (!raiz) {
    const { data } = await admin.from("drive_plataforma_config").select("clinicas_folder_id").eq("id", 1).maybeSingle();
    raiz = data?.clinicas_folder_id || "";
  }
  if (!raiz) throw new Error("Defina ORICSE_DRIVE_ROOT_FOLDER_ID no ambiente do backend.");
  const oricse = await buscarOuCriarPasta(token, raiz, ".oricse");
  const escopo = contexto.clinicaId ? `clinica-${contexto.clinicaId}` : `admin-${contexto.userId}`;
  return buscarOuCriarPasta(token, oricse, escopo);
}

async function localizarEstado(token: string, folderId: string) {
  const q = encodeURIComponent(`'${folderId}' in parents and name='estado.json' and trashed=false`);
  const response = await googleJson(token, `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime)&pageSize=10`);
  const json = await response.json() as { files?: Array<{ id: string; name: string; modifiedTime?: string }> };
  return json.files?.find((arquivo) => arquivo.name === "estado.json") || null;
}

async function baixarEstado(token: string, fileId: string): Promise<Record<string, string>> {
  const response = await googleJson(token, `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`);
  const texto = await response.text();
  if (!texto.trim()) return {};
  const valor = JSON.parse(texto) as unknown;
  return valor && typeof valor === "object" && !Array.isArray(valor) ? valor as Record<string, string> : {};
}

async function gravarEstado(token: string, folderId: string, fileId: string | null, estado: Record<string, string>) {
  const corpo = JSON.stringify(estado);
  if (fileId) {
    await googleJson(token, `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(fileId)}?uploadType=media`, {
      method: "PATCH",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: corpo,
    });
    return;
  }
  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify({ name: "estado.json", parents: [folderId] })], { type: "application/json" }));
  form.append("file", new Blob([corpo], { type: "application/json" }), "estado.json");
  await googleJson(token, "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", { method: "POST", body: form });
}

export const carregarEstadoOricseDrive = createServerFn({ method: "POST" })
  .validator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    const admin = await carregarSupabaseAdmin();
    const contexto = await contextoUsuario(admin, data.accessToken);
    const token = await tokenGoogle();
    const folderId = await raizPersistencia(admin, token, contexto);
    const arquivo = await localizarEstado(token, folderId);
    if (!arquivo?.id) return { estado: {} as Record<string, string>, atualizadoEm: null as string | null };
    return { estado: await baixarEstado(token, arquivo.id), atualizadoEm: arquivo.modifiedTime || null };
  });

export const salvarEstadoOricseDrive = createServerFn({ method: "POST" })
  .validator((input: unknown) => salvarSchema.parse(input))
  .handler(async ({ data }) => {
    const admin = await carregarSupabaseAdmin();
    const contexto = await contextoUsuario(admin, data.accessToken);
    const token = await tokenGoogle();
    const folderId = await raizPersistencia(admin, token, contexto);
    const arquivo = await localizarEstado(token, folderId);
    const estado = arquivo?.id ? await baixarEstado(token, arquivo.id) : {};
    for (const alteracao of data.alteracoes) {
      if (alteracao.valor === null) delete estado[alteracao.chave];
      else estado[alteracao.chave] = alteracao.valor;
    }
    await gravarEstado(token, folderId, arquivo?.id || null, estado);
    return { ok: true, quantidade: Object.keys(estado).length };
  });
