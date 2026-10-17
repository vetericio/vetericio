import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname, relative } from "node:path";

const file = ".output/server/wrangler.json";
if (existsSync(file)) {
  const config = JSON.parse(readFileSync(file, "utf8"));
  // Mantém as variáveis/secrets cadastrados no painel da Cloudflare a cada deploy.
  config.keep_vars = true;
  config.name = "oricse";
  // Nitro emits a default-only main module. Cloudflare Durable Objects must
  // also be exported directly from the deployed entry module.
  // The thin entrypoint preserves Nitro's handler and exports the DO class.
  const originalMain = resolve(dirname(file), config.main);
  if (!existsSync(originalMain)) throw new Error("Nitro Worker main not found: " + originalMain);
  const wrapperPath = resolve(dirname(file), "oricse-worker-entry.ts");
  const importMain = "./" + relative(dirname(wrapperPath), originalMain).replaceAll("\\\\", "/");
  const importCoordinator = "../../src/lib/drive-write-coordinator.server.ts";
  writeFileSync(wrapperPath, [
    'import worker from ' + JSON.stringify(importMain) + ';',
    'export { OricseWriteCoordinator } from ' + JSON.stringify(importCoordinator) + ';',
    'export default worker;',
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
