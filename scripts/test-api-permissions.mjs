import assert from "node:assert/strict";
import fs from "node:fs";

const helper = fs.readFileSync("src/lib/permissao-clinica.server.ts", "utf8");
for (const token of [
  'status !== "ativa"', 'excluido_em', 'eq("ativo", true)',
  '"oricse_permissoes_efetivas"', 'p.permitido === true',
  'createClient(', 'Authorization:', 'accessToken',
]) assert.ok(helper.includes(token), `Guarda ausente: ${token}`);
assert.ok(!helper.includes('await admin.rpc('),
  "Permissões devem ser consultadas com JWT do funcionário, não service role");

const casos = [
  ["src/lib/agenda.functions.ts", "recepcao.agenda"],
  ["src/lib/clinic-logo.functions.ts", "administracao.site"],
  ["src/lib/animal-photo.functions.ts", "recepcao.cadastros.visualizar"],
  ["src/lib/agenda-politicas.functions.ts", "recepcao.agenda"],
  ["src/lib/politicas-operacionais.functions.ts", "administracao.configuracoes"],
  ["src/lib/indicadores-painel.functions.ts", "caixa.financeiro.visualizar"],
];
for (const [caminho, codigo] of casos) {
  const source = fs.readFileSync(caminho, "utf8");
  assert.ok(source.includes("exigirPermissaoClinica("), `Endpoint sem guarda: ${caminho}`);
  assert.ok(source.includes(codigo), `Permissão não mapeada: ${caminho}`);
  assert.ok(source.includes("data.accessToken)"), `JWT ausente na guarda: ${caminho}`);
}
console.log("Guarda de JWT/plano/cargo aplicada a seis endpoints.");
