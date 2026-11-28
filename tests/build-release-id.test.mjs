import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { resolverBuildId } from "../scripts/build-release.mjs";

const shaA = "1".repeat(40);
const shaB = "2".repeat(40);

async function pasta(t) {
  const path = await mkdtemp(join(tmpdir(), "oricse-build-id-"));
  t.after(() => rm(path, { recursive: true, force: true }));
  return path;
}

function git(cwd, args) {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
}

async function carimbar(dir, id) {
  await mkdir(join(dir, "public"), { recursive: true });
  await writeFile(join(dir, "public", "oricse-build.json"), JSON.stringify({ build: id }));
}

test("env explícita e variáveis nativas de GitHub/Cloudflare, sem SHA sintético", async (t) => {
  const dir = await pasta(t);
  assert.equal(resolverBuildId(dir, { VITE_ORICSE_BUILD_ID: shaA }), shaA);
  assert.equal(resolverBuildId(dir, { ORICSE_RELEASE_BUILD: "1", GITHUB_SHA: shaA }), shaA);
  assert.equal(resolverBuildId(dir, { WORKERS_CI: "1", WORKERS_CI_COMMIT_SHA: shaA }), shaA);
  assert.equal(resolverBuildId(dir, { GITHUB_SHA: shaA }), null);
  assert.equal(resolverBuildId(dir, { WORKERS_CI_COMMIT_SHA: shaA }), null);
  assert.throws(() => resolverBuildId(dir, { VITE_ORICSE_BUILD_ID: "rascunho" }), /SHA inválido/);
  assert.throws(
    () =>
      resolverBuildId(dir, {
        WORKERS_CI: "1",
        WORKERS_CI_COMMIT_SHA: shaA,
        VITE_ORICSE_BUILD_ID: shaB,
      }),
    /divergem/,
  );
  await carimbar(dir, shaA);
  assert.equal(resolverBuildId(dir, {}), null);
  assert.equal(resolverBuildId(dir, { VITE_ORICSE_BUILD_ID: shaA }), shaA);
  assert.throws(() => resolverBuildId(dir, { VITE_ORICSE_BUILD_ID: shaB }), /divergem/);
});

test("Git HEAD funciona sem env em checkout limpo, e não certifica arquivos alterados", async (t) => {
  const dir = await pasta(t);
  git(dir, ["init", "-q"]);
  await writeFile(join(dir, "versao.txt"), "commit real");
  git(dir, ["add", "versao.txt"]);
  git(dir, [
    "-c",
    "user.name=Fixture",
    "-c",
    "user.email=fixture@example.test",
    "commit",
    "-qm",
    "fixture",
  ]);
  const head = git(dir, ["rev-parse", "HEAD"]);
  assert.equal(resolverBuildId(dir, {}), head);
  await carimbar(dir, head);
  await writeFile(join(dir, "package-lock.json"), "{}");
  assert.equal(resolverBuildId(dir, {}), head);
  await writeFile(join(dir, "arquivo-novo.js"), "nao certificado");
  assert.throws(() => resolverBuildId(dir, { VITE_ORICSE_BUILD_ID: head }), /contém alterações/);
  await rm(join(dir, "arquivo-novo.js"));
  await carimbar(dir, shaB);
  assert.throws(() => resolverBuildId(dir, {}), /divergem/);
  await carimbar(dir, head);
  await writeFile(join(dir, "versao.txt"), "mudança sem commit");
  assert.throws(() => resolverBuildId(dir, { VITE_ORICSE_BUILD_ID: head }), /contém alterações/);
  await rm(join(dir, "public"), { recursive: true });
  assert.equal(resolverBuildId(dir, {}), null);
});

test("build paralelo sem VITE explícita entrega SHA nativo igual ao frontend e ao Worker", async (t) => {
  const dir = await pasta(t);
  await mkdir(join(dir, "scripts"));
  await mkdir(join(dir, "node_modules/vite/bin"), { recursive: true });
  await copyFile(
    new URL("../scripts/build-release.mjs", import.meta.url),
    join(dir, "scripts", "build-release.mjs"),
  );
  for (const [origem, arquivo] of [
    ["cliente.txt", "node_modules/vite/bin/vite.js"],
    ["worker.txt", "scripts/patch-wrangler.mjs"],
  ]) {
    await writeFile(
      join(dir, arquivo),
      `import { writeFileSync } from "node:fs"; writeFileSync(${JSON.stringify(origem)}, process.env.VITE_ORICSE_BUILD_ID ?? "nulo");`,
    );
  }
  const env = { ...process.env, WORKERS_CI: "1", WORKERS_CI_COMMIT_SHA: shaA };
  delete env.VITE_ORICSE_BUILD_ID;
  const r = spawnSync(process.execPath, ["scripts/build-release.mjs"], {
    cwd: dir,
    env,
    encoding: "utf8",
  });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(await readFile(join(dir, "cliente.txt"), "utf8"), shaA);
  assert.equal(await readFile(join(dir, "worker.txt"), "utf8"), shaA);
  delete env.WORKERS_CI_COMMIT_SHA;
  const recusado = spawnSync(process.execPath, ["scripts/build-release.mjs"], {
    cwd: dir,
    env,
    encoding: "utf8",
  });
  assert.notEqual(recusado.status, 0);
  assert.match(recusado.stderr, /exige um SHA verificado/);
  delete env.WORKERS_CI;
  delete env.ORICSE_RELEASE_BUILD;
  const local = spawnSync(process.execPath, ["scripts/build-release.mjs"], {
    cwd: dir,
    env,
    encoding: "utf8",
  });
  assert.equal(local.status, 0, local.stderr);
  assert.equal(await readFile(join(dir, "cliente.txt"), "utf8"), "");
  assert.equal(await readFile(join(dir, "worker.txt"), "utf8"), "");
});
