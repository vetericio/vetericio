import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ehRegistroConsulta, resumirConsulta } from "../src/lib/resumo-consulta.ts";

describe("resumo da consulta", () => {
  const consulta = { titulo: "Consulta" };

  test("prioriza a queixa registrada e não inclui sinais, condutas ou receita", () => {
    assert.equal(
      resumirConsulta({
        ...consulta,
        dados: {
          queixa: "  Tosse há dois dias.\nTexto longo omitido.",
          suspeitas: "Exemplo",
          conduta: "Exemplo 2",
        },
        detalhe: "Queixa principal: Dado antigo\nMedicações / receita: informação fora da prévia",
      }),
      "Tosse há dois dias.",
    );
  });
  test("reconhece seções legadas sem acento e com valor na linha seguinte", () => {
    assert.equal(
      resumirConsulta({
        ...consulta,
        detalhe: "Queixa principal:\r\n  Retorno para reavaliação.\r\nHipoteses/suspeitas: Exemplo",
      }),
      "Retorno para reavaliação.",
    );
  });
  test("identifica suspeita como suspeita, mantendo negação", () => {
    assert.equal(
      resumirConsulta({
        ...consulta,
        dados: { queixa: "não informado" },
        detalhe: "Hipóteses / suspeitas: Sem suspeita de fratura",
      }),
      "Suspeita: Sem suspeita de fratura",
    );
  });
  test("usa a conduta se os campos anteriores não estiverem preenchidos", () => {
    assert.equal(
      resumirConsulta({
        ...consulta,
        dados: { queixa: "—", conduta: "Reavaliar na próxima visita" },
      }),
      "Conduta: Reavaliar na próxima visita",
    );
  });
  test("no histórico em texto antigo, usa só a primeira linha com conteúdo", () => {
    assert.equal(
      resumirConsulta({
        ...consulta,
        detalhe: "\nNão informado.\nConsulta de rotina.\nOutro assunto.",
      }),
      "Consulta de rotina.",
    );
  });
  test("limita o resumo sem inserir outra informação", () => {
    const valor =
      "Retorno para avaliação clínica e acompanhamento da evolução registrada pelo médico-veterinário.".repeat(
        3,
      );
    const resumo = resumirConsulta({ ...consulta, dados: { queixa: valor } });
    assert.ok(Array.from(resumo).length <= 96);
    assert.ok(resumo.endsWith("…"));
    assert.equal(valor.startsWith(resumo.slice(0, -1)), true);
  });
  test("sem conteúdo relevante, não exibe campos de outros tipos nem texto inventado", () => {
    for (const detalhe of [
      "",
      "Queixa principal: —",
      "Tutor relata: sem informações adicionais\nExame clínico: peso 10 kg",
    ]) {
      assert.equal(resumirConsulta({ ...consulta, detalhe }), "Sem resumo disponível.");
    }
  });
  test("distingue consulta de cirurgia e adendo", () => {
    assert.equal(ehRegistroConsulta(consulta), true);
    assert.equal(ehRegistroConsulta({ titulo: "Retorno", subtipo: "Consulta" }), true);
    assert.equal(ehRegistroConsulta({ titulo: "Consulta avulsa" }), true);
    assert.equal(
      ehRegistroConsulta({ titulo: "Cirurgia", subtipo: "Cirurgia / Procedimentos" }),
      false,
    );
    assert.equal(ehRegistroConsulta({ titulo: "Adendo · Consulta", subtipo: "Consulta" }), false);
    assert.equal(ehRegistroConsulta({ ...consulta, status: "adendo" }), false);
  });
});
