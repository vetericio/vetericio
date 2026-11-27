import assert from "node:assert/strict";
import test from "node:test";
import { diaNoFuso, somarDias } from "../src/lib/relatorios.ts";
import {
  camposPendentesCompra,
  listarComprasControladosSchema,
  salvarCompraControladoSchema,
} from "../src/lib/compras-controlados.ts";

const base = {
  accessToken: "token-ficticio-apenas-para-teste",
  clinicaId: "00000000-0000-4000-8000-000000000001",
  produtoId: "00000000-0000-4000-8000-000000000002",
  dataCompra: "2024-02-29",
  finalizar: false,
};

test("rascunho exige produto e data válida, mas não exige preenchimento dos demais campos", () => {
  const rascunho = salvarCompraControladoSchema.parse(base);
  assert.equal(rascunho.quantidade, null);
  assert.deepEqual(camposPendentesCompra(rascunho), [
    "Quantidade",
    "Fornecedor",
    "Nota fiscal",
    "Lote",
  ]);
  assert.equal(
    salvarCompraControladoSchema.safeParse({ ...base, dataCompra: "2025-02-29" }).success,
    false,
  );
  assert.equal(salvarCompraControladoSchema.safeParse({ ...base, produtoId: "" }).success, false);
  assert.equal(
    salvarCompraControladoSchema.safeParse({
      ...base,
      dataCompra: somarDias(diaNoFuso(new Date().toISOString()), 1),
    }).success,
    false,
  );
});

test("finalização valida quantidade positiva e conserva zeros à esquerda de nota e lote", () => {
  assert.equal(salvarCompraControladoSchema.safeParse({ ...base, finalizar: true }).success, false);
  const completo = {
    ...base,
    finalizar: true,
    quantidade: 1.234,
    fornecedor: " Fornecedor ",
    notaFiscal: "0001",
    lote: "002",
  };
  const dados = salvarCompraControladoSchema.parse(completo);
  assert.equal(dados.fornecedor, "Fornecedor");
  assert.equal(dados.notaFiscal, "0001");
  assert.equal(dados.lote, "002");
  assert.deepEqual(camposPendentesCompra(dados), []);
  for (const quantidade of [0, -1, 0.0001, Infinity, NaN]) {
    assert.equal(
      salvarCompraControladoSchema.safeParse({ ...completo, quantidade }).success,
      false,
    );
  }
  assert.equal(
    salvarCompraControladoSchema.safeParse({ ...completo, notaFiscal: "  \t " }).success,
    false,
  );
});

test("relatório aceita datas opcionais, exige ordenação e mantém a opção de pendências", () => {
  assert.ok(listarComprasControladosSchema.safeParse({ ...base, somentePendencias: true }).success);
  assert.ok(listarComprasControladosSchema.safeParse({ ...base, inicio: "2024-02-29" }).success);
  assert.equal(
    listarComprasControladosSchema.safeParse({ ...base, inicio: "2024-03-01", fim: "2024-02-29" })
      .success,
    false,
  );
});
