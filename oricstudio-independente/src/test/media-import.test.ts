import { afterEach, describe, expect, it, vi } from "vitest";
import { IMPORT_MAX_BYTES, importFromUrl, octetStreamMediaMime } from "@/lib/server/media.server";

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]).buffer;
function ftyp(brand: string) {
  const bytes = new Uint8Array(20);
  new DataView(bytes.buffer).setUint32(0, 20);
  bytes.set(new TextEncoder().encode("ftyp"), 4);
  bytes.set(new TextEncoder().encode(brand), 8);
  bytes.set(new TextEncoder().encode(brand), 16);
  return bytes.buffer;
}
const url = (extension: string) => new URL(`https://media.example/file.${extension}`);
afterEach(() => vi.unstubAllGlobals());

describe("Importação application/octet-stream", () => {
  it.each(["jpg", "jpeg"])("aceita JPEG confirmado em .%s", (extension) => {
    expect(octetStreamMediaMime(url(extension), jpeg)).toBe("image/jpeg");
  });
  it("aceita MP4 confirmado em .mp4", () => {
    expect(octetStreamMediaMime(url("mp4"), ftyp("isom"))).toBe("video/mp4");
  });
  it("aceita MOV confirmado em .mov", () => {
    expect(octetStreamMediaMime(url("mov"), ftyp("qt  "))).toBe("video/quicktime");
  });
  it.each([
    ["mp4", jpeg], ["jpg", ftyp("isom")], ["mov", ftyp("isom")],
    ["mp4", ftyp("qt  ")], ["png", jpeg], ["mp4", ftyp("avif")],
    ["jpg", new TextEncoder().encode("<html>erro</html>").buffer],
  ])("recusa extensão ou assinatura incompatível (%s)", (extension, body) => {
    expect(() => octetStreamMediaMime(url(extension), body)).toThrow(/primeiros bytes/);
  });
  it("recusa MP4 com caixa truncada", () => {
    const bytes = ftyp("isom");
    new DataView(bytes).setUint32(0, 100);
    expect(() => octetStreamMediaMime(url("mp4"), bytes)).toThrow();
  });
  it("mantém o limite concreto de 100 MB e recusa acima dele antes de guardar", async () => {
    expect(IMPORT_MAX_BYTES).toBe(100 * 1024 * 1024);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(jpeg, {
      headers: { "content-type": "application/octet-stream", "content-length": String(100 * 1024 * 1024 + 1) },
    })));
    const storage = vi.fn();
    await expect(importFromUrl({ storage } as never, "account", url("jpg").href, null)).rejects.toThrow(/100 MB/);
    expect(storage).not.toHaveBeenCalled();
  });
  it("importa os bytes, grava MIME confirmado e retorna a mídia registrada", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(jpeg, {
      headers: { "content-type": "application/octet-stream" },
    })));
    const upload = vi.fn().mockResolvedValue({ error: null });
    const insert = vi.fn().mockReturnValue({ select: () => ({ single: async () => ({ data: { id: "media", tipo: "imagem" }, error: null }) }) });
    const admin = {
      storage: { from: () => ({ upload, getPublicUrl: () => ({ data: { publicUrl: "https://media.example/stored.jpg" } }) }) },
      from: () => ({ insert }),
    };
    const result = await importFromUrl(admin as never, "account", url("jpg").href, null);
    expect(upload).toHaveBeenCalledWith(expect.stringMatching(/^uploads\/account\/\d{4}-\d{2}\/.+\.jpg$/), jpeg, { contentType: "image/jpeg", upsert: false });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ mime: "image/jpeg", tamanho_bytes: 4, instagram_account_id: "account" }));
    expect(result.row.id).toBe("media");
  });
});