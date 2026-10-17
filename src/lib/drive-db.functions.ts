import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { seedTabela } from "@/lib/drive-seed";
import { appendJournal, applyJournal, loadJournals, type DriveChange } from "@/lib/drive-journal.server";
import { executarEscritaCoordenada } from "@/lib/drive-coordinator-binding.server";

const DEFAULT_ROOT_FOLDER_ID = "1YK5KPgXQCM1odC2axUg1Yj4J2Q0objQz";
const PUBLIC_READ = new Set(["oricse_planos", "oricse_config", "oricse_rotas_personalizadas", "clinicas"]);
const GLOBAL_ADMIN_ONLY = new Set(["oricse_planos", "oricse_config", "oricse_funcionalidades", "oricse_plano_funcionalidades", "oricse_codigos_promocionais", "oricse_codigo_promocional_usos", "oricse_contratacoes", "oricse_rotas_personalizadas", "clinicas"]);
const PORTAL_CLINIC_READ = new Set(["oricse_agendas_online"]);
const PORTAL_DIRECT_WRITE = new Set<string>(["tutores", "oricse_agendamentos_online"]);

const filterSchema = z.object({ kind: z.string(), column: z.string().optional(), value: z.unknown().optional(), operator: z.string().optional() });
const querySchema = z.object({
  accessToken: z.string().nullable().optional(), table: z.string().regex(/^[a-zA-Z0-9_]+$/), operation: z.enum(["select", "insert", "update", "delete", "upsert"]), payload: z.unknown().optional(), columns: z.string().optional(), filters: z.array(filterSchema).default([]), order: z.array(z.object({ column: z.string(), ascending: z.boolean().default(true) })).default([]), limit: z.number().int().positive().max(10000).optional(), range: z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()]).optional(), single: z.enum(["none", "single", "maybeSingle"]).default("none"), head: z.boolean().default(false), count: z.string().nullable().optional(), onConflict: z.string().optional(), expectedRows: z.record(z.record(z.unknown())).optional(), requestId: z.string().uuid().optional(),
});

type AuthContext = { admin: boolean; userId: string | null; clinicas: string[]; portal: Array<{ clinicaId: string; tutorId: string }> };

function root() { return process.env["ORICSE_DRIVE_ROOT_FOLDER_ID"] || process.env["GOOGLE_DRIVE_ROOT_FOLDER_ID"] || DEFAULT_ROOT_FOLDER_ID; }
function b64(v: string | Buffer) { return (typeof v === "string" ? Buffer.from(v) : v).toString("base64url"); }
async function driveToken() {
  const email = process.env["GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL"], raw = process.env["GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY"];
  if (email && raw) {
    const now = Math.floor(Date.now() / 1000), h = b64(JSON.stringify({ alg: "RS256", typ: "JWT" })), p = b64(JSON.stringify({ iss: email, scope: "https://www.googleapis.com/auth/drive", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 })), u = `${h}.${p}`;
    const { createSign } = await import("node:crypto"); const s = createSign("RSA-SHA256"); s.update(u); s.end(); const assertion = `${u}.${b64(s.sign(raw.replace(/\\n/g, "\n")))}`;
    const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }) });
    const j = await r.json() as { access_token?: string; error?: string; error_description?: string }; if (r.ok && j.access_token) return j.access_token; throw new Error(j.error_description || j.error || "Falha Google Drive");
  }
  const id = process.env["GOOGLE_DRIVE_CLIENT_ID"], secret = process.env["GOOGLE_DRIVE_CLIENT_SECRET"], refresh = process.env["GOOGLE_DRIVE_REFRESH_TOKEN"];
  if (id && secret && refresh) {
    const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: id, client_secret: secret, refresh_token: refresh, grant_type: "refresh_token" }) });
    const j = await r.json() as { access_token?: string; error?: string; error_description?: string }; if (r.ok && j.access_token) return j.access_token; throw new Error(j.error_description || j.error || "Falha Google Drive");
  }
  throw new Error("Google Drive não configurado");
}
async function gf(t: string, url: string, init: RequestInit = {}) { const h = new Headers(init.headers); h.set("authorization", `Bearer ${t}`); const r = await fetch(url, { ...init, headers: h }); if (!r.ok) throw new Error(`Google Drive: ${r.status} ${await r.text().catch(() => r.statusText)}`); return r; }
async function folder(t: string, parent: string, nome: string) { const esc = nome.replace(/'/g, "\\'"); const q = encodeURIComponent(`'${parent}' in parents and name='${esc}' and mimeType='application/vnd.google-apps.folder' and trashed=false`); const l = await gf(t, `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=10`); const j = await l.json() as { files?: Array<{ id: string; name: string }> }; if (j.files?.[0]?.id) return j.files[0].id; const c = await gf(t, "https://www.googleapis.com/drive/v3/files?fields=id", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: nome, mimeType: "application/vnd.google-apps.folder", parents: [parent] }) }); return ((await c.json()) as { id: string }).id; }
async function dbFolder(t: string) { const o = await folder(t, root(), ".oricse"); return folder(t, o, "database"); }
async function findFile(t: string, parent: string, nome: string) { const esc = nome.replace(/'/g, "\\'"); const q = encodeURIComponent(`'${parent}' in parents and name='${esc}' and trashed=false`); const r = await gf(t, `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime,version)&pageSize=5`); const j = await r.json() as { files?: Array<{ id: string; name: string; modifiedTime?: string; version?: string }> }; return j.files?.[0] || null; }
async function writeTable(t: string, table: string, folderId: string, fileId: string | null, rows: any[]) { const corpo = JSON.stringify(rows); if (fileId) { await gf(t, `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(fileId)}?uploadType=media`, { method: "PATCH", headers: { "content-type": "application/json;charset=utf-8" }, body: corpo }); return; } const form = new FormData(); form.append("metadata", new Blob([JSON.stringify({ name: `${table}.json`, parents: [folderId], appProperties: { oricseDatabase: "true", tabela: table } })], { type: "application/json" })); form.append("file", new Blob([corpo], { type: "application/json" }), `${table}.json`); await gf(t, "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", { method: "POST", body: form }); }
async function readTable(t: string, table: string) { const f = await dbFolder(t), a = await findFile(t, f, `${table}.json`); if (!a) { return { folderId: f, fileId: null as string | null, rows: seedTabela(table) }; } const r = await gf(t, `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(a.id)}?alt=media`); let rows: any[] = []; try { const x = JSON.parse(await r.text()); rows = Array.isArray(x) ? x : []; } catch { rows = []; } return { folderId: f, fileId: a.id, rows }; }

async function authContext(accessToken?: string | null): Promise<AuthContext> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (!accessToken) return { admin: false, userId: null, clinicas: [], portal: [] };
  const { data: a, error } = await supabaseAdmin.auth.getUser(accessToken); if (error || !a.user) throw new Error("Sessão inválida ou expirada.");
  const uid = a.user.id;
  const [{ data: p }, { data: v }, { data: portal }] = await Promise.all([
    supabaseAdmin.from("app_users").select("role").eq("user_id", uid).maybeSingle(),
    supabaseAdmin.from("clinica_usuarios").select("clinica_id").eq("user_id", uid).eq("ativo", true),
    supabaseAdmin.from("oricse_portal_tutores").select("clinica_id,tutor_id").eq("auth_user_id", uid).eq("ativo", true),
  ]);
  return { admin: p?.role === "admin", userId: uid, clinicas: (v || []).map((x: any) => String(x.clinica_id)), portal: (portal || []).map((x: any) => ({ clinicaId: String(x.clinica_id), tutorId: String(x.tutor_id) })) };
}

function cmp(a: any, b: any) { if (a === b) return 0; if (a == null) return -1; if (b == null) return 1; return a > b ? 1 : -1; }
function like(valor: any, padrao: any, ins = false) { const v = String(valor ?? ""), p = String(padrao ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, "."); return new RegExp(`^${p}$`, ins ? "i" : "").test(v); }
function eq(a: unknown, b: unknown) { return a === b || String(a) === String(b); }
function passa(row: any, f: any): boolean {
  const v = f.column ? row?.[f.column] : undefined;
  switch (f.kind) {
    case "eq": return eq(v, f.value);
    case "neq": return !eq(v, f.value);
    case "in": return Array.isArray(f.value) && f.value.some((x: any) => eq(v, x));
    case "is": return f.value === null ? v == null : v === f.value;
    case "gt": return cmp(v, f.value) > 0;
    case "gte": return cmp(v, f.value) >= 0;
    case "lt": return cmp(v, f.value) < 0;
    case "lte": return cmp(v, f.value) <= 0;
    case "like": return like(v, f.value, false);
    case "ilike": return like(v, f.value, true);
    case "contains": return Array.isArray(v) && Array.isArray(f.value) ? f.value.every((x: any) => v.includes(x)) : typeof v === "object" && v && typeof f.value === "object" && f.value ? Object.entries(f.value as Record<string, unknown>).every(([k, x]) => v[k] === x) : false;
    case "containedBy": return Array.isArray(v) && Array.isArray(f.value) ? v.every((x: any) => f.value.includes(x)) : false;
    case "not": {
      const inner = { kind: f.operator || "eq", column: f.column, value: f.value };
      return !passa(row, inner);
    }
    case "or": {
      const expression = String(f.value || "");
      const partes = expression.split(",").map((x) => x.trim()).filter(Boolean);
      return partes.some((parte) => {
        const m = parte.match(/^([a-zA-Z0-9_]+)\.(eq|neq|gt|gte|lt|lte|like|ilike|is)\.(.*)$/);
        if (!m) return false;
        let valor: unknown = m[3];
        if (valor === "null") valor = null; else if (valor === "true") valor = true; else if (valor === "false") valor = false;
        return passa(row, { kind: m[2], column: m[1], value: valor });
      });
    }
    default: return false;
  }
}
function project(row: any, columns?: string) { if (!columns || columns.trim() === "*") return row; const nomes = columns.split(",").map((x) => x.trim()).filter((x) => /^[a-zA-Z0-9_]+$/.test(x)); if (!nomes.length) return row; return Object.fromEntries(nomes.map((n) => [n, row?.[n]])); }
function ensureId(row: any) { const r = { ...row }; if (!r.id) r.id = crypto.randomUUID(); if ("created_at" in r && !r.created_at) r.created_at = new Date().toISOString(); if ("updated_at" in r) r.updated_at = new Date().toISOString(); return r; }
function rowClinic(row: any) { return row?.clinica_id ? String(row.clinica_id) : null; }

async function animalIdsPortal(t: string, ctx: AuthContext) {
  if (!ctx.portal.length) return new Set<string>();
  const { rows } = await readTable(t, "oricse_animais");
  const pares = new Set(ctx.portal.map((x) => `${x.clinicaId}:${x.tutorId}`));
  return new Set(rows.filter((r) => pares.has(`${String(r.clinica_id)}:${String(r.tutor_id)}`)).map((r) => String(r.id)));
}
async function authorizedRows(t: string, table: string, rows: any[], ctx: AuthContext) {
  if (ctx.admin) return rows;
  const staff = new Set(ctx.clinicas);
  if (!ctx.portal.length) return rows.filter((r) => { const cid = rowClinic(r); return cid ? staff.has(cid) : false; });
  const portalClinicas = new Set(ctx.portal.map((x) => x.clinicaId));
  const portalTutors = new Set(ctx.portal.map((x) => x.tutorId));
  const animais = await animalIdsPortal(t, ctx);
  return rows.filter((r) => {
    const cid = rowClinic(r); if (!cid) return false; if (staff.has(cid)) return true; if (!portalClinicas.has(cid)) return false;
    if (table === "tutores") return portalTutors.has(String(r.id));
    if (table === "oricse_animais") return portalTutors.has(String(r.tutor_id));
    if (r.tutor_id != null) return portalTutors.has(String(r.tutor_id));
    if (r.animal_id != null) return animais.has(String(r.animal_id));
    return PORTAL_CLINIC_READ.has(table);
  });
}

export async function executarDriveDbInterno(q: z.infer<typeof querySchema>, coordinated = false) {
  if (q.operation !== "select" && !coordinated) {
    return await executarEscritaCoordenada("db", q);
  }
  const ctx = await authContext(q.accessToken);
  if (!ctx.userId && !(q.operation === "select" && PUBLIC_READ.has(q.table))) throw new Error("Autenticação necessária.");
  if (q.operation !== "select" && !ctx.admin && GLOBAL_ADMIN_ONLY.has(q.table)) throw new Error("Apenas a administração da plataforma pode alterar estes dados.");
  if (q.operation !== "select" && !ctx.admin && !ctx.clinicas.length && ctx.portal.length && !PORTAL_DIRECT_WRITE.has(q.table)) throw new Error("O Portal do Tutor não pode alterar esta tabela diretamente.");
  if (q.operation !== "select" && !ctx.admin && !ctx.clinicas.length && ctx.portal.length) {
    if (q.table === "tutores" && q.operation !== "update") throw new Error("O Portal do Tutor pode apenas atualizar o próprio cadastro.");
    if (q.table === "oricse_agendamentos_online" && q.operation !== "insert") throw new Error("O Portal do Tutor pode apenas criar agendamentos pelo fluxo autorizado.");
    if (q.table === "tutores") {
      const permitidos = new Set(ctx.portal.map((x) => x.tutorId));
      const alvo = q.filters.find((f) => f.kind === "eq" && f.column === "id")?.value;
      if (!alvo || !permitidos.has(String(alvo))) throw new Error("Tutor fora do escopo desta sessão.");
    }
    if (q.table === "oricse_agendamentos_online") {
      const lista = Array.isArray(q.payload) ? q.payload : [q.payload];
      const animais = await animalIdsPortal(await driveToken(), ctx);
      for (const item of lista.filter(Boolean) as any[]) {
        const identidade = ctx.portal.find((x) => x.clinicaId === String(item.clinica_id) && x.tutorId === String(item.tutor_id));
        if (!identidade || !animais.has(String(item.animal_id)) || String(item.tutor_auth_id || "") !== String(ctx.userId || "") || String(item.origem || "") !== "portal_tutor") throw new Error("Agendamento fora do escopo autorizado do tutor.");
      }
    }
  }
  const t = await driveToken(), base = await readTable(t, q.table);
  const journalRequest = (url: string, init?: RequestInit) => gf(t, url, init);
  const journals = await loadJournals(journalRequest, base.folderId, q.table);
  let rows = applyJournal(base.rows, journals);
  // Repeating a request whose response was lost must not apply the same
  // movement twice, especially for payment/stock ledger records.
  if (q.operation !== "select" && q.requestId) {
    const previous = journals.find((entry) => entry.operationId === q.requestId);
    if (previous) {
      const ids = new Set(previous.changes.map((change) => change.id));
      const permitted = await authorizedRows(t, q.table, rows, ctx);
      const output = permitted.filter((row) => ids.has(String(row.id))).map((row) => project(row, q.columns));
      return { data: q.head ? [] : q.single === "none" ? output : output[0] ?? null, error: null, count: q.count ? output.length : null };
    }
  }
  // Compare with the values actually displayed to the editor, not just
  // values freshly read by the server. The coordinator makes this comparison
  // and the subsequent append a single serialized write.
  if (q.operation !== "select" && q.expectedRows) {
    for (const [id, baseline] of Object.entries(q.expectedRows)) {
      const current = rows.find((row) => String(row.id) === id);
      if (!current) continue;
      const submitted = Array.isArray(q.payload)
        ? (q.payload as any[]).find((row) => String(row?.id) === id)
        : q.payload as Record<string, unknown> | undefined;
      const changing = q.operation === "delete" ? Object.keys(baseline) :
        Object.keys(submitted || {}).filter((field) => field !== "updated_at");
      for (const field of changing) {
        if (!Object.prototype.hasOwnProperty.call(baseline, field)) continue;
        if (JSON.stringify(current[field] ?? null) !== JSON.stringify(baseline[field] ?? null)
          && JSON.stringify(current[field] ?? null) !== JSON.stringify(submitted?.[field] ?? null)) {
          const conflict = new Error(`Outro profissional alterou ${field} no registro ${id}. Atualize a tela antes de salvar.`);
          Object.assign(conflict, { code: "DRIVE_CONFLICT", recordId: id, field });
          throw conflict;
        }
      }
    }
  }
  const visiveis = q.operation === "select" ? await authorizedRows(t, q.table, rows, ctx) : (ctx.admin ? rows : await authorizedRows(t, q.table, rows, ctx));
  const filtros = (lista: any[]) => lista.filter((r) => q.filters.every((f) => passa(r, f)));
  if (q.operation === "select") {
    let result = filtros(ctx.admin || (!ctx.userId && PUBLIC_READ.has(q.table)) ? rows : await authorizedRows(t, q.table, rows, ctx));
    for (const o of q.order.slice().reverse()) result.sort((a, b) => (o.ascending ? 1 : -1) * cmp(a?.[o.column], b?.[o.column]));
    const total = result.length; if (q.range) result = result.slice(q.range[0], q.range[1] + 1); if (q.limit) result = result.slice(0, q.limit); const projected = q.head ? [] : result.map((r) => project(r, q.columns));
    if (q.single === "single") { if (projected.length !== 1) return { data: null, error: { message: projected.length ? "Mais de um registro encontrado." : "Registro não encontrado.", code: "PGRST116" }, count: q.count ? total : null }; return { data: projected[0], error: null, count: q.count ? total : null }; }
    if (q.single === "maybeSingle") { if (projected.length > 1) return { data: null, error: { message: "Mais de um registro encontrado.", code: "PGRST116" }, count: q.count ? total : null }; return { data: projected[0] ?? null, error: null, count: q.count ? total : null }; }
    return { data: projected, error: null, count: q.count ? total : null };
  }
  const payload = Array.isArray(q.payload) ? q.payload : [q.payload]; let afetados: any[] = [];
  // Never allow tenant/owner identity to be reassigned by normal update requests.
  // The row-level authorization check is applied to the existing record, so
  // mutating clinica_id after that check would otherwise move data across tenants.
  if (!ctx.admin && q.operation === "update") {
    if (!q.payload || Array.isArray(q.payload) || typeof q.payload !== "object") throw new Error("Atualização inválida.");
    const mudancas = q.payload as Record<string, unknown>;
    if (Object.prototype.hasOwnProperty.call(mudancas, "clinica_id") || Object.prototype.hasOwnProperty.call(mudancas, "id")) {
      throw new Error("Não é permitido alterar identificadores ou a clínica de um registro.");
    }
    if (!ctx.clinicas.length && ctx.portal.length && q.table === "tutores") {
      const camposPermitidos = new Set(["nome", "telefone", "outro_telefone", "email", "endereco", "nascimento"]);
      if (Object.keys(mudancas).some((campo) => !camposPermitidos.has(campo))) {
        throw new Error("O tutor só pode atualizar seus dados de contato e cadastro.");
      }
    }
  }
  const changes: DriveChange[] = [];
  if (q.operation === "insert") {
    const novos = payload.filter(Boolean).map(ensureId); for (const r of novos) { const cid = rowClinic(r); if (!ctx.admin && (!cid || (!ctx.clinicas.includes(cid) && !(q.table === "oricse_agendamentos_online" && ctx.portal.some((x) => x.clinicaId === cid && x.tutorId === String(r.tutor_id)))))) throw new Error("Registro pertence a outra clínica."); } rows = [...rows, ...novos]; afetados = novos; for (const row of novos) changes.push({ kind: "put", id: String(row.id), data: row });
  } else if (q.operation === "upsert") {
    const campos = (q.onConflict || "id").split(",").map((x) => x.trim()).filter(Boolean); for (const p of payload.filter(Boolean)) { const r = ensureId(p); const cid = rowClinic(r); if (!ctx.admin && (!cid || !ctx.clinicas.includes(cid))) throw new Error("Registro pertence a outra clínica."); const idx = rows.findIndex((x) => campos.every((c) => String(x?.[c] ?? "") === String(r?.[c] ?? ""))); if (idx >= 0) { const baseAnterior = { ...rows[idx] }; if (!ctx.admin && rowClinic(rows[idx]) !== cid) throw new Error("Não é permitido atualizar registro de outra clínica."); rows[idx] = { ...rows[idx], ...r, updated_at: new Date().toISOString() }; afetados.push(rows[idx]); changes.push({ kind: "patch", id: String(rows[idx].id), data: { ...r, updated_at: rows[idx].updated_at }, expected: Object.fromEntries(Object.keys(r).filter((key) => key !== "updated_at").map((key) => [key, (baseAnterior as Record<string, unknown>)[key]])) }); } else { rows.push(r); afetados.push(r); changes.push({ kind: "put", id: String(r.id), data: r }); } }
  } else if (q.operation === "update") {
    const alvo = new Set(filtros(visiveis)); rows = rows.map((r) => { if (!alvo.has(r)) return r; const patch = { ...(q.payload as any), updated_at: new Date().toISOString() }; const novo = { ...r, ...patch }; afetados.push(novo); changes.push({ kind: "patch", id: String(r.id), data: patch, expected: Object.fromEntries(Object.keys(patch).filter((key) => key !== "updated_at").map((key) => [key, r[key]])) }); return novo; });
  } else if (q.operation === "delete") {
    const alvo = new Set(filtros(visiveis)); afetados = rows.filter((r) => alvo.has(r)); rows = rows.filter((r) => !alvo.has(r)); for (const row of afetados) changes.push({ kind: "remove", id: String(row.id) });
  }
  // Persist only immutable per-operation events; never PATCH the shared table snapshot.
  await appendJournal(journalRequest, base.folderId, q.table, changes, q.requestId); let out = afetados.map((r) => project(r, q.columns)); if (q.head) out = [];
  if (q.single === "single") return out.length === 1 ? { data: out[0], error: null, count: q.count ? afetados.length : null } : { data: null, error: { message: "Resultado singular inválido.", code: "PGRST116" }, count: q.count ? afetados.length : null };
  if (q.single === "maybeSingle") return { data: out[0] ?? null, error: out.length > 1 ? { message: "Mais de um registro encontrado.", code: "PGRST116" } : null, count: q.count ? afetados.length : null };
  return { data: out, error: null, count: q.count ? afetados.length : null };
}

export const executarDriveDb = createServerFn({ method: "POST" }).validator((i: unknown) => querySchema.parse(i)).handler(async ({ data }) => {
  try {
    return await executarDriveDbInterno(data);
  } catch (error: any) {
    return {
      data: null,
      error: { code: error?.code || "DRIVE_DB", message: error?.message || "Falha ao acessar o Google Drive.", field: error?.field, recordId: error?.recordId },
      count: null,
    };
  }
});
