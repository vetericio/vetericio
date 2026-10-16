const DEFAULT_ROOT_FOLDER_ID = "1YK5KPgXQCM1odC2axUg1Yj4J2Q0objQz";

function rootFolderId() {
  return process.env["ORICSE_DRIVE_ROOT_FOLDER_ID"] || process.env["GOOGLE_DRIVE_ROOT_FOLDER_ID"] || DEFAULT_ROOT_FOLDER_ID;
}
function b64(input: string | Buffer) { return (typeof input === "string" ? Buffer.from(input) : input).toString("base64url"); }

export async function driveAccessToken(scope = "https://www.googleapis.com/auth/drive") {
  const email = process.env["GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL"];
  const raw = process.env["GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY"];
  if (email && raw) {
    const now = Math.floor(Date.now() / 1000);
    const header = b64(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const payload = b64(JSON.stringify({ iss: email, scope, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
    const unsigned = `${header}.${payload}`;
    const { createSign } = await import("node:crypto");
    const signer = createSign("RSA-SHA256"); signer.update(unsigned); signer.end();
    const assertion = `${unsigned}.${b64(signer.sign(raw.replace(/\\n/g, "\n")))}`;
    const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }) });
    const json = await response.json() as { access_token?: string; error?: string; error_description?: string };
    if (!response.ok || !json.access_token) throw new Error(json.error_description || json.error || "Falha ao autenticar o Google Drive.");
    return json.access_token;
  }
  const clientId = process.env["GOOGLE_DRIVE_CLIENT_ID"], clientSecret = process.env["GOOGLE_DRIVE_CLIENT_SECRET"], refreshToken = process.env["GOOGLE_DRIVE_REFRESH_TOKEN"];
  if (clientId && clientSecret && refreshToken) {
    const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }) });
    const json = await response.json() as { access_token?: string; error?: string; error_description?: string };
    if (!response.ok || !json.access_token) throw new Error(json.error_description || json.error || "Falha ao autenticar o Google Drive.");
    return json.access_token;
  }
  throw new Error("Google Drive não configurado no backend.");
}

export async function driveFetch(token: string, url: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers); headers.set("authorization", `Bearer ${token}`);
  const response = await fetch(url, { ...init, headers });
  if (!response.ok) throw new Error(`Google Drive: ${response.status} ${await response.text().catch(() => response.statusText)}`);
  return response;
}

export async function driveFolder(token: string, parentId: string, nome: string) {
  const escaped = nome.replace(/'/g, "\\'");
  const q = encodeURIComponent(`'${parentId}' in parents and name='${escaped}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  const list = await driveFetch(token, `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=10`);
  const json = await list.json() as { files?: Array<{ id: string; name: string }> };
  if (json.files?.[0]?.id) return json.files[0].id;
  const created = await driveFetch(token, "https://www.googleapis.com/drive/v3/files?fields=id", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: nome, mimeType: "application/vnd.google-apps.folder", parents: [parentId] }) });
  return ((await created.json()) as { id: string }).id;
}

export async function drivePath(token: string, nomes: string[]) {
  let parent = rootFolderId();
  for (const nome of nomes) parent = await driveFolder(token, parent, nome);
  return parent;
}

export async function driveFind(token: string, parentId: string, nome: string) {
  const escaped = nome.replace(/'/g, "\\'");
  const q = encodeURIComponent(`'${parentId}' in parents and name='${escaped}' and trashed=false`);
  const response = await driveFetch(token, `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType,modifiedTime,size,appProperties)&pageSize=10`);
  const json = await response.json() as { files?: Array<{ id: string; name: string; mimeType?: string; modifiedTime?: string; size?: string; appProperties?: Record<string,string> }> };
  return json.files?.[0] || null;
}

export async function readDriveJson<T>(token: string, path: string[], nome: string, padrao: T): Promise<{ value: T; fileId: string | null; modifiedTime: string | null }> {
  const parent = await drivePath(token, path);
  const file = await driveFind(token, parent, nome);
  if (!file) return { value: padrao, fileId: null, modifiedTime: null };
  const response = await driveFetch(token, `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media`);
  try { return { value: JSON.parse(await response.text()) as T, fileId: file.id, modifiedTime: file.modifiedTime || null }; }
  catch { return { value: padrao, fileId: file.id, modifiedTime: file.modifiedTime || null }; }
}

export async function writeDriveJson(token: string, path: string[], nome: string, value: unknown) {
  const parent = await drivePath(token, path);
  const file = await driveFind(token, parent, nome);
  const body = JSON.stringify(value);
  if (file) {
    await driveFetch(token, `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(file.id)}?uploadType=media`, { method: "PATCH", headers: { "content-type": "application/json;charset=utf-8" }, body });
    return file.id;
  }
  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify({ name: nome, parents: [parent] })], { type: "application/json" }));
  form.append("file", new Blob([body], { type: "application/json" }), nome);
  const response = await driveFetch(token, "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", { method: "POST", body: form });
  return ((await response.json()) as { id: string }).id;
}

export async function deleteDriveJson(token: string, path: string[], nome: string) {
  const parent = await drivePath(token, path);
  const file = await driveFind(token, parent, nome);
  if (!file) return;
  await driveFetch(token, `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}`, { method: "DELETE" });
}
