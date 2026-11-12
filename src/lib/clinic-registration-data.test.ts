import assert from "node:assert/strict";
import { test } from "node:test";
import { originalRegistrationData, registrationValue } from "./clinic-registration-data";

test("preserva CRMV, UF e campos opcionais do formulário original", () => {
  const data = originalRegistrationData({
    responsavel_crmv: "999",
    dados: {
      responsavel_crmv: "12345",
      responsavel_crmv_uf: "MG",
      responsavel_complemento: "Sala 2",
      clinica_complemento: "Loja 3",
    },
  });
  assert.equal(data.responsavel_crmv, "12345");
  assert.equal(data.responsavel_crmv_uf, "MG");
  assert.equal(data.responsavel_complemento, "Sala 2");
  assert.equal(data.clinica_complemento, "Loja 3");
});
test("usa colunas persistidas quando não existe campo no payload antigo", () => {
  assert.equal(
    originalRegistrationData({ responsavel_crmv: "2468", dados: {} }).responsavel_crmv,
    "2468",
  );
});
test("não inventa dados ausentes e preserva zero e recusas", () => {
  for (const value of [null, undefined, "", "  "])
    assert.equal(registrationValue(value), "Não informado");
  assert.equal(registrationValue(0), "0");
  assert.equal(registrationValue(false), "Não");
});
test("preserva também campos adicionais de contratações anteriores", () => {
  assert.equal(
    originalRegistrationData({ dados: { campo_anterior: "valor original" } }).campo_anterior,
    "valor original",
  );
});
