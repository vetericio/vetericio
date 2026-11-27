import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname, relative } from "node:path";

const file = ".output/server/wrangler.json";
if (existsSync(file)) {
  const config = JSON.parse(readFileSync(file, "utf8"));
  // Mantém as variáveis/secrets cadastrados no painel da Cloudflare a cada deploy.
  config.keep_vars = true;
  config.name = "oricse";
  // Arquivos versionados devem passar pelo Worker antes de qualquer fallback HTML.
  // Assim um chunk removido em outro deploy nunca vira uma página HTML inválida.
  config.assets ||= {};
  config.assets.binding = "ASSETS";
  // O HTML da página inicial depende do hostname para renderizar a clínica
  // já na primeira resposta. Não servir um index.html estático de oricse.com.br
  // antes de executar a rota '/' do Worker.
  config.assets.run_worker_first = ["/assets/*", "/", "/oricse-build.json"];
  // Nitro emits a default-only main module. Cloudflare Durable Objects must
  // also be exported directly from the deployed entry module.
  // The thin entrypoint preserves Nitro's handler and exports the DO class.
  const originalMain = resolve(dirname(file), config.main);
  if (!existsSync(originalMain)) throw new Error("Nitro Worker main not found: " + originalMain);
  const wrapperPath = resolve(dirname(file), "oricse-worker-entry.ts");
  const importMain = "./" + relative(dirname(wrapperPath), originalMain).replaceAll("\\\\", "/");
  const importCoordinator = "../../src/lib/drive-write-coordinator.server.ts";
  // Bake the same SHA supplied to Vite into the outer Worker, not the runtime
  // environment or a static asset that may be absent or fall back to HTML.
  const suppliedBuildId = process.env.VITE_ORICSE_BUILD_ID ?? "";
  const buildId = /^[0-9a-f]{40}$/.test(suppliedBuildId) ? suppliedBuildId : null;
  writeFileSync(wrapperPath, [
    'import worker from ' + JSON.stringify(importMain) + ';',
    'export { OricseWriteCoordinator } from ' + JSON.stringify(importCoordinator) + ';',
    'const buildId = ' + JSON.stringify(buildId) + ';',
    'export default {',
    '  ...worker,',
    '  fetch(request, env, ctx) {',
    '    if (new URL(request.url).pathname !== "/oricse-build.json") return worker.fetch(request, env, ctx);',
    '    const headers = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" };',
    '    if (request.method !== "GET" && request.method !== "HEAD") {',
    '      return new Response(null, { status: 405, headers: { ...headers, allow: "GET, HEAD" } });',
    '    }',
    '    const payload = buildId ? { build: buildId } : { error: "build_identifier_unavailable" };',
    '    return new Response(request.method === "HEAD" ? null : JSON.stringify(payload), { status: buildId ? 200 : 503, headers });',
    '  },',
    '};',
    '',
  ].join(String.fromCharCode(10)));
  config.main = "./oricse-worker-entry.ts";
  // Nitro usually emits no_bundle; the TypeScript wrapper needs Wrangler bundling.
  config.no_bundle = false;
  // Durable Object is a coordinator only: all business data remains on Drive.
  config.durable_objects ||= {};
  config.durable_objects.bindings ||= [];
  if (!config.durable_objects.bindings.some((b) => b.name === "ORICSE_WRITE_COORDINATOR")) {
    config.durable_objects.bindings.push({
      name: "ORICSE_WRITE_COORDINATOR",
      class_name: "OricseWriteCoordinator",
    });
  }
  config.migrations ||= [];
  if (!config.migrations.some((m) => m.tag === "oricse-drive-serial-v1")) {
    config.migrations.push({
      tag: "oricse-drive-serial-v1",
      new_sqlite_classes: ["OricseWriteCoordinator"],
    });
  }

  writeFileSync(file, JSON.stringify(config, null, 2));
}
