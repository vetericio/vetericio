/**
 * Append-only Drive journal.
 *
 * Every mutation creates a new immutable file. Writers never PATCH the same
 * table JSON. During reads, the historical snapshot is replayed with these
 * events. Disjoint fields on the same row can be changed concurrently without
 * erasing each other's changes. Same-field concurrent edits are last-write-wins
 * with every attempted edit retained for auditing; they are NOT serializable
 * transactions. Do not use this as a financial ledger without stronger locks.
 */
export type DriveChange = { kind: "put" | "patch" | "remove"; id: string; data?: Record<string, unknown>; expected?: Record<string, unknown> };
export type DriveJournal = { v: 1; timestamp: string; operationId: string; changes: DriveChange[] };

type Requester = (url: string, init?: RequestInit) => Promise<Response>;
const MAX_PAGE_SIZE = 1000;

export function applyJournal(initial: any[], journals: DriveJournal[]): any[] {
  const byId = new Map<string, any>();
  for (const row of initial) if (row?.id != null) byId.set(String(row.id), { ...row });
  const ordered = [...journals].sort((a, b) =>
    a.timestamp.localeCompare(b.timestamp) || a.operationId.localeCompare(b.operationId)
  );
  for (const journal of ordered) {
    for (const change of journal.changes) {
      const id = String(change.id);
      if (change.kind === "remove") byId.delete(id);
      else if (change.kind === "put") byId.set(id, { ...(change.data || {}), id });
      else if (change.kind === "patch") {
        const previous = byId.get(id);
        if (previous) {
          // Optimistic field comparison: a stale writer must never silently
          // replace a value that another writer changed after its read.
          for (const [field, oldValue] of Object.entries(change.expected || {})) {
            if (field === "updated_at") continue;
            if (!Object.is(previous[field], oldValue) && !Object.is(previous[field], change.data?.[field])) {
              const conflict = new Error(`Conflito de edição no registro ${id}, campo ${field}. Recarregue antes de continuar.`);
              Object.assign(conflict, { code: "DRIVE_CONFLICT", recordId: id, field });
              throw conflict;
            }
          }
          byId.set(id, { ...previous, ...(change.data || {}), id });
        }
      }
    }
  }
  return [...byId.values()];
}

function safeTable(table: string) {
  if (!/^[a-zA-Z0-9_]+$/.test(table)) throw new Error("Tabela inválida");
  return table;
}

async function eventsFolder(gf: Requester, parent: string, table: string, create = false): Promise<string | null> {
  const name = safeTable(table) + ".events";
  const q = encodeURIComponent("'" + parent + "' in parents and name='" + name + "' and mimeType='application/vnd.google-apps.folder' and trashed=false");
  const r = await gf("https://www.googleapis.com/drive/v3/files?q=" + q + "&fields=files(id,name)&pageSize=100");
  const existing = (await r.json() as { files?: Array<{ id: string; name: string }> }).files?.find(x => x.name === name);
  if (existing) return existing.id;
  if (!create) return null;
  const created = await gf("https://www.googleapis.com/drive/v3/files?fields=id", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", parents: [parent] }),
  });
  return (await created.json() as { id: string }).id;
}

export async function appendJournal(gf: Requester, parent: string, table: string, changes: DriveChange[]): Promise<string> {
  if (!changes.length) return "";
  const directory = await eventsFolder(gf, parent, table, true);
  if (!directory) throw new Error("Não foi possível criar o diretório do journal.");
  const timestamp = new Date().toISOString();
  const operationId = crypto.randomUUID();
  const name = timestamp + "-" + operationId + ".json";
  const body: DriveJournal = { v: 1, timestamp, operationId, changes };
  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify({ name, parents: [directory] })], { type: "application/json" }));
  form.append("file", new Blob([JSON.stringify(body)], { type: "application/json" }), name);
  const response = await gf("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", {
    method: "POST", body: form,
  });
  const id = (await response.json() as { id?: string }).id;
  if (!id) throw new Error("Google Drive não confirmou a gravação do evento.");
  return id;
}

export async function loadJournals(gf: Requester, parent: string, table: string): Promise<DriveJournal[]> {
  const directory = await eventsFolder(gf, parent, table);
  if (!directory) return [];
  let pageToken: string | undefined;
  const ids: string[] = [];
  do {
    const q = encodeURIComponent("'" + directory + "' in parents and trashed=false");
    const url = "https://www.googleapis.com/drive/v3/files?q=" + q +
      "&fields=nextPageToken,files(id,name)&pageSize=" + MAX_PAGE_SIZE +
      (pageToken ? "&pageToken=" + encodeURIComponent(pageToken) : "");
    const result = await gf(url);
    const body = await result.json() as { files?: Array<{ id: string; name: string }>; nextPageToken?: string };
    for (const file of body.files || []) if (file.name.endsWith(".json")) ids.push(file.id);
    pageToken = body.nextPageToken;
  } while (pageToken);

  const journals: DriveJournal[] = [];
  for (let i = 0; i < ids.length; i += 12) {
    const batch = await Promise.all(ids.slice(i, i + 12).map(async id => {
      const response = await gf("https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(id) + "?alt=media");
      const parsed = await response.json() as DriveJournal;
      if (parsed.v !== 1 || !Array.isArray(parsed.changes) || !parsed.timestamp || !parsed.operationId) {
        throw new Error("Evento do Drive inválido: " + id);
      }
      return parsed;
    }));
    journals.push(...batch);
  }
  return journals;
}
