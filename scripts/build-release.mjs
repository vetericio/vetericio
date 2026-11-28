import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const sha = /^[0-9a-f]{40}$/;

function git(cwd, args) {
  const resultado = spawnSync("git", args, { cwd, encoding: "utf8" });
  return resultado.status === 0 ? resultado.stdout.trimEnd() : null;
}

/** The browser and Worker must get the same identifier before Vite runs. */
export function resolverBuildId(cwd, env) {
  const stampPath = resolve(cwd, "public/oricse-build.json");
  const fontes = [];
  const chaves = ["VITE_ORICSE_BUILD_ID"];
  if (env.ORICSE_RELEASE_BUILD === "1") chaves.push("GITHUB_SHA");
  if (env.WORKERS_CI === "1") chaves.push("WORKERS_CI_COMMIT_SHA");
  for (const chave of chaves) {
    if (env[chave] === undefined || env[chave] === "") continue;
    if (!sha.test(env[chave])) throw new Error(`SHA inválido em ${chave}.`);
    fontes.push([chave, env[chave]]);
  }
  if (existsSync(stampPath)) {
    let stamp;
    try {
      stamp = JSON.parse(readFileSync(stampPath, "utf8")).build;
    } catch {
      throw new Error("Marcador public/oricse-build.json inválido.");
    }
    if (typeof stamp !== "string" || !sha.test(stamp))
      throw new Error("SHA inválido em public/oricse-build.json.");
    fontes.push(["public/oricse-build.json", stamp]);
  }

  const gitRoot = git(cwd, ["rev-parse", "--show-toplevel"]);
  if (gitRoot && resolve(gitRoot) === resolve(cwd)) {
    const head = git(cwd, ["rev-parse", "--verify", "HEAD^{commit}"]);
    if (!head || !sha.test(head)) throw new Error("O Git não confirmou o commit para o build.");
    const status = git(cwd, ["status", "--porcelain=v1", "--untracked-files=all"]);
    if (status === null) throw new Error("Não foi possível verificar o estado da árvore Git.");
    // CI already creates these two untracked artifacts before invoking the build.
    const gerados = new Set(["?? package-lock.json", "?? public/oricse-build.json"]);
    if (status.split("\n").some((linha) => linha && !gerados.has(linha))) {
      if (fontes.length)
        throw new Error("Recusado SHA de release: a árvore Git contém alterações.");
      return null; // Local development build; the public marker must not claim a release.
    }
    fontes.push(["Git HEAD", head]);
  }

  if (new Set(fontes.map(([, id]) => id)).size > 1) {
    throw new Error(
      `Os identificadores de build divergem (${fontes.map(([fonte]) => fonte).join(", ")}).`,
    );
  }
  // A stamp alone, outside a verified checkout, can be stale.
  if (!fontes.some(([fonte]) => fonte !== "public/oricse-build.json")) return null;
  return fontes[0][1];
}

function executar(argumentos, env) {
  const resultado = spawnSync(process.execPath, argumentos, { env, stdio: "inherit" });
  if (resultado.error) throw resultado.error;
  if (resultado.status !== 0) process.exit(resultado.status ?? 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const cwd = process.cwd();
  const id = resolverBuildId(cwd, process.env);
  if (!id && (process.env.ORICSE_RELEASE_BUILD === "1" || process.env.WORKERS_CI === "1")) {
    throw new Error("O empacotamento de release exige um SHA verificado.");
  }
  const env = { ...process.env };
  if (id) {
    env.VITE_ORICSE_BUILD_ID = id;
    console.log(`SHA verificado para Vite e Worker: ${id}`);
  } else {
    // Explicitly override any local .env value when provenance is unavailable.
    env.VITE_ORICSE_BUILD_ID = "";
    console.log("Build local sem SHA de release; o marcador permanece indisponível.");
  }
  executar([resolve(cwd, "node_modules/vite/bin/vite.js"), "build"], env);
  executar([fileURLToPath(new URL("./patch-wrangler.mjs", import.meta.url))], env);
}
