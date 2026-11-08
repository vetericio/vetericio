import { describe, expect, it } from "vitest";
import { tenantScopedAdmin } from "@/lib/server/tenant-admin.server";
import {
  allowedRedirect,
  createCode,
  exchangeToken,
  pkceMatches,
  registerClient,
  validateAuthorize,
  verifyAccess,
} from "@/lib/server/oauth.server";
import { handleRpc, parseQuando, toolList } from "@/lib/server/mcp.server";

// The MCP connector: OAuth (PKCE, single-use codes, rotating refresh tokens, recognized
// ChatGPT/Claude callbacks) and the MCP JSON-RPC surface. The database is an in-memory fake.

type Row = Record<string, any>;

function fakeAdmin(tables: Record<string, Row[]>) {
  const builder = (table: string) => {
    const filters: ((r: Row) => boolean)[] = [];
    let op: { kind: "select" } | { kind: "update"; values: Row } | { kind: "insert"; values: Row } =
      { kind: "select" };
    const run = () => {
      const rows = (tables[table] ??= []);
      if (op.kind === "insert") {
        const row = { id: crypto.randomUUID(), ...op.values };
        rows.push(row);
        return { data: [row], error: null };
      }
      const hit = rows.filter((r) => filters.every((f) => f(r)));
      if (op.kind === "update") hit.forEach((r) => Object.assign(r, (op as any).values));
      return { data: hit, error: null };
    };
    const b: any = {
      select: () => b,
      eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), b),
      is: (k: string, v: unknown) => (filters.push((r) => (r[k] ?? null) === v), b),
      in: (k: string, v: unknown[]) => (filters.push((r) => v.includes(r[k])), b),
      order: () => b,
      limit: () => b,
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
    auth: {
      admin: { getUserById: async () => ({ data: { user: { email: "dono@example.com" } } }) },
    },
  } as any;
}

async function challengeOf(verifier: string) {
  const d = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)),
  );
  return btoa(String.fromCharCode(...d))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

const CLINIC = "11111111-1111-4111-8111-111111111111";
const CALLBACK = "https://claude.ai/api/mcp/auth_callback";
const VERIFIER = "v".repeat(20) + "erifier-0123456789-abcdefghijklmnop";

async function setup() {
  const tables: Record<string, Row[]> = {
    studio_clinicas: [{id:CLINIC,ativa:true,licenca_ativa:true,licenca_expira_em:null}],
    studio_membros: [{clinica_id:CLINIC,user_id:"u1",papel:"admin",ativo:true}],
  };
  const admin = fakeAdmin(tables);
  const client = await registerClient(admin, { redirect_uris: [CALLBACK], client_name: "Claude" });
  const { params } = await validateAuthorize(admin, {
    client_id: client.client_id,
    redirect_uri: CALLBACK,
    response_type: "code",
    code_challenge: await challengeOf(VERIFIER),
    code_challenge_method: "S256",
    state: "xyz",
  });
  return { tables, admin, scoped:tenantScopedAdmin(admin,CLINIC), client, params };
}

const form = (o: Record<string, string>) => new URLSearchParams(o);
const bearer = (t: string) =>
  new Request("https://x/api/public/mcp", { headers: { authorization: `Bearer ${t}` } });

describe("OAuth do conector", () => {
  it("aceita retornos oficiais do ChatGPT, Claude e loopback", () => {
    expect(allowedRedirect(CALLBACK)).toBe(true);
    expect(allowedRedirect("https://claude.com/api/mcp/auth_callback")).toBe(true);
    expect(allowedRedirect("https://chatgpt.com/connector_platform_oauth_redirect")).toBe(true);
    expect(allowedRedirect("https://chatgpt.com/connector/oauth/callback_123")).toBe(true);
    expect(allowedRedirect("https://chatgpt.com/connector/oauth/")).toBe(false);
    expect(allowedRedirect("http://localhost:33418/callback")).toBe(true);
    expect(allowedRedirect("https://evil.example/cb")).toBe(false);
    expect(allowedRedirect("http://claude.ai/cb")).toBe(false);
    expect(allowedRedirect("https://claude.ai.evil.example/cb")).toBe(false);
  });

  it("recusa registro com retorno de terceiros", async () => {
    await expect(
      registerClient(fakeAdmin({}), { redirect_uris: ["https://evil.example/cb"] }),
    ).rejects.toThrow();
  });

  it("verifica PKCE S256", async () => {
    const c = await challengeOf(VERIFIER);
    expect(await pkceMatches(VERIFIER, c)).toBe(true);
    expect(await pkceMatches(VERIFIER + "x", c)).toBe(false);
  });

  it("troca código uma única vez, valida verifier, e o token dá acesso", async () => {
    const { admin, scoped, client, params, tables } = await setup();
    const code = await createCode(scoped, "u1", params);
    expect(tables["oauth_codes"]![0]!["code_hash"]).not.toBe(code); // only the hash is stored

    const bad = await createCode(scoped, "u1", params);
    await expect(
      exchangeToken(
        admin,
        form({
          grant_type: "authorization_code",
          code: bad,
          client_id: client.client_id,
          code_verifier: "w".repeat(43),
        }),
      ),
    ).rejects.toThrow(/code_verifier/);

    const ok = await exchangeToken(
      admin,
      form({
        grant_type: "authorization_code",
        code,
        client_id: client.client_id,
        redirect_uri: CALLBACK,
        code_verifier: VERIFIER,
      }),
    );
    expect(ok.token_type).toBe("Bearer");
    await expect(
      exchangeToken(
        admin,
        form({
          grant_type: "authorization_code",
          code,
          client_id: client.client_id,
          code_verifier: VERIFIER,
        }),
      ),
    ).rejects.toThrow();

    const who = await verifyAccess(admin, bearer(ok.access_token));
    expect(who?.actor.role).toBe("assistente");
    expect(who?.actor.email).toBe("mcp:dono@example.com");
    expect(await verifyAccess(admin, bearer("x".repeat(43)))).toBeNull();
  });

  it("rotaciona o refresh token e invalida o anterior", async () => {
    const { admin, scoped, client, params } = await setup();
    const code = await createCode(scoped, "u1", params);
    const first = await exchangeToken(
      admin,
      form({
        grant_type: "authorization_code",
        code,
        client_id: client.client_id,
        code_verifier: VERIFIER,
      }),
    );
    const second = await exchangeToken(
      admin,
      form({
        grant_type: "refresh_token",
        refresh_token: first.refresh_token,
        client_id: client.client_id,
      }),
    );
    expect(second.access_token).not.toBe(first.access_token);
    await expect(
      exchangeToken(
        admin,
        form({
          grant_type: "refresh_token",
          refresh_token: first.refresh_token,
          client_id: client.client_id,
        }),
      ),
    ).rejects.toThrow();
    expect(await verifyAccess(admin, bearer(first.access_token))).toBeNull();
    expect(await verifyAccess(admin, bearer(second.access_token))).not.toBeNull();
  });

  it("não dá acesso a quem não é admin nem editor", async () => {
    const { admin, scoped, client, params, tables } = await setup();
    const code = await createCode(scoped, "u1", params);
    const t = await exchangeToken(
      admin,
      form({
        grant_type: "authorization_code",
        code,
        client_id: client.client_id,
        code_verifier: VERIFIER,
      }),
    );
    tables["studio_membros"] = [{clinica_id:CLINIC,user_id:"u1",papel:"viewer",ativo:true}];
    expect(await verifyAccess(admin, bearer(t.access_token))).toBeNull();
  });
});

describe("MCP", () => {
  const ctx = {
    admin: fakeAdmin({}),
    actor: { userId: null, email: "mcp:x", role: "assistente" as const },
    email: "x",
  };

  it("negocia a versão do protocolo e ignora notificações", async () => {
    const r: any = await handleRpc(ctx, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-06-18" },
    });
    expect(r.result.protocolVersion).toBe("2025-06-18");
    expect(r.result.capabilities.tools).toBeDefined();
    expect(
      await handleRpc(ctx, { jsonrpc: "2.0", method: "notifications/initialized" }),
    ).toBeNull();
  });

  it("lista ferramentas sem publicar na hora nem apagar", () => {
    const tools = toolList();
    const names = tools.map((t) => t.name);
    expect(names).toContain("agendar_publicacao");
    expect(names).toContain("enviar_midia_base64");
    expect(names.some((n) => /publicar_agora|apagar|excluir|responder_comentario/.test(n))).toBe(
      false,
    );
    const agendar = tools.find((t) => t.name === "agendar_publicacao")!.inputSchema as any;
    expect(agendar.required).toEqual(expect.arrayContaining(["conta", "tipo", "midias"]));
    expect(agendar.properties.tipo.enum).toContain("reels");
  });

  it("devolve erro de argumento como resultado da ferramenta", async () => {
    const r: any = await handleRpc(ctx, {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "agendar_publicacao", arguments: {} },
    });
    expect(r.result.isError).toBe(true);
  });

  it("interpreta horários de Brasília", () => {
    expect(parseQuando("2026-10-27T19:00")).toBe("2026-10-27T22:00:00.000Z");
    expect(parseQuando("2026-10-27T19:00:00Z")).toBe("2026-10-27T19:00:00.000Z");
    expect(() => parseQuando("amanhã")).toThrow();
  });
});
