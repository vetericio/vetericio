import assert from "node:assert/strict";
import test from "node:test";
import {
  categoriaDocumento,
  referenciaGuardaReceita,
  montarRelatorioDocumentos,
  montarRelatorioMovimentos,
  montarRelatorioReceitas,
  type DocumentoRelatorio,
  type ReceitaRelatorio,
} from "../src/lib/relatorios-documentos.ts";

test("guarda soma cinco anos à emissão, sem depender da consulta", () => {
  assert.equal(referenciaGuardaReceita("2024-02-29"), "2029-03-01");
  assert.equal(referenciaGuardaReceita("2022-11-11"), "2027-11-11");
  assert.equal(referenciaGuardaReceita("2026-02-31"), null);
  assert.equal(referenciaGuardaReceita(""), null);
});

test("receitas exibem quem, qual e onde; ação usa ID da receita somente com vínculo do paciente", () => {
  const r: ReceitaRelatorio = {
    id: "receita",
    animal_id: "animal",
    tutor_id: "tutor",
    drive_arquivo_id: "id-arquivo-privado",
    emitida_em: "2026-11-14",
    numero: "2026-001",
    titulo: "Receituário",
    tipo: "especial",
    resumo: "Medicamento A",
    visivel_tutor: false,
    prescritor_nome: "Nome no documento",
    prescritor_crmv: "CRMV-MG 123",
  };
  const saida = montarRelatorioReceitas({
    receitas: [
      r,
      {
        ...r,
        id: "receita2",
        animal_id: "outro",
        tipo: "normal",
        visivel_tutor: true,
        prescritor_nome: null,
        prescritor_crmv: null,
      },
    ],
    autores: new Map([["receita", { nome: "Perfil atualizado", crmv: "CRMV-SP 456" }]]),
    animais: new Map([["animal", "Pet da ficha"]]),
    tutores: new Map([["tutor", "Tutor da emissão"]]),
    consultas: new Map([["animal", "2026-11-18"]]),
    pdfs: new Map([["id-arquivo-privado", "animal"]]),
    clinica: "Veterício",
  });
  const tabela = saida.tabelas[0];
  assert.deepEqual(Reflect.get(tabela, "pdfReceitas"), [{ linha: 0, documentoId: "receita" }]);
  assert.deepEqual(tabela.linhas[0], [
    "14/11/2026",
    "2026-001",
    "Receita de controle especial",
    "Receituário",
    "Medicamento A",
    "Pet da ficha",
    "Tutor da emissão",
    "Nome no documento",
    "CRMV-MG 123",
    "Veterício",
    "Prontuário interno",
    "PDF vinculado",
    "18/11/2026",
    "14/11/2031",
  ]);
  assert.equal(tabela.linhas[1][7], "Não identificado");
  assert.equal(tabela.linhas[1][10], "Prontuário e Portal do Tutor");
  assert.equal(tabela.linhas[1][11], "Sem PDF vinculado");
  assert.equal(saida.indicadores[0].valor, 2);
  assert.equal(saida.indicadores[1].valor, 1);
  assert.equal(saida.indicadores[2].valor, 1);
  assert.equal(saida.indicadores[3].valor, 0);
  assert.equal(tabela.linhas[1][13], "14/11/2031");
  assert.doesNotMatch(JSON.stringify(saida), /id-arquivo-privado|https?:\/\//);
});

test("movimentos gerais não provam compra, dispensação ou classificação regulatória", () => {
  const saida = montarRelatorioMovimentos([
    {
      id: "1",
      item_id: "1",
      item_nome: "Item A",
      tipo: "entrada",
      quantidade: 2.25,
      estoque_anterior: 0,
      estoque_posterior: 2.25,
      registrado_em: "2026-11-02T01:00:00Z",
    },
    {
      id: "2",
      item_id: null,
      item_nome: "Item B",
      tipo: "saida",
      quantidade: 1,
      estoque_anterior: 1,
      estoque_posterior: 0,
      registrado_em: "2026-11-02T13:00:00Z",
    },
  ]);
  assert.deepEqual(
    saida.indicadores.map((x) => x.valor),
    ["Não disponível", "Não disponível", 1, 1],
  );
  assert.deepEqual(saida.tabelas[0].linhas, [
    ["01/11/2026", "Item A", "Entrada", 2.25, 0, 2.25],
    ["02/11/2026", "Item B", "Saída", 1, 1, 0],
  ]);
  assert.match(saida.tabelas[0].titulo, /sem classificação regulatória/);
});

test("documentos distinguem os quatro tipos, não mostram prévias nem dados implícitos", () => {
  const r: DocumentoRelatorio = {
    id: "termo",
    animal_id: "animal",
    titulo: "Autorização",
    tipo: "Termo",
    data_documento: "2026-11-12",
    visivel_tutor: false,
    drive_arquivo_id: null,
  };
  const dados = montarRelatorioDocumentos(
    [
      r,
      { ...r, id: "atestado", titulo: "Atestado de saúde", tipo: "Documento clínico" },
      { ...r, id: "laudo", titulo: "Hemograma", tipo: "Laudo" },
      { ...r, id: "vacina", titulo: "Cartão de vacinação", tipo: "Documento" },
      { ...r, id: "doc", titulo: "Prévia fictícia", tipo: "Termo - Prévia demonstrativa" },
      { ...r, id: "outro", titulo: "Termômetro", tipo: "Outros" },
    ],
    new Map([["animal", "Paciente"]]),
    new Map(),
  );
  assert.deepEqual(
    dados.indicadores.map((x) => x.valor),
    [1, 1, 1, 1],
  );
  assert.deepEqual(
    dados.tabelas[0].linhas.map((x) => x[1]),
    ["Termo", "Atestado", "Laudo", "Comprovante"],
  );
  assert.equal(categoriaDocumento("Termo - Prévia demonstrativa", "Termo de internação"), null);
  assert.equal(categoriaDocumento("Outros", "Comprovante de vermifugação"), "Comprovante");
});

test("compras completas e pendentes são contadas à parte, sem converter estoque em compras", () => {
  const registro = {
    dataCompra: "2026-11-27",
    produtoNome: "Produto fictício",
    quantidade: 7,
    fornecedor: "Fornecedor fictício",
    notaFiscal: "NF 42",
    lote: "L1",
    autorNome: "Equipe",
    status: "completo" as const,
  };
  const dados = montarRelatorioMovimentos(
    [],
    [registro, { ...registro, quantidade: null, notaFiscal: null, status: "pendente" }],
  );
  assert.deepEqual(
    dados.indicadores.map((i) => i.valor),
    [1, 1, 0, 0],
  );
  assert.equal(dados.tabelas[0].linhas[0].at(-1), "Completo");
  assert.equal(dados.tabelas[0].linhas[1].at(-1), "Pendente");
  assert.equal(dados.tabelas[0].linhas[1][2], "—");
  assert.equal(dados.tabelas[1].linhas.length, 0);
  assert.deepEqual(
    montarRelatorioMovimentos([], []).indicadores.map((i) => i.valor),
    [0, 0, 0, 0],
  );
});
