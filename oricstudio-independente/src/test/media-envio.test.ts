import { afterEach, describe, expect, it, vi } from "vitest";
import { confirmUpload, createUploadLink } from "@/lib/server/media.server";

// Direct upload for the connector: signed link into envios/, then byte check and move to uploads/.

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]).buffer;
afterEach(() => vi.unstubAllGlobals());

function fakeAdmin(files: Record<string, number>) {
  const calls = {
    removed: [] as string[],
    moved: [] as [string, string][],
    inserted: [] as Record<string, unknown>[],
  };
  const bucket = {
    createSignedUploadUrl: vi.fn(async (path: string) => ({
      data: { signedUrl: `https://storage.example/upload/${path}?token=t`, path, token: "t" },
      error: null,
    })),
    list: vi.fn(async (dir: string) => ({
      data: Object.entries(files)
        .filter(([p]) => p.startsWith(`${dir}/`))
        .map(([p, size]) => ({ name: p.slice(dir.length + 1), metadata: { size } })),
      error: null,
    })),
    createSignedUrl: vi.fn(async (path: string) => ({
      data: { signedUrl: `https://storage.example/${path}` },
      error: null,
    })),
    remove: vi.fn(async (paths: string[]) => (calls.removed.push(...paths), { error: null })),
    move: vi.fn(
      async (from: string, to: string) => (calls.moved.push([from, to]), { error: null }),
    ),
    getPublicUrl: (p: string) => ({ data: { publicUrl: `https://public.example/${p}` } }),
  };
  const admin = {
    storage: { from: () => bucket },
    from: () => ({
      insert: (values: Record<string, unknown>) => (
        calls.inserted.push(values),
        { select: () => ({ single: async () => ({ data: { id: "m1", ...values }, error: null }) }) }
      ),
    }),
  };
  return { admin: admin as never, bucket, calls };
}

describe("gerar_link_envio", () => {
  it("cria link assinado em envios/ só para tipos aceitos", async () => {
    const { admin, bucket } = fakeAdmin({});
    const r = await createUploadLink(admin, "acc", "video/mp4", 1000);
    expect(r.envio).toMatch(/^[0-9a-f-]{36}\.mp4$/);
    expect(bucket.createSignedUploadUrl).toHaveBeenCalledWith(`envios/acc/${r.envio}`);
    expect(r.headers).toEqual({ "Content-Type": "video/mp4" });
    await expect(createUploadLink(admin, "acc", "image/png", 10)).rejects.toThrow(/JPEG/);
    await expect(createUploadLink(admin, "acc", "image/jpeg", 101 * 1024 * 1024)).rejects.toThrow(
      /100 MB/,
    );
  });
});

describe("confirmar_envio", () => {
  const envio = "11111111-2222-3333-4444-555555555555.jpg";

  it("valida os bytes, move para uploads/ e registra a mídia", async () => {
    const { admin, calls } = fakeAdmin({ [`envios/acc/${envio}`]: 6 });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(jpeg)));
    const { row } = await confirmUpload(admin, "acc", envio, "story.jpg", null);
    expect(calls.moved[0]![0]).toBe(`envios/acc/${envio}`);
    expect(calls.moved[0]![1]).toMatch(/^uploads\/acc\/\d{4}-\d{2}\/11111111-.*\.jpg$/);
    expect(calls.inserted[0]).toMatchObject({
      mime: "image/jpeg",
      tamanho_bytes: 6,
      nome_original: "story.jpg",
    });
    expect(row.id).toBe("m1");
  });

  it("descarta arquivo com bytes que não batem", async () => {
    const { admin, calls } = fakeAdmin({ [`envios/acc/${envio}`]: 5 });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>")));
    await expect(confirmUpload(admin, "acc", envio, null, null)).rejects.toThrow(/descartado/);
    expect(calls.removed).toEqual([`envios/acc/${envio}`]);
    expect(calls.inserted).toHaveLength(0);
  });

  it("avisa quando o arquivo ainda não foi enviado e recusa envio malformado", async () => {
    const { admin } = fakeAdmin({});
    await expect(confirmUpload(admin, "acc", envio, null, null)).rejects.toThrow(
      /ainda não chegou/,
    );
    await expect(confirmUpload(admin, "acc", "../x.jpg", null, null)).rejects.toThrow(/inválido/);
  });
});
