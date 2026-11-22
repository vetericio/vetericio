import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";
import { jsPDF } from "jspdf";

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
  if (termo.texto.includes("{{tutor}}")) assert(texto.includes(ident.tutor), "Responsável não preenchido: " + termo.id);
  if (termo.texto.includes("{{veterinario}}")) assert(texto.includes(ident.veterinario), "Veterinário não preenchido: " + termo.id);
  assert(!/\{\{[^{}]+\}\}/.test(texto), "Placeholders pendentes: " + termo.id);
  const necessario = CAMPOS_TERMOS[termo.id].find(c => c.obrigatorio);
  assert(necessario, "Termo sem campo obrigatório: " + termo.id);
  delete caso.campos[necessario.id];
  assert(pendenciasTermo(caso).length > 0, "Não bloqueou campo vazio: " + termo.id);
}
const recusa = dados("retirada-sem-alta");
recusa.recusaAssinatura = true;
delete recusa.campos.testemunha1;
delete recusa.campos.testemunha2;
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
// Paginação realista de todos os 14 textos com os mesmos cálculos do gerador.
// Conferir também casos grandes: nunca gerar a última página só com assinatura.
const { outputFiles: arquivosPaginacao } = await build({
  entryPoints: ["src/lib/paginacao-assinaturas.ts"],
  bundle: true, platform: "node", format: "esm", target: "node22",
  write: false, tsconfig: "tsconfig.json", logLevel: "silent",
});
const { quebrarAntesDaLinhaFinal } = await import("data:text/javascript;base64," +
  Buffer.from(arquivosPaginacao[0].text).toString("base64"));
const largura = 210 - 2 * 13;
for (const termo of BIBLIOTECA_TERMOS) {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const base = prepararConteudoTermo(dados(termo.id));
  for (const texto of [
    base,
    base + "\n" + ("Acompanhamento, riscos e orientações individualizadas descritas na ficha. ".repeat(5) + "\n").repeat(30),
  ]) {
  for (const inicio of [123, 158, 215]) {
    const assinatura = 57;
    const planos = [
      { fonte: 10.5, passo: 5 }, { fonte: 10, passo: 4.75 },
      { fonte: 9.5, passo: 4.5 }, { fonte: 9, passo: 4.3 },
    ].map(plano => {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(plano.fonte);
      return { ...plano, linhas: texto.split("\n").flatMap(paragrafo =>
        pdf.splitTextToSize(paragrafo || " ", largura)) };
    });
    const plano = planos.find(v => inicio + v.linhas.length * v.passo + assinatura <= 273)
      ?? planos[planos.length - 1];
    let y = inicio;
    let textoNaUltimaPagina = 0;
    for (let i = 0; i < plano.linhas.length; i++) {
      if (quebrarAntesDaLinhaFinal({
        y, linhasRestantes: plano.linhas.length - i,
        passo: plano.passo, reservaAssinaturas: assinatura,
      })) {
        y = 60; // nova página, com cabeçalho e identificação da via
        textoNaUltimaPagina = 0;
      }
      y += plano.passo;
      textoNaUltimaPagina++;
    }
    assert(textoNaUltimaPagina >= Math.min(4, plano.linhas.length), "Assinaturas sem trecho final do texto: " + termo.id);
    assert(y + assinatura <= 273, "Assinatura sem espaço no termo: " + termo.id);
  }
  }
}
// Regressão visual: todos os 14 títulos devem ser centralizados linha a linha.
const fonteGeradorPdf = await readFile("src/lib/modelos-documentos-pdf.ts", "utf8");
assert.match(fonteGeradorPdf, /pdf\.text\(linhaTitulo, centro, y, \{ align: "center" \}\)/,
  "O título de cada termo deve usar o centro real da página.");
assert.match(fonteGeradorPdf, /pdf\.splitTextToSize\(titulo \|\| " ", largura\)/,
  "O título longo deve quebrar linhas respeitando a largura do documento.");
for (const termo of BIBLIOTECA_TERMOS) {
  assert(/^termo\b/i.test(termo.titulo), "Título inesperado: " + termo.id);
  const amostra = new jsPDF({ unit: "mm", format: "a4" });
  amostra.setFont("helvetica", "bold");
  amostra.setFontSize(19);
  const linhasTitulo = amostra.splitTextToSize(termo.titulo, largura);
  assert(linhasTitulo.length >= 1, "Termo sem título: " + termo.id);
  assert(linhasTitulo.every(linha => amostra.getTextWidth(linha) <= largura + 0.5),
    "Título excede as margens: " + termo.id);
}
console.log("OK: títulos dos 14 termos centralizados, inclusive em múltiplas linhas.");
console.log("OK: 14 termos com assinaturas junto ao texto final (incluindo quebras e conteúdo longo).");
console.log("OK: 14 modelos, CPF, campos obrigatórios, RCP, testemunhas, domicílio e gate de publicação.");
