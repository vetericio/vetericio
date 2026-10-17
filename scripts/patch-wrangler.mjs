import { existsSync, readFileSync, writeFileSync } from "node:fs";

const file = ".output/server/wrangler.json";
if (existsSync(file)) {
  const config = JSON.parse(readFileSync(file, "utf8"));
  // Mantém as variáveis/secrets cadastrados no painel da Cloudflare a cada deploy.
  config.keep_vars = true;
  config.name = "oricse";
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
