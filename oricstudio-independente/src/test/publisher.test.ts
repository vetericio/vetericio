import { beforeEach, describe, expect, it, vi } from "vitest";

// The publisher talks to Supabase (admin client) and to Meta (fetch). Both are faked here so the
// state machine can be tested for its two critical guarantees: never publish twice, and never
// report "publicado" without Meta confirming it.

vi.mock("@/lib/server/meta.server", async (orig) => {
  const actual: any = await orig();
  return { ...actual, getPageToken: vi.fn(async () => "PAGE_TOKEN"), audit: vi.fn(async () => {}) };
});

import { runPublishQueue } from "@/lib/server/publisher.server";

type Row = Record<string, any>;

function fakeAdmin(tables: Record<string, Row[]>) {
  const builder = (table: string) => {
    const filters: ((r: Row) => boolean)[] = [];
    let op: { kind: "select" } | { kind: "update"; values: Row } | { kind: "insert"; values: Row } =
      { kind: "select" };
    const run = () => {
      const rows = (tables[table] ??= []);
      if (op.kind === "insert") {
        rows.push({ id: crypto.randomUUID(), ...op.values });
        return { data: null, error: null };
      }
      const hit = rows.filter((r) => filters.every((f) => f(r)));
      if (op.kind === "update") hit.forEach((r) => Object.assign(r, (op as any).values));
      return { data: hit, error: null };
    };
    const b: any = {
      select: () => b,
      eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), b),
      neq: (k: string, v: unknown) => (filters.push((r) => r[k] !== v), b),
      is: (k: string, v: unknown) => (filters.push((r) => (r[k] ?? null) === v), b),
      gte: () => b,
      lte: () => b,
      lt: () => b,
      order: () => b,
      limit: () => b,
      in: (k: string, v: unknown[]) => (filters.push((r) => v.includes(r[k])), b),
      update: (values: Row) => ((op = { kind: "update", values }), b),
      insert: (values: Row) => ((op = { kind: "insert", values }), b),
      maybeSingle: async () => ({ data: run().data?.[0] ?? null, error: null }),
      single: async () => ({ data: run().data?.[0] ?? null, error: null }),
      then: (res: any, rej: any) => Promise.resolve(run()).then(res, rej),
    };
    return b;
  };
  return {
    from: builder,
    rpc: async (name: string) => {
      expect(name).toBe("claim_due_posts");
      const due = tables["posts"]!.filter(
        (p) =>
          ["agendado", "processando", "resultado_desconhecido"].includes(p["status"]) &&
          new Date(p["agendado_para"]).getTime() <= Date.now() &&
          (!p["proxima_tentativa"] || new Date(p["proxima_tentativa"]).getTime() <= Date.now()),
      );
      due.forEach((p) => {
        if (p["status"] === "agendado") p["status"] = "processando";
      });
      return { data: due.map((p) => ({ ...p })), error: null };
    },
  } as any;
}

function basePost(over: Row = {}): Row {
  return {
    id: "post-1",
    instagram_account_id: "acc-1",
    tipo: "imagem",
    status: "agendado",
    legenda: "Legenda de teste",
    alt_text: null,
    media_asset_ids: ["asset-1"],
    capa_asset_id: null,
    share_to_feed: true,
    container_id: null,
    children_container_ids: [],
    etapa: null,
    tentativas: 0,
    proxima_tentativa: null,
    publish_attempted_at: null,
    agendado_para: new Date(Date.now() - 1000).toISOString(),
    created_at: new Date().toISOString(),
    titulo: "Teste",
    ...over,
  };
}

function db(post: Row) {
  return {
    app_settings: [{ id: true, pausa_geral: false }],
    instagram_accounts: [
      { id: "acc-1", ig_user_id: "IG1", page_id: "PAGE1", connection_id: "conn-1" },
    ],
    media_assets: [{ id: "asset-1", tipo: "imagem", public_url: "https://cdn/x.jpg" }],
    posts: [post],
    post_events: [],
    alerts: [],
  } as Record<string, Row[]>;
}

type Handler = (url: URL, init: RequestInit) => Response | Promise<Response>;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function mockMeta(handler: Handler) {
  const calls: string[] = [];
  vi.stubGlobal("fetch", async (input: string, init: RequestInit) => {
    const url = new URL(input);
    calls.push(`${init.method} ${url.pathname}`);
    return handler(url, init);
  });
  return calls;
}

beforeEach(() => {
  vi.unstubAllGlobals();
  process.env["META_GRAPH_VERSION"] = "v24.0";
});

describe("publisher", () => {
  it("publishes an image: container, status FINISHED, media_publish, permalink", async () => {
    const tables = db(basePost());
    const calls = mockMeta((url) => {
      if (url.pathname.endsWith("/IG1/media")) return json({ id: "C1" });
      if (url.pathname.endsWith("/C1")) return json({ status_code: "FINISHED" });
      if (url.pathname.endsWith("/content_publishing_limit"))
        return json({ data: [{ quota_usage: 1, config: { quota_total: 100 } }] });
      if (url.pathname.endsWith("/media_publish")) return json({ id: "M1" });
      if (url.pathname.endsWith("/M1")) return json({ permalink: "https://instagram.com/p/abc" });
      return json({ error: { message: "unexpected" } }, 400);
    });
    await runPublishQueue(fakeAdmin(tables));
    const p = tables["posts"]![0]!;
    expect(p["status"]).toBe("publicado");
    expect(p["ig_media_id"]).toBe("M1");
    expect(p["permalink"]).toBe("https://instagram.com/p/abc");
    expect(calls.filter((c) => c.endsWith("/media_publish"))).toHaveLength(1);
  });

  it("marks unknown result on network failure, then confirms via container status without publishing again", async () => {
    const tables = db(basePost());
    let published = false;
    const calls = mockMeta((url) => {
      if (url.pathname.endsWith("/IG1/media") && !url.search) return json({ id: "C1" });
      if (url.pathname.endsWith("/C1"))
        return json({ status_code: published ? "PUBLISHED" : "FINISHED" });
      if (url.pathname.endsWith("/content_publishing_limit")) return json({ data: [] });
      if (url.pathname.endsWith("/media_publish")) {
        published = true; // Meta did publish, but the response never arrived
        throw new TypeError("network down");
      }
      if (url.pathname.endsWith("/IG1/media"))
        return json({
          data: [{ id: "M9", timestamp: new Date().toISOString(), caption: "Legenda de teste" }],
        });
      if (url.pathname.endsWith("/M9")) return json({ permalink: "https://instagram.com/p/m9" });
      return json({}, 404);
    });
    const admin = fakeAdmin(tables);
    await runPublishQueue(admin);
    expect(tables["posts"]![0]!["status"]).toBe("resultado_desconhecido");

    await runPublishQueue(admin);
    const p = tables["posts"]![0]!;
    expect(p["status"]).toBe("publicado");
    expect(p["ig_media_id"]).toBe("M9");
    expect(calls.filter((c) => c.endsWith("/media_publish"))).toHaveLength(1);
  });

  it("never calls media_publish when the container is already PUBLISHED", async () => {
    const tables = db(
      basePost({ status: "processando", container_id: "C1", etapa: "aguardando_container" }),
    );
    const calls = mockMeta((url) => {
      if (url.pathname.endsWith("/C1")) return json({ status_code: "PUBLISHED" });
      if (url.pathname.endsWith("/IG1/media")) return json({ data: [] });
      return json({}, 404);
    });
    await runPublishQueue(fakeAdmin(tables));
    expect(tables["posts"]![0]!["status"]).toBe("publicado");
    expect(calls.some((c) => c.endsWith("/media_publish"))).toBe(false);
  });

  it("retries transient Meta errors with backoff and fails permanent ones", async () => {
    const tables = db(basePost());
    mockMeta(() => json({ error: { message: "Service temporarily unavailable", code: 2 } }, 500));
    await runPublishQueue(fakeAdmin(tables));
    let p = tables["posts"]![0]!;
    expect(p["status"]).toBe("processando");
    expect(p["tentativas"]).toBe(1);
    expect(new Date(p["proxima_tentativa"]).getTime()).toBeGreaterThan(Date.now());

    const tables2 = db(basePost());
    mockMeta(() =>
      json(
        { error: { message: "Only photo or video can be accepted as media type.", code: 9004 } },
        400,
      ),
    );
    await runPublishQueue(fakeAdmin(tables2));
    p = tables2["posts"]![0]!;
    expect(p["status"]).toBe("falhou");
    expect(tables2["alerts"]).toHaveLength(1);
  });

  it("does nothing while the general pause is on", async () => {
    const tables = db(basePost());
    tables["app_settings"]![0]!["pausa_geral"] = true;
    const calls = mockMeta(() => json({}));
    const r = await runPublishQueue(fakeAdmin(tables));
    expect(r.pausado).toBe(true);
    expect(calls).toHaveLength(0);
    expect(tables["posts"]![0]!["status"]).toBe("agendado");
  });
});
