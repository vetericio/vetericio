import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync("src/lib/drive-journal.server.ts", "utf8");
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { applyJournal, appendJournal, loadJournals } = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));

const initial = [{ id: "animal-1", clinica_id: "clinica-1", nome: "Luna", peso: 5 }];
const t = "2026-10-17T17:00:00.000Z";
const journals = [
  { v: 1, timestamp: t, operationId: "a", changes: [{ kind: "patch", id: "animal-1", data: { peso: 6 } }] },
  { v: 1, timestamp: t, operationId: "b", changes: [{ kind: "patch", id: "animal-1", data: { nome: "Luna Maria" } }] },
];
assert.deepEqual(applyJournal(initial, [...journals].reverse()), [{ id: "animal-1", clinica_id: "clinica-1", nome: "Luna Maria", peso: 6 }]);
assert.equal(applyJournal(initial, [{ ...journals[0], changes: [{ kind: "remove", id: "animal-1" }] }]).length, 0);
assert.deepEqual(applyJournal([], [{ ...journals[0], changes: [{ kind: "put", id: "a", data: { nome: "Rex" } }] }]), [{ id: "a", nome: "Rex" }]);

// Same-field edit based on a stale value must surface an explicit conflict.
const conflicting = [
  { v: 1, timestamp: t, operationId: "c", changes: [{ kind: "patch", id: "animal-1", data: { peso: 7 }, expected: { peso: 5 } }] },
  { v: 1, timestamp: t, operationId: "d", changes: [{ kind: "patch", id: "animal-1", data: { peso: 8 }, expected: { peso: 5 } }] },
];
assert.throws(() => applyJournal(initial, conflicting), (error) => error.code === "DRIVE_CONFLICT" && error.field === "peso");
assert.equal(applyJournal(initial, [{ ...conflicting[0] }])[0].peso, 7);

// Two overlapping uploads must create two DIFFERENT files, not PATCH a table JSON.
const files = new Map();
let folderId = null;
const gf = async (url, init = {}) => {
  if (url.includes("uploadType=multipart")) {
    assert.equal(init.method, "POST");
    const metadata = JSON.parse(await init.body.get("metadata").text());
    const journal = JSON.parse(await init.body.get("file").text());
    const id = "event-" + (files.size + 1);
    files.set(id, { metadata, journal });
    return new Response(JSON.stringify({ id }), { status: 200 });
  }
  if (url.includes("fields=id") && init.method === "POST") {
    folderId = "folder-events"; return new Response(JSON.stringify({ id: folderId }), { status: 200 });
  }
  if (url.includes("alt=media")) {
    const id = decodeURIComponent(url.split("/files/")[1]?.split("?")[0] || "");
    return new Response(JSON.stringify(files.get(id)?.journal), { status: 200 });
  }
  if (url.includes("/files?q=")) {
    if (!folderId) return new Response(JSON.stringify({ files: [] }), { status: 200 });
    const listing = [...files].map(([id, data]) => ({ id, name: data.metadata.name }));
    if (url.includes("pageSize=1000")) return new Response(JSON.stringify({ files: listing }), { status: 200 });
    return new Response(JSON.stringify({ files: [{ id: folderId, name: "animals.events" }] }), { status: 200 });
  }
  throw Error("unexpected request " + url);
};
await Promise.all([
  appendJournal(gf, "database", "animals", journals[0].changes),
  appendJournal(gf, "database", "animals", journals[1].changes),
]);
assert.equal(files.size, 2);
const replayed = applyJournal(initial, await loadJournals(gf, "database", "animals"));
assert.equal(replayed[0].nome, "Luna Maria");
assert.equal(replayed[0].peso, 6);
console.log("Drive journal: concurrent append and deterministic replay OK");
