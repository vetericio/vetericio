import assert from "node:assert/strict";
import test from "node:test";
import {
  encontrarServicoConsulta,
  SERVICO_CONSULTA_PADRAO,
  sugerirValorDaConsulta,
  valorFixoDoCatalogo,
} from "../src/lib/consulta-catalogo.ts";

test("Consulta é um serviço padrão, não um produto ou retorno", () => {
  const produto = { tipo: "produto", nome: "Consulta" } as const;
  const retorno = { tipo: "servico", nome: "Consulta de retorno" } as const;
  const veterinaria = { tipo: "servico", nome: "  CONSULTA   VETERINÁRIA " } as const;
  assert.equal(encontrarServicoConsulta([produto, retorno]), undefined);
  assert.equal(encontrarServicoConsulta([produto, retorno, veterinaria]), veterinaria);
  assert.equal(
    encontrarServicoConsulta([veterinaria, SERVICO_CONSULTA_PADRAO]),
    SERVICO_CONSULTA_PADRAO,
  );
  const consultaCanonica = { ...veterinaria, canonico: true } as const;
  assert.equal(
    encontrarServicoConsulta([SERVICO_CONSULTA_PADRAO, consultaCanonica]),
    consultaCanonica,
  );
  assert.equal(SERVICO_CONSULTA_PADRAO.categoria, "Consultas");
  assert.ok(!("valor" in SERVICO_CONSULTA_PADRAO));
});

test("Preço fixo configurado aparece na comanda e reflete alterações do serviço", () => {
  assert.equal(sugerirValorDaConsulta({ valorCatalogo: 175, usaFaixas: false }), "175,00");
  assert.equal(sugerirValorDaConsulta({ valorCatalogo: "208.50", usaFaixas: false }), "208,50");
  assert.equal(
    sugerirValorDaConsulta({ valorCatalogo: 200, usaFaixas: false, valorEditado: "175,00" }),
    "175,00",
  );
  assert.equal(
    sugerirValorDaConsulta({ valorCatalogo: 200, usaFaixas: false, valorEditado: "" }),
    "",
  );
});

test("não converte ausência em preço zero, mas permite zero explícito", () => {
  for (const valor of [null, undefined, "", "  ", Number.NaN, Infinity, -1, "inválido"]) {
    assert.equal(valorFixoDoCatalogo(valor), "");
  }
  assert.equal(valorFixoDoCatalogo(0), "0,00");
});

test("preço por faixa só preenche com aprovação, nunca com preço fixo ou manual anterior", () => {
  assert.equal(
    sugerirValorDaConsulta({ valorCatalogo: 175, usaFaixas: true, valorEditado: "165,00" }),
    "",
  );
  assert.equal(
    sugerirValorDaConsulta({ valorCatalogo: 175, usaFaixas: true, valorComAprovacao: "220,00" }),
    "220,00",
  );
});
