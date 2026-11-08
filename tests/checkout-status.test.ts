import { expect, test } from "bun:test";
import {
  STATUS_AGUARDANDO_PAGAMENTO,
  STATUS_ISENTO_AGUARDANDO_APROVACAO,
  statusDaContratacao,
} from "../src/lib/checkout-status";

test("só encaminha para análise uma isenção integral com cupom", () => {
  expect(statusDaContratacao("BEMVINDO100", 0)).toBe(
    STATUS_ISENTO_AGUARDANDO_APROVACAO,
  );
  expect(statusDaContratacao("  BEMVINDO100  ", 0)).toBe(
    STATUS_ISENTO_AGUARDANDO_APROVACAO,
  );
});

test("mantém cobrança pendente sem cupom integral", () => {
  expect(statusDaContratacao(undefined, 0)).toBe(
    STATUS_AGUARDANDO_PAGAMENTO,
  );
  expect(statusDaContratacao("DESCONTO10", 89.91)).toBe(
    STATUS_AGUARDANDO_PAGAMENTO,
  );
});
