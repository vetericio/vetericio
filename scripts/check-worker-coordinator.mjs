import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const file = ".output/server/wrangler.json";
assert.ok(fs.existsSync(file), "Cloudflare build não produziu wrangler.json.");
const config = JSON.parse(fs.readFileSync(file, "utf8"));
assert.ok(
  config.durable_objects?.bindings?.some(
    (binding) => binding.name === "ORICSE_WRITE_COORDINATOR" && binding.class_name === "OricseWriteCoordinator",
  ),
  "Binding ORICSE_WRITE_COORDINATOR ausente.",
);
assert.ok(
  config.migrations?.some(
    (migration) => migration.new_sqlite_classes?.includes("OricseWriteCoordinator"),
  ),
  "Migração do Durable Object ausente.",
);
let found = false;
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const location = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(location);
    else if (entry.name.endsWith(".mjs") || entry.name.endsWith(".js")) { if (fs.readFileSync(location, "utf8").includes("OricseWriteCoordinator")) found = true; }
  }
}
walk(".output/server");
assert.ok(found, "Classe OricseWriteCoordinator ausente dos arquivos compilados.");
console.log("Configuração e código do coordenador incluídos no build Cloudflare.");
