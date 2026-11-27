import assert from "node:assert/strict";
import test from "node:test";
import {
  calcularDiferencaInventario,
  calcularReposicao,
  interpretarContagem,
} from "../src/lib/inventario-estoque.ts";

test("contagem distingue zero de campo vazio e aceita até três casas", () => {
  assert.equal(interpretarContagem("0"), 0);
  assert.equal(interpretarContagem(" 1,250 "), 1.25);
  assert.equal(interpretarContagem("999999999,999"), 999999999.999);
  for (const texto of ["", " ", "-1", "NaN", "Infinity", "12abc", "2,9999", "1000000000"])
    assert.equal(interpretarContagem(texto), null, texto);
});

test("diferença desconhecida não vira entrada presumida no histórico de inventário", () => {
  assert.equal(calcularDiferencaInventario(null, 15), null);
  assert.equal(calcularDiferencaInventario(12.7, 12.4), -0.3);
  assert.equal(calcularDiferencaInventario(10, 10), 0);
  assert.equal(calcularDiferencaInventario(0, 12), 12);
});

const produto = {
  quantidade: 14,
  dias: 7,
  estoque_atual: 6,
  estoque_minimo: 2,
  venda_por_peso: false,
};
test("reposição usa cobertura explícita, mínimo e saldo, sem pedido automático", () => {
  assert.deepEqual(calcularReposicao(produto, 7), { tipo: "observado", repor: 8, media: 2 });
  assert.deepEqual(calcularReposicao({ ...produto, estoque_minimo: 20 }, 7), {
    tipo: "observado",
    repor: 14,
    media: 2,
  });
  assert.deepEqual(calcularReposicao({ ...produto, estoque_atual: 50 }, 7), {
    tipo: "observado",
    repor: 0,
    media: 2,
  });
});

test("reposição não atribui sugestão sem quantidade medida ou saldo conhecido", () => {
  assert.equal(
    calcularReposicao({ ...produto, quantidade: 0, estoque_minimo: 30 }, 14).tipo,
    "sem-consumo",
  );
  assert.equal(
    calcularReposicao({ ...produto, quantidade: null, dias: 0 }, 14).tipo,
    "sem-consumo",
  );
  assert.equal(calcularReposicao({ ...produto, estoque_atual: null }, 14).tipo, "sem-saldo");
  assert.equal(calcularReposicao({ ...produto, dias: 6 }, 14).tipo, "sem-consumo");
  assert.equal(calcularReposicao({ ...produto, estoque_atual: 0 }, 7).tipo, "observado");
});

test("reposição arredonda para unidade inteira ou milésimo de quilo", () => {
  assert.deepEqual(
    calcularReposicao(
      {
        ...produto,
        dias: 9,
        quantidade: 3,
        estoque_atual: 0,
        estoque_minimo: null,
        venda_por_peso: true,
      },
      7,
    ),
    { tipo: "observado", repor: 2.334, media: 3 / 9 },
  );
  assert.deepEqual(
    calcularReposicao(
      {
        ...produto,
        dias: 9,
        quantidade: 3,
        estoque_atual: 0,
        estoque_minimo: null,
      },
      7,
    ),
    { tipo: "observado", repor: 3, media: 3 / 9 },
  );
});
