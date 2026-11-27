import { strictEqual } from "node:assert";
import { test } from "node:test";
import {
  lerValorConferencia,
  pagamentoEmCartao,
  situacaoConferencia,
} from "../src/lib/conferencia-cartoes";
test("aceita somente quantias monetárias explícitas e preserva centavos", () => {
  strictEqual(lerValorConferencia("123,45"), 12345);
  strictEqual(lerValorConferencia(" 9.7 "), 970);
  strictEqual(lerValorConferencia("0"), 0);
  for (const x of ["", "-1", "1.000,01", "1,695", "1e5", "R$ 2"])
    strictEqual(lerValorConferencia(x), null, x);
});
test("não mistura outras formas com cartão e mantém divergências", () => {
  for (const x of ["Cartão", "Crédito", "Débito", "Cartão de débito", " Cartão de crédito "])
    strictEqual(pagamentoEmCartao(x), true);
  for (const x of ["Pix", "Dinheiro", "Transferência", "Boleto", "Débito da equipe"])
    strictEqual(pagamentoEmCartao(x), false);
  strictEqual(situacaoConferencia(), "Pendente");
  strictEqual(
    situacaoConferencia({ recebido_centavos: 990, liquido_esperado_centavos: 990 }),
    "Conciliado",
  );
  strictEqual(
    situacaoConferencia({ recebido_centavos: 1000, liquido_esperado_centavos: 990 }),
    "Divergente",
  );
});
