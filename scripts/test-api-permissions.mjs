import assert from "node:assert/strict";
import fs from "node:fs";

const helper = fs.readFileSync("src/lib/permissao-clinica.server.ts", "utf8");
for (const token of [
  'status !== "ativa"', 'excluido_em', 'eq("ativo", true)',
  '"oricse_permissoes_efetivas"', 'p.permitido === true',
]) assert.ok(helper.includes(token), `Guarda ausente: ${token}`);

const casos = [
  ["src/lib/agenda.functions.ts", "recepcao.agenda"],
  ["src/lib/clinic-logo.functions.ts", "administracao.site"],
  ["src/lib/animal-photo.functions.ts", "recepcao.cadastros.visualizar"],
];
for (const [caminho, codigo] of casos) {
  const source = fs.readFileSync(caminho, "utf8");
  assert.ok(source.includes("exigirPermissaoClinica("), `Endpoint sem guarda: ${caminho}`);
  assert.ok(source.includes(codigo), `Permissão não mapeada: ${caminho}`);
}
console.log("Verificação estrutural das guardas de endpoints passou.");
