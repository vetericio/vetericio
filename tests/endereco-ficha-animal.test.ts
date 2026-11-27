import assert from "node:assert/strict";
import test from "node:test";
import {
  caminhoInternoDaFicha,
  ehEnderecoFichaAnimal,
  idAnimalDaFicha,
  mostrarEnderecoDaFichaNoHost,
  slugEnderecoFichaAnimal,
  slugParaLinkDaFicha,
} from "../src/lib/endereco-ficha-animal.ts";

test("reconhece apenas a ficha com um endereço de clínica válido", () => {
  assert.equal(ehEnderecoFichaAnimal("vetericio", "animal"), true);
  assert.equal(ehEnderecoFichaAnimal("clinica-bh", "agenda"), false);
  assert.equal(slugEnderecoFichaAnimal("clinica-bh"), "clinica-bh");
  for (const slug of [
    "pet",
    "vet",
    "c",
    "contrato",
    "admin",
    "admin-config",
    "api",
    "assets",
    "../outro",
    "%2fadmin",
    "clínica",
    "",
  ]) {
    assert.equal(slugEnderecoFichaAnimal(slug), null, slug);
  }
});

test("o endereço novo usa a mesma permissão e o mesmo layout da ficha antiga", () => {
  for (const path of ["/vetericio/animal", "/clinica-bh/animal/", "/animal"]) {
    assert.equal(caminhoInternoDaFicha(path), "/animal");
  }
  for (const path of [
    "/portal-tutores",
    "/vet/animal",
    "/pet/animal",
    "/c/animal",
    "/api/animal",
    "/contrato/animal",
    "/admin/animal",
    "/clinica-bh/animal/outro",
  ]) {
    assert.equal(caminhoInternoDaFicha(path), path);
  }
});

test("endereço novo não aceita identificações inválidas e endereços de domínios personalizados preservam a ficha legada", () => {
  assert.equal(
    idAnimalDaFicha("00000000-0000-4000-8000-000000000003"),
    "00000000-0000-4000-8000-000000000003",
  );
  for (const id of [undefined, "animalId", [], "", "//www.example.test"])
    assert.equal(idAnimalDaFicha(id), null);
  assert.equal(mostrarEnderecoDaFichaNoHost("oricse.com.br"), true);
  assert.equal(mostrarEnderecoDaFichaNoHost("vetericio.oricse.com.br"), false);
});

test("o primeiro link direto exige clínica da lista, permissão efetiva e endereço válidos", () => {
  const ativo = {
    hostname: "oricse.com.br",
    animalId: "00000000-0000-4000-8000-000000000003",
    clinicaDaLista: "id-clinica-ativa",
    clinicaAtiva: "id-clinica-ativa",
    slugAtivo: "clinica-bh",
    podeAbrirFicha: true,
  };
  assert.equal(slugParaLinkDaFicha(ativo), "clinica-bh");
  assert.equal(slugParaLinkDaFicha({ ...ativo, clinicaDaLista: "outra-clinica" }), null);
  assert.equal(slugParaLinkDaFicha({ ...ativo, clinicaDaLista: "", clinicaAtiva: "" }), null);
  assert.equal(slugParaLinkDaFicha({ ...ativo, podeAbrirFicha: false }), null);
  assert.equal(slugParaLinkDaFicha({ ...ativo, slugAtivo: "" }), null);
  assert.equal(slugParaLinkDaFicha({ ...ativo, slugAtivo: "pet" }), null);
  assert.equal(slugParaLinkDaFicha({ ...ativo, animalId: "registro-legado" }), null);
  assert.equal(slugParaLinkDaFicha({ ...ativo, hostname: "clinica-bh.oricse.com.br" }), null);
});
