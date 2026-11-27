import assert from "node:assert/strict";
import test from "node:test";
import {
  codigoPublicoTutorComanda,
  filtrarTutoresComanda,
  ordenarTutoresComanda,
} from "../src/lib/tutor-comanda.ts";

const tutores = [
  { id: "4", nome: "Zélia Santos", codigo_publico: "#V000019" },
  { id: "2", nome: "João da Conceição", codigoPublico: "#V000008", cpf: "123privado" },
  { id: "3", nome: "João da Conceição", codigo_publico: "#V000003" },
  { id: "1", nome: "Ana Maria", codigo_publico: "#V000001" },
];

test("a busca combina partes em qualquer ordem sem distinguir acentos, caixa ou espaços", () => {
  assert.deepEqual(
    filtrarTutoresComanda(tutores, "  conceicao   JOAO ").map((p) => p.id),
    ["2", "3"],
  );
  assert.deepEqual(
    filtrarTutoresComanda(tutores, "zelia san").map((p) => p.id),
    ["4"],
  );
  assert.deepEqual(filtrarTutoresComanda(tutores, "  "), tutores);
  assert.deepEqual(filtrarTutoresComanda(tutores, "nome que não existe"), []);
});

test("homônimos continuam separados por ID e aparecem em ordem de código público", () => {
  const originais = tutores.map((p) => p.id);
  assert.deepEqual(
    ordenarTutoresComanda(tutores).map((p) => p.id),
    ["1", "3", "2", "4"],
  );
  assert.deepEqual(
    tutores.map((p) => p.id),
    originais,
  );
  assert.equal(codigoPublicoTutorComanda(tutores[1]), "#V000008");
  assert.equal(codigoPublicoTutorComanda(tutores[2]), "#V000003");
  assert.deepEqual(
    filtrarTutoresComanda(tutores, "joao v000003").map((p) => p.id),
    ["3"],
  );
  assert.deepEqual(filtrarTutoresComanda(tutores, "123privado"), []);
});

test("nenhum ID ou nome é criado a partir do texto digitado", () => {
  assert.deepEqual(filtrarTutoresComanda(tutores, "5"), []);
  assert.deepEqual(filtrarTutoresComanda([], "João"), []);
  assert.ok(filtrarTutoresComanda(tutores, "João").every((p) => tutores.includes(p)));
});
