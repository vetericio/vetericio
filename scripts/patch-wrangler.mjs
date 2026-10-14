import { existsSync, readFileSync, writeFileSync } from "node:fs";

const file = ".output/server/wrangler.json";
if (existsSync(file)) {
  const config = JSON.parse(readFileSync(file, "utf8"));
  // Mantém as variáveis/secrets cadastrados no painel da Cloudflare a cada deploy.
  config.keep_vars = true;
  config.name = "oricse";
  writeFileSync(file, JSON.stringify(config, null, 2));
}
