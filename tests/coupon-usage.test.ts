import { expect, test } from "bun:test";
import { contratacaoConsomeCupom } from "../src/lib/coupon-usage";

const isenta = {
  status: "isento_aguardando_aprovacao",
  valor_total: 0,
  promo_codigo: "TESTE100",
  promo_valor_original: 100,
  promo_desconto: 100,
  promo_valor_final: 0,
  pagamento_aprovado_em: null,
};

test("cupom 100% consome uso ao receber contratação sem pagamento", () => {
  expect(contratacaoConsomeCupom(isenta)).toBe(true);
  expect(contratacaoConsomeCupom({ ...isenta, status: "em_configuracao" })).toBe(true);
  expect(contratacaoConsomeCupom({ ...isenta, status: "ativada" })).toBe(true);
});

test("não consome cupom ao apenas aguardar pagamento nem em pedidos recusados", () => {
  expect(contratacaoConsomeCupom({ ...isenta, status: "aguardando_pagamento" })).toBe(false);
  expect(contratacaoConsomeCupom({ ...isenta, status: "recusada" })).toBe(false);
  expect(contratacaoConsomeCupom({ ...isenta, status: "cancelada" })).toBe(false);
  expect(contratacaoConsomeCupom({ ...isenta, promo_valor_final: 20 })).toBe(false);
  expect(contratacaoConsomeCupom({ ...isenta, promo_valor_original: 0 })).toBe(false);
});

test("pagamento aprovado consome uso, mesmo sem isenção integral", () => {
  expect(contratacaoConsomeCupom({
    status: "pagamento_aprovado",
    pagamento_aprovado_em: "2026-11-09T12:00:00Z",
    valor_total: 99,
    promo_codigo: "TESTE10",
    promo_valor_original: 110,
    promo_desconto: 11,
    promo_valor_final: 99,
  })).toBe(true);
});
