// Server-side media import shared by the panel and the MCP connector (ChatGPT/Codex).
type Admin = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];

export const IMPORT_MAX_BYTES = 100 * 1024 * 1024;
const IMPORT_TIPOS: Record<string, { tipo: "imagem" | "video"; ext: "jpg" | "mp4" | "mov" }> = {
  "image/jpeg": { tipo: "imagem", ext: "jpg" },
  "video/mp4": { tipo: "video", ext: "mp4" },
  "video/quicktime": { tipo: "video", ext: "mov" },
};

/** Infer only the explicitly supported binary fallback formats, never from the extension alone. */
export function octetStreamMediaMime(url: URL, body: ArrayBuffer): string {
  const extension = /\.(jpg|jpeg|mp4|mov)$/i.exec(url.pathname)?.[1]?.toLowerCase();
  const bytes = new Uint8Array(body);
  if (
    (extension === "jpg" || extension === "jpeg") &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  )
    return "image/jpeg";
  if ((extension === "mp4" || extension === "mov") && bytes.length >= 16) {
    const view = new DataView(body);
    const boxSize = view.getUint32(0);
    const tag = (offset: number) => String.fromCharCode(...bytes.subarray(offset, offset + 4));
    if (tag(4) === "ftyp" && boxSize >= 16 && boxSize <= bytes.length && boxSize % 4 === 0) {
      const brands = [tag(8)];
      for (let i = 16; i + 4 <= boxSize; i += 4) brands.push(tag(i));
      if (extension === "mov" && tag(8) === "qt  ") return "video/quicktime";
      if (
        extension === "mp4" &&
        tag(8) !== "qt  " &&
        brands.some((brand) => /^(isom|iso[2-9]|mp4[12]|avc1|M4V |M4A |MSNV)$/.test(brand))
      )
        return "video/mp4";
    }
  }
  throw new Error(
    "O link application/octet-stream precisa terminar em .jpg, .jpeg, .mp4 ou .mov e os primeiros bytes devem confirmar o mesmo tipo.",
  );
}

/** Rejects internal addresses so the server can't be used to reach private networks. */
export function assertPublicHttpsUrl(raw: string) {
  const u = new URL(raw);
  const host = u.hostname.toLowerCase();
  const internal =
    u.protocol !== "https:" ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(host) ||
    host.startsWith("[");
  if (internal)
    throw new Error(
      "Use um link público https de um site (endereços internos ou IPs não são aceitos).",
    );
  return u;
}

/** Copies a public https file (JPEG, MP4 or MOV, up to 100 MB) into the media bucket. */
export async function importFromUrl(
  admin: Admin,
  accountId: string,
  url: string,
  createdBy: string | null,
  nome?: string | null,
) {
  const u = assertPublicHttpsUrl(url);
  let res: Response;
  try {
    res = await fetch(u.toString(), { redirect: "follow", signal: AbortSignal.timeout(60_000) });
  } catch {
    throw new Error("Não foi possível baixar o arquivo desse link.");
  }
  if (!res.ok) throw new Error(`O link respondeu com erro ${res.status}.`);
  assertPublicHttpsUrl(res.url || u.toString()); // redirects must also stay public
  let mime = ((res.headers.get("content-type") ?? "").split(";")[0] ?? "").trim().toLowerCase();
  if (!IMPORT_TIPOS[mime] && mime !== "application/octet-stream") {
    throw new Error(
      `O link não aponta para um JPEG, MP4 ou MOV (tipo recebido: ${mime || "desconhecido"}). Links de compartilhamento que abrem uma página de visualização não funcionam; use o link direto do arquivo ou envie pela biblioteca.`,
    );
  }
  if (Number(res.headers.get("content-length") ?? 0) > IMPORT_MAX_BYTES)
    throw new Error("O arquivo do link passa de 100 MB.");
  const body = await res.arrayBuffer();
  if (body.byteLength === 0 || body.byteLength > IMPORT_MAX_BYTES)
    throw new Error("O arquivo do link está vazio ou passa de 100 MB.");

  if (mime === "application/octet-stream") mime = octetStreamMediaMime(u, body);
  const kind = IMPORT_TIPOS[mime];
  if (!kind) throw new Error("Tipo de mídia não suportado.");

  const month = new Date().toISOString().slice(0, 7);
  const storage_path = `uploads/${accountId}/${month}/${crypto.randomUUID()}.${kind.ext}`;
  const { error: upErr } = await admin.storage
    .from("midia")
    .upload(storage_path, body, { contentType: mime, upsert: false });
  if (upErr) throw new Error(`Falha ao guardar o arquivo: ${upErr.message}`);
  const row = await registerAsset(admin, {
    accountId,
    storage_path,
    mime,
    bytes: body.byteLength,
    nome: nome?.trim() || decodeURIComponent(u.pathname.split("/").pop() || "importado"),
    createdBy,
  });
  return { row, host: u.hostname, bytes: body.byteLength };
}

async function registerAsset(
  admin: Admin,
  a: {
    accountId: string;
    storage_path: string;
    mime: string;
    bytes: number;
    nome: string;
    createdBy: string | null;
  },
) {
  const kind = IMPORT_TIPOS[a.mime]!;
  const public_url = admin.storage.from("midia").getPublicUrl(a.storage_path).data.publicUrl;
  const { data: row, error } = await admin
    .from("media_assets")
    .insert({
      instagram_account_id: a.accountId,
      storage_path: a.storage_path,
      tipo: kind.tipo,
      mime: a.mime,
      tamanho_bytes: a.bytes,
      nome_original: a.nome.slice(0, 255),
      public_url,
      created_by: a.createdBy,
    })
    .select("*")
    .single();
  if (error || !row) throw new Error("Não foi possível registrar a mídia.");
  return row;
}

// Fallback direct upload for MCP clients that can PUT to a private signed link: a staging folder
// (envios/), then a confirmation that checks the bytes and moves the file into the library. Files
// in envios/ have no media_assets row, so they never show in the panel or in listar_midias.
const ENVIO_RE = /^([0-9a-f-]{36})\.(jpg|mp4|mov)$/;
const SNIFF_BYTES = 4096;

export async function createUploadLink(
  admin: Admin,
  accountId: string,
  mime: string,
  bytes: number,
) {
  const kind = IMPORT_TIPOS[mime];
  if (!kind) throw new Error("Envie JPEG, MP4 ou MOV (converta PNG para JPEG antes).");
  if (!(bytes > 0) || bytes > IMPORT_MAX_BYTES)
    throw new Error("Arquivo vazio ou acima de 100 MB.");
  const envio = `${crypto.randomUUID()}.${kind.ext}`;
  const { data, error } = await admin.storage
    .from("midia")
    .createSignedUploadUrl(`envios/${accountId}/${envio}`);
  if (error || !data) throw new Error(`Falha ao criar o link de envio: ${error?.message ?? ""}`);
  return {
    envio,
    upload_url: data.signedUrl,
    metodo: "PUT",
    headers: { "Content-Type": mime },
    expira_em: new Date(Date.now() + 2 * 3600_000).toISOString(),
  };
}

/** Stores Base64 media sent through MCP without requiring the client to reach the storage host. */
export async function uploadBase64(
  admin: Admin,
  accountId: string,
  mime: string,
  contentBase64: string,
  nome: string | null,
  createdBy: string | null,
) {
  const kind = IMPORT_TIPOS[mime];
  if (!kind) throw new Error("Envie JPEG, MP4 ou MOV.");
  const encoded = contentBase64.replace(/^data:[^;,]+;base64,/i, "");
  // Buffer.from accepts malformed Base64 silently; reject it before decoding.
  if (
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)
  )
    throw new Error("Conteúdo Base64 inválido.");
  const bytes = Buffer.from(encoded, "base64");
  if (!bytes.length || bytes.length > IMPORT_MAX_BYTES)
    throw new Error("Arquivo vazio ou acima de 100 MB.");
  const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const sniffed = octetStreamMediaMime(new URL(`https://envio/arquivo.${kind.ext}`), body);
  if (sniffed !== mime) throw new Error("O tipo informado não corresponde aos bytes do arquivo.");

  const id = crypto.randomUUID();
  const month = new Date().toISOString().slice(0, 7);
  const storage_path = `uploads/${accountId}/${month}/${id}.${kind.ext}`;
  const { error: upErr } = await admin.storage
    .from("midia")
    .upload(storage_path, body, { contentType: mime, upsert: false });
  if (upErr) throw new Error(`Falha ao guardar o arquivo: ${upErr.message}`);
  return registerAsset(admin, {
    accountId,
    storage_path,
    mime,
    bytes: bytes.byteLength,
    nome: nome?.trim() || `envio.${kind.ext}`,
    createdBy,
  });
}

export async function confirmUpload(
  admin: Admin,
  accountId: string,
  envio: string,
  nome: string | null,
  createdBy: string | null,
) {
  const m = ENVIO_RE.exec(envio);
  if (!m) throw new Error("Envio inválido: use o valor 'envio' devolvido por gerar_link_envio.");
  const id = m[1]!;
  const ext = m[2]!;
  const bucket = admin.storage.from("midia");
  const staging = `envios/${accountId}/${envio}`;
  const { data: files } = await bucket.list(`envios/${accountId}`, { search: id });
  const size = Number(files?.find((f) => f.name === envio)?.metadata?.size ?? 0);
  if (!size)
    throw new Error("O arquivo ainda não chegou: faça o PUT no upload_url antes de confirmar.");

  const reject = async (msg: string) => {
    await bucket.remove([staging]);
    throw new Error(msg);
  };
  if (size > IMPORT_MAX_BYTES) await reject("O arquivo passa de 100 MB e foi descartado.");
  const { data: signed } = await bucket.createSignedUrl(staging, 60);
  const res = signed
    ? await fetch(signed.signedUrl, { headers: { Range: `bytes=0-${SNIFF_BYTES - 1}` } })
    : null;
  const head = res?.ok ? await res.arrayBuffer() : new ArrayBuffer(0);
  let mime: string;
  try {
    mime = octetStreamMediaMime(new URL(`https://envio/${envio}`), head);
  } catch {
    return reject("Os bytes do arquivo não são JPEG, MP4 ou MOV válidos; o envio foi descartado.");
  }

  const month = new Date().toISOString().slice(0, 7);
  const storage_path = `uploads/${accountId}/${month}/${id}.${ext}`;
  const { error: mvErr } = await bucket.move(staging, storage_path);
  if (mvErr) throw new Error(`Falha ao mover o arquivo para a biblioteca: ${mvErr.message}`);
  const row = await registerAsset(admin, {
    accountId,
    storage_path,
    mime,
    bytes: size,
    nome: nome?.trim() || envio,
    createdBy,
  });
  return { row, bytes: size };
}
