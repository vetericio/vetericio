import assert from "node:assert/strict";
import { test } from "node:test";
import {
  extrairAplicacoesPrevencao,
  montarRelatorioExames,
  montarRelatorioMedicacoes,
  montarRelatorioVacinas,
} from "../src/lib/relatorios-prevencao.ts";

const periodo = { inicio: "2026-11-23", fim: "2026-11-27" };

test("19 separa indicações e aplicações registradas sem presumir adesão", () => {
  const registros = JSON.stringify([
    {
      animal: "Nome privado",
      tutor: "Pessoa privada",
      medicacoes: [
        { nome: "Dipirona", aplicadoEm: "2026-11-24T00:04:00Z", observacao: "Texto privado" },
        { nome: "dipirona", aplicadoEm: "2026-11-28T02:59:59Z" },
        { nome: "Dia seguinte", aplicadoEm: "2026-11-28T03:00:00Z" },
        { nome: "Horário não é execução", horarioInicial: "18:00" },
        { nome: "Formato incompleto", aplicadoEm: "2026-11-26" },
        null,
      ],
    },
  ]);
  const aplicacoes = extrairAplicacoesPrevencao(registros);
  assert.deepEqual(
    aplicacoes.map((aplicacao) => aplicacao.dia),
    ["2026-11-23", "2026-11-27", "2026-11-28"],
  );
  const relatorio = montarRelatorioMedicacoes(
    [
      { data: "2026-11-23", campo: "Posologia privada" },
      { data: "2026-11-26", campo: "  " },
      { data: "2026-11-28", campo: "Fora do período" },
    ],
    aplicacoes,
    periodo,
  );
  assert.deepEqual(
    relatorio.indicadores.map((i) => i.valor),
    [1, 2, "Sem rastreio", "Sem rastreio"],
  );
  assert.deepEqual(relatorio.tabelas[1].linhas, [["Dipirona", 2]]);
  for (const dado of ["Nome privado", "Pessoa privada", "Texto privado", "Posologia privada"])
    assert.ok(!JSON.stringify(relatorio).includes(dado));
});

test("19 não apresenta JSON corrompido como ausência de aplicações", () => {
  assert.deepEqual(extrairAplicacoesPrevencao(undefined), []);
  assert.throws(() => extrairAplicacoesPrevencao("{"), /ler os registros/);
  assert.throws(() => extrairAplicacoesPrevencao("{}"), /Formato inválido/);
});

test("20 não usa ausência de PDF como laudo pendente nem transforma texto em quantidade de exames", () => {
  const relatorio = montarRelatorioExames(
    [
      { data: "2026-11-23", campo: "Hemograma · Observação privada" },
      { data: "2026-11-28", campo: "Não conta" },
    ],
    [
      { tipo: "Imagem", drive_arquivo_id: "id-privado" },
      { tipo: "imagem", drive_arquivo_id: null },
    ],
    periodo,
  );
  assert.deepEqual(
    relatorio.indicadores.map((i) => i.valor),
    [1, 2, 1, "Sem rastreio", "Sem rastreio"],
  );
  assert.deepEqual(relatorio.tabelas[1].linhas, [["Imagem", 2]]);
  for (const dado of ["Observação privada", "id-privado"])
    assert.ok(!JSON.stringify(relatorio).includes(dado));
});

test("21 considera a última aplicação por animal/vacina, inclusive quando o novo reforço não tem data", () => {
  const historico = [
    { animal_id: "A", nome: "V10", aplicada_em: "2025-10-01", reforco_em: "2026-10-01" },
    { animal_id: "A", nome: " v10 ", aplicada_em: "2026-11-23", reforco_em: "2026-11-27" },
    { animal_id: "A", nome: "V4", aplicada_em: "2025-11-01", reforco_em: "2026-11-01" },
    { animal_id: "A", nome: "V4", aplicada_em: "2026-11-24", reforco_em: null },
    { animal_id: "B", nome: "V10", aplicada_em: "2025-11-26", reforco_em: "2026-11-26" },
    { animal_id: "C", nome: "Antirrábica", aplicada_em: null, reforco_em: "2026-12-27" },
    { animal_id: "D", nome: "Fora de 30 dias", aplicada_em: null, reforco_em: "2026-12-28" },
    {
      animal_id: "E",
      nome: "Aplicação futura",
      aplicada_em: "2026-11-29",
      reforco_em: "2026-11-28",
    },
  ];
  const relatorio = montarRelatorioVacinas(historico, periodo, "2026-11-27");
  assert.deepEqual(
    relatorio.indicadores.map((i) => i.valor),
    [2, 1, 2, 1],
  );
  assert.deepEqual(relatorio.tabelas[1].linhas, [["V10", 1]]);
  assert.deepEqual(relatorio.tabelas[2].linhas, [
    ["27/11/2026", "v10", 1],
    ["27/12/2026", "Antirrábica", 1],
  ]);
});
