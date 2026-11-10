import { execFileSync } from "node:child_process";

const protectedPaths = new Set([
  "src/routes/internacao.tsx",
  "src/components/Cabecalho.tsx",
  "src/components/FormAvaliacao.tsx",
  "src/components/Medicacoes.tsx",
  "src/components/Calculadora.tsx",
  "src/components/FerramentasClinicas.tsx",
  "src/components/GuardaSaida.tsx",
  "src/components/InstalarApp.tsx",
  "src/lib/ficha.ts",
  "public/oricse-logo-oryx.svg",
]);

const commitMessage = process.env.GITHUB_EVENT_COMMIT_MESSAGE ?? "";
if (commitMessage.includes("[alteracao-intencional-internacao]")) {
  console.log("Proteção da internação liberada explicitamente nesta publicação.");
  process.exit(0);
}

const sha = process.env.GITHUB_SHA;
const eventBefore = process.env.GITHUB_EVENT_BEFORE;
let base = eventBefore && !/^0+$/.test(eventBefore) ? eventBefore : "";
if (!base) {
  try {
    base = execFileSync("git", ["rev-parse", `${sha}^`], { encoding: "utf8" }).trim();
  } catch {
    console.error("::error::Não foi possível identificar a versão anterior para proteger a internação.");
    process.exit(1);
  }
}

const changed = execFileSync("git", ["diff", "--name-only", base, sha], { encoding: "utf8" })
  .split("\n")
  .filter((path) => protectedPaths.has(path));

if (changed.length) {
  console.error("::error::Publicação bloqueada para preservar a página de Internação.");
  console.error("Arquivos protegidos alterados:");
  for (const path of changed) console.error(` - ${path}`);
  console.error("Para uma alteração solicitada de propósito, inclua [alteracao-intencional-internacao] no título da publicação.");
  process.exit(1);
}

console.log("A página de Internação está protegida contra alterações acidentais.");
