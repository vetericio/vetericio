import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { PASTAS_DRIVE, type DriveCategoria } from "@/lib/drive-storage";

const CATEGORIAS = [
  "identidade",
  "tutores",
  "animais",
  "exames",
  "receitas",
  "documentos",
  "imagens",
  "backups",
  "portal-tutor",
  "outros",
] as const satisfies readonly DriveCategoria[];

const authSchema = z.object({
  accessToken: z.string().min(20),
});

const clinicaSchema = authSchema.extend({
  clinicaId: z.string().uuid(),
});

const testarPastaSchema = clinicaSchema.extend({
  folderId: z.string().min(10),
  folderUrl: z.string().optional(),
});

const uploadSchema = clinicaSchema.extend({
  categoria: z.enum(CATEGORIAS),
  nome: z.string().min(1).max(220),
  mimeType: z.string().min(1).max(150).default("application/octet-stream"),
  base64: z.string().min(1).refine((value) => value.length <= 28_000_000, "Arquivo muito grande"),
  visibilidade: z.enum(["interno", "tutor"]).default("interno"),
  entidadeTipo: z.string().max(80).optional(),
  entidadeId: z.string().max(180).optional(),
  metadata: z.record(z.unknown()).optional(),
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
  const payload = base64Url(
    JSON.stringify({
      iss: email,
      scope: "https://www.googleapis.com/auth/drive",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const unsigned = `${header}.${payload}`;
  const { createSign } = await import("node:crypto");
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const signature = base64Url(signer.sign(privateKey));
  const assertion = `${unsigned}.${signature}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const json = (await response.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!response.ok || !json.access_token) {
    throw new Error(json.error_description || json.error || "Falha ao autenticar a conta de serviço no Google Drive.");
  }
  return json.access_token;
}

async function accessTokenOAuth(): Promise<string | null> {
  const clientId = process.env["GOOGLE_DRIVE_CLIENT_ID"];
  const clientSecret = process.env["GOOGLE_DRIVE_CLIENT_SECRET"];
  const refreshToken = process.env["GOOGLE_DRIVE_REFRESH_TOKEN"];
  if (!clientId || !clientSecret || !refreshToken) return null;

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await response.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!response.ok || !json.access_token) {
    throw new Error(json.error_description || json.error || "Falha ao autenticar no Google Drive.");
  }
  return json.access_token;
}

async function accessTokenGoogle(): Promise<string> {
  const serviceAccountToken = await accessTokenServiceAccount();
  if (serviceAccountToken) return serviceAccountToken;

  const oauthToken = await accessTokenOAuth();
  if (oauthToken) return oauthToken;

  throw new Error("Google Drive ainda não foi conectado ao backend da Oryx.");
}

async function googleFetch(path: string, init: RequestInit = {}) {
  const token = await accessTokenGoogle();
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${token}`);
  const response = await fetch(`https://www.googleapis.com${path}`, { ...init, headers });
  if (!response.ok) {
    const texto = await response.text().catch(() => "");
    throw new Error(`Google Drive: ${response.status} ${texto || response.statusText}`);
  }
  return response;
}

async function usuarioAutorizado(supabaseAdmin: SupabaseAdmin, accessToken: string, clinicaId: string) {
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(accessToken);
  if (authError || !authData.user) throw new Error("Sessão inválida ou expirada.");
  const userId = authData.user.id;

  const { data: plataforma } = await supabaseAdmin
    .from("app_users")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (plataforma?.role === "admin") return { userId, adminPlataforma: true };

  const { data: vinculo } = await supabaseAdmin
    .from("clinica_usuarios")
    .select("ativo")
    .eq("clinica_id", clinicaId)
    .eq("user_id", userId)
    .eq("ativo", true)
    .maybeSingle();
  if (!vinculo) throw new Error("Você não tem acesso a esta clínica.");
  return { userId, adminPlataforma: false };
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
  const existente = listJson.files?.find((f) => f.name === nome);
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

async function pastaRaizDaClinica(
  supabaseAdmin: SupabaseAdmin,
  clinicaId: string,
  token: string,
): Promise<{ folderId: string; modo: "oryx" | "personalizado" }> {
  const { data: config } = await supabaseAdmin
    .from("clinica_drive_config")
    .select("modo, root_folder_id, status")
    .eq("clinica_id", clinicaId)
    .maybeSingle();

  if (config?.modo === "personalizado" && config.status === "conectado" && config.root_folder_id) {
    return { folderId: config.root_folder_id, modo: "personalizado" };
  }

  if (config?.modo === "oryx" && config.root_folder_id) {
    return { folderId: config.root_folder_id, modo: "oryx" };
  }

  const [{ data: clinica }, { data: plataforma }] = await Promise.all([
    supabaseAdmin.from("clinicas").select("nome, slug").eq("id", clinicaId).single(),
    supabaseAdmin.from("drive_plataforma_config").select("clinicas_folder_id").eq("id", 1).single(),
  ]);

  if (!clinica || !plataforma?.clinicas_folder_id) throw new Error("Configuração de Drive da clínica incompleta.");
  const nomePasta = clinica.slug ? `${clinica.nome} (${clinica.slug})` : clinica.nome;
  const folderId = await buscarOuCriarPasta(token, plataforma.clinicas_folder_id, nomePasta);

  await supabaseAdmin.from("clinica_drive_config").upsert({
    clinica_id: clinicaId,
    modo: "oryx",
    root_folder_id: folderId,
    root_folder_url: `https://drive.google.com/drive/folders/${folderId}`,
    status: "conectado",
    verificado_em: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  return { folderId, modo: "oryx" };
}

async function validarPastaGoogle(folderId: string) {
  const response = await googleFetch(`/drive/v3/files/${encodeURIComponent(folderId)}?fields=id,name,mimeType,webViewLink,capabilities(canAddChildren)`);
  const json = (await response.json()) as {
    id: string;
    name: string;
    mimeType: string;
    webViewLink?: string;
    capabilities?: { canAddChildren?: boolean };
  };
  if (json.mimeType !== "application/vnd.google-apps.folder") throw new Error("O destino informado não é uma pasta do Google Drive.");
  if (json.capabilities?.canAddChildren === false) throw new Error("A Oryx não tem permissão para enviar arquivos para esta pasta.");
  return json;
}

export const statusDrive = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => authSchema.parse(input))
  .handler(async () => {
    const serviceAccountOk = Boolean(
      process.env["GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL"] &&
        process.env["GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY"],
    );
    const oauthOk = Boolean(
      process.env["GOOGLE_DRIVE_CLIENT_ID"] &&
        process.env["GOOGLE_DRIVE_CLIENT_SECRET"] &&
        process.env["GOOGLE_DRIVE_REFRESH_TOKEN"],
    );

    if (serviceAccountOk) return { configurado: true, modo: "service_account" as const, faltando: [] as string[] };
    if (oauthOk) return { configurado: true, modo: "oauth" as const, faltando: [] as string[] };

    return {
      configurado: false,
      modo: null,
      faltando: ["GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL", "GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY"],
    };
  });

export const testarEConectarPastaDrive = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => testarPastaSchema.parse(input))
  .handler(async ({ data }) => {
    const supabaseAdmin = await carregarSupabaseAdmin();
    await usuarioAutorizado(supabaseAdmin, data.accessToken, data.clinicaId);
    const pasta = await validarPastaGoogle(data.folderId);
    await supabaseAdmin.from("clinica_drive_config").upsert({
      clinica_id: data.clinicaId,
      modo: "personalizado",
      root_folder_id: pasta.id,
      root_folder_url: data.folderUrl || pasta.webViewLink || `https://drive.google.com/drive/folders/${pasta.id}`,
      status: "conectado",
      verificado_em: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    return { ok: true, pasta: { id: pasta.id, nome: pasta.name, url: pasta.webViewLink || null } };
  });

export const voltarAoDrivePadrao = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => clinicaSchema.parse(input))
  .handler(async ({ data }) => {
    const supabaseAdmin = await carregarSupabaseAdmin();
    await usuarioAutorizado(supabaseAdmin, data.accessToken, data.clinicaId);
    await supabaseAdmin.from("clinica_drive_config").upsert({
      clinica_id: data.clinicaId,
      modo: "oryx",
      root_folder_id: null,
      root_folder_url: null,
      status: "pendente",
      verificado_em: null,
      updated_at: new Date().toISOString(),
    });
    return { ok: true };
  });

export const enviarArquivoDrive = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => uploadSchema.parse(input))
  .handler(async ({ data }) => {
    const supabaseAdmin = await carregarSupabaseAdmin();
    const usuario = await usuarioAutorizado(supabaseAdmin, data.accessToken, data.clinicaId);
    const token = await accessTokenGoogle();
    const raiz = await pastaRaizDaClinica(supabaseAdmin, data.clinicaId, token);
    const pastaCategoria = await buscarOuCriarPasta(token, raiz.folderId, PASTAS_DRIVE[data.categoria]);

    const bytes = Buffer.from(data.base64.replace(/^data:[^;]+;base64,/, ""), "base64");
    const form = new FormData();
    form.append(
      "metadata",
      new Blob([JSON.stringify({ name: data.nome, parents: [pastaCategoria] })], { type: "application/json" }),
    );
    form.append("file", new Blob([bytes], { type: data.mimeType }), data.nome);

    const upload = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,parents,webViewLink",
      { method: "POST", headers: { authorization: `Bearer ${token}` }, body: form },
    );
    if (!upload.ok) throw new Error(`Google Drive: ${upload.status} ${await upload.text()}`);
    const arquivo = (await upload.json()) as {
      id: string;
      name: string;
      mimeType?: string;
      size?: string;
      parents?: string[];
      webViewLink?: string;
    };

    const { error: registroError } = await supabaseAdmin.from("drive_arquivos").insert({
      clinica_id: data.clinicaId,
      categoria: data.categoria,
      nome: arquivo.name || data.nome,
      mime_type: arquivo.mimeType || data.mimeType,
      tamanho_bytes: arquivo.size ? Number(arquivo.size) : bytes.byteLength,
      drive_file_id: arquivo.id,
      drive_folder_id: pastaCategoria,
      visibilidade: data.visibilidade,
      entidade_tipo: data.entidadeTipo || null,
      entidade_id: data.entidadeId || null,
      metadata: {
        ...(data.metadata || {}),
        webViewLink: arquivo.webViewLink || null,
        driveModo: raiz.modo,
      },
      enviado_por: usuario.userId,
    });
    if (registroError) throw new Error(`Arquivo enviado, mas falhou o registro: ${registroError.message}`);

    return {
      ok: true,
      arquivo: {
        id: arquivo.id,
        nome: arquivo.name,
        url: arquivo.webViewLink || `https://drive.google.com/open?id=${arquivo.id}`,
        pastaId: pastaCategoria,
        modo: raiz.modo,
      },
    };
  });
