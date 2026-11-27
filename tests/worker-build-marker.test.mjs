import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const patchWrangler = fileURLToPath(new URL("../scripts/patch-wrangler.mjs", import.meta.url));
const sha = "8f29c6a71c586eea6013cb61f9c85d13a1fdb365";

async function gerar(t, build) {
  const dir = await mkdtemp(join(tmpdir(), "oricse-marker-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const output = join(dir, ".output/server");
  await mkdir(output, { recursive: true });
  await mkdir(join(dir, "src/lib"), { recursive: true });
  await writeFile(join(output, "wrangler.json"), JSON.stringify({ main: "index.mjs", name: "fixture" }));
  await writeFile(join(output, "index.mjs"), `export default {
    fetch(request, env, ctx) { return new Response(env.fixture + "|" + ctx.fixture + "|" + new URL(request.url).pathname, { headers: { "content-type": "text/html" } }); },
    scheduled() { return "mantido"; },
  };`);
  await writeFile(join(dir, "src/lib/drive-write-coordinator.server.ts"), "export class OricseWriteCoordinator {}");
  const env = { ...process.env };
  delete env.VITE_ORICSE_BUILD_ID;
  if (build !== undefined) env.VITE_ORICSE_BUILD_ID = build;
  const processo = spawnSync(process.execPath, [patchWrangler], { cwd: dir, env, encoding: "utf8" });
  assert.equal(processo.status, 0, processo.stderr);
  const config = JSON.parse(await readFile(join(output, "wrangler.json"), "utf8"));
  const worker = await import(pathToFileURL(join(output, config.main)).href);
  return { config, worker: worker.default, coordinator: worker.OricseWriteCoordinator };
}

test("Worker serve SHA imutável antes de ASSETS/Nitro e preserva as demais rotas", async (t) => {
  const { config, worker, coordinator } = await gerar(t, sha);
  assert.deepEqual(config.assets.run_worker_first, ["/assets/*", "/", "/oricse-build.json"]);
  assert.equal(typeof coordinator, "function");
  assert.equal(worker.scheduled(), "mantido");
  const env = { fixture: "env", VITE_ORICSE_BUILD_ID: "a".repeat(40) };
  const ctx = { fixture: "ctx" };
  for (const host of ["oricse.com.br", "app.oricse.com.br", "alvorada.oricse.com.br"]) {
    const url = `https://${host}/oricse-build.json?check=teste`;
    const get = await worker.fetch(new Request(url), env, ctx);
    assert.equal(get.status, 200);
    assert.match(get.headers.get("content-type"), /^application\/json/);
    assert.equal(get.headers.get("cache-control"), "no-store");
    assert.deepEqual(await get.json(), { build: sha });
    const head = await worker.fetch(new Request(url, { method: "HEAD" }), env, ctx);
    assert.equal(head.status, 200);
    assert.equal(await head.text(), "");
    const post = await worker.fetch(new Request(url, { method: "POST" }), env, ctx);
    assert.equal(post.status, 405);
    assert.equal(post.headers.get("allow"), "GET, HEAD");
  }
  for (const path of ["/", "/registros", "/assets/app-abcdef12.js", "/oricse-build.json/"]) {
    const normal = await worker.fetch(new Request("https://oricse.com.br" + path), env, ctx);
    assert.equal(await normal.text(), "env|ctx|" + path);
  }
});

test("Worker não declara build ativo sem SHA válido, mesmo se ambiente runtime tiver valor", async (t) => {
  for (const supplied of [undefined, "invalid", "a".repeat(39), "a".repeat(41)]) {
    const { worker } = await gerar(t, supplied);
    const req = new Request("https://oricse.com.br/oricse-build.json");
    const resposta = await worker.fetch(req, { VITE_ORICSE_BUILD_ID: sha });
    assert.equal(resposta.status, 503);
    assert.equal(resposta.headers.get("cache-control"), "no-store");
    assert.deepEqual(await resposta.json(), { error: "build_identifier_unavailable" });
  }
});
