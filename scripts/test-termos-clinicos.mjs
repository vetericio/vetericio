import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";

// Testa o código de produção, sem cópia das regras.
const { outputFiles } = await build({
  entryPoints: ["src/lib/termos-clinicos-validacao.ts"],
  bundle: true, platform: "node", format: "esm", target: "node22",
  write: false, tsconfig: "tsconfig.json", logLevel: "silent",
});
const lib = await import("data:text/javascript;base64," +
  Buffer.from(outputFiles[0].text).toString("base64"));
const { BIBLIOTECA_TERMOS, CAMPOS_TERMOS, cpfValidoTermo, pendenciasTermo, prepararConteudoTermo } = lib;
assert.equal(BIBLIOTECA_TERMOS.length, 14, "Deve haver exatamente 14 termos");
assert.equal(new Set(BIBLIOTECA_TERMOS.map(v => v.id)).size, 14, "IDs devem ser únicos");
assert.equal(Object.keys(CAMPOS_TERMOS).length, 14);

assert.equal(cpfValidoTermo("529.982.247-25"), true);
assert.equal(cpfValidoTermo("52998224725"), true);
for (const valor of ["111.111.111-11", "52998224726", "00000000000", "123", ""]) {
  assert.equal(cpfValidoTermo(valor), false, "CPF inválido aceito: " + valor);
}
const ident = {
  paciente: "Luna", especie: "Canina", tutor: "Marina Exemplo", cpf: "529.982.247-25",
  enderecoTutor: "Rua Exemplo, 24, Centro, Belo Horizonte/MG, CEP 30000-000",
  enderecoTutorCompleto: true, veterinario: "Dra. Ana Exemplo", crmv: "CRMV-MG 12345",
  clinica: "Clínica Fictícia", data: "20/11/2026",
};
function dados(tipo) {
  const campos = Object.fromEntries(CAMPOS_TERMOS[tipo].map(c => [c.id, "Orientação do caso, riscos e conduta."]));
  if (tipo === "rcp") campos.decisao = "reanimar";
  if (tipo === "domiciliar") campos.procedimentos = "Consulta clínica e exame físico";
  return {tipo,campos,identificacao:{...ident},recusaAssinatura:false};
}
for (const termo of BIBLIOTECA_TERMOS) {
  const caso = dados(termo.id);
  assert.deepEqual(pendenciasTermo(caso), [], "Há campos não contemplados: " + termo.id);
  const texto = prepararConteudoTermo(caso);
  assert(texto.includes("INFORMAÇÕES CLÍNICAS ESPECÍFICAS"), "Sem seção clínica: " + termo.id);
  assert(texto.includes(ident.tutor) && texto.includes(ident.veterinario), "Identidade não preenchida: " + termo.id);
  assert(!/\{\{[^{}]+\}\}/.test(texto), "Placeholders pendentes: " + termo.id);
  const necessario = CAMPOS_TERMOS[termo.id].find(c => c.obrigatorio);
  assert(necessario, "Termo sem campo obrigatório: " + termo.id);
  delete caso.campos[necessario.id];
  assert(pendenciasTermo(caso).length > 0, "Não bloqueou campo vazio: " + termo.id);
}
const recusa = dados("retirada-sem-alta");
recusa.recusaAssinatura = true;
assert(pendenciasTermo(recusa).some(e => e.includes("testemunhas")));
recusa.campos.testemunha1 = "Testemunha 1, CPF fictício, assinatura presencial";
recusa.campos.testemunha2 = "Testemunha 2, CPF fictício, assinatura presencial";
assert.deepEqual(pendenciasTermo(recusa), []);
const rcp = dados("rcp");
rcp.campos.decisao = "";
assert(pendenciasTermo(rcp).some(e=>e.includes("Decisão")));
rcp.campos.decisao = "nao_reanimar";
assert(prepararConteudoTermo(rcp).includes("(X) Solicito"));
const domiciliar = dados("domiciliar");
domiciliar.campos.procedimentos = "Transfusão sanguínea domiciliar";
assert(pendenciasTermo(domiciliar).some(e=>e.includes("vedado")));
const cpf = dados("cirurgia");cpf.identificacao.cpf = "111.111.111-11";
assert(pendenciasTermo(cpf).some(e=>e.includes("CPF válido")));
const endereco = dados("cirurgia");endereco.identificacao.enderecoTutorCompleto = false;
assert(pendenciasTermo(endereco).some(e=>e.includes("Endereço completo")));
const gate = await readFile("src/lib/termos-clinicos-status.ts","utf8");
assert.match(gate,/TERMOS_CLINICOS_HOMOLOGADOS = false;/,"Novos termos não devem ser liberados sem homologação");
console.log("OK: 14 modelos, CPF, campos obrigatórios, RCP, testemunhas, domicílio e gate de publicação.");
