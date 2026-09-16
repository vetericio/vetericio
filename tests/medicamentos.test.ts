import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calcularEntrada, calcularDose, calcularDosePeloVolume,
  UNIDADES_DOSE, UNIDADES_CONCENTRACAO, interpretarUnidadeDose,
  interpretarConcentracao, numero, doseDaEspecie, medicamentoVazio, textoDecimal,
} from "../src/lib/medicamentos.ts";

const base = {
  peso: "12,5", dose: "3", quantidade: "", origem: "dose" as const,
  unidadeDose: "mg/kg", concentracaoValor: "50", concentracaoUnidade: "mg/mL",
};
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-8 * Math.max(1, Math.abs(b)), `${a} != ${b}`);

test("dose por kg, total e volume são grandezas distintas", () => {
  const r = calcularEntrada(base);
  assert.equal(r.quantidade, "0,75");
  assert.ok(r.resultado.ok);
  assert.equal(r.resultado.doseTotal, 37.5);
  assert.equal(r.resultado.doseTotalTexto, "37,5 mg");
  for (const [volume, dose, total] of [["0,75", 3, 37.5], ["0.99", 3.96, 49.5], ["1", 4, 50], ["1,0", 4, 50], ["1.0", 4, 50], ["1.2", 4.8, 60]] as const) {
    const inv = calcularEntrada({ ...base, origem: "quantidade", quantidade: volume });
    assert.equal(inv.quantidade, volume);
    near(numero(inv.dose)!, dose);
    assert.ok(inv.resultado.ok);
    near(inv.resultado.doseTotal, total);
  }
});

test("apagar não restaura valor antigo; ponto/vírgula e estados intermediários", () => {
  for (const origem of ["dose", "quantidade"] as const) {
    const r = calcularEntrada({ ...base, origem, dose: "", quantidade: "" });
    assert.equal(r.dose, "");
    assert.equal(r.quantidade, "");
    assert.equal(r.resultado.ok, false);
  }
  for (const valor of ["1", "1,", "1.", "0,25", "0.25", ".25", ",25"]) {
    const r = calcularEntrada({ ...base, dose: valor });
    assert.equal(r.dose, valor);
    assert.ok(r.resultado.ok);
  }
  for (const valor of ["-", "abc", "1,2,3", "1.2.3", "Infinity", "NaN", "1e3", "0x10", "-1"]) {
    assert.equal(calcularEntrada({ ...base, dose: valor }).resultado.ok, false);
  }
});

test("peso recalcula o campo derivado, mantendo o campo editado", () => {
  assert.equal(calcularEntrada({ ...base, peso: "25" }).quantidade, "1,5");
  assert.equal(calcularEntrada({ ...base, peso: "25", origem: "quantidade", quantidade: "1" }).dose, "2");
  for (const peso of ["", "0", "-1", "abc"]) {
    assert.equal(calcularEntrada({ ...base, peso }).resultado.ok, false);
  }
  assert.ok(calcularEntrada({ ...base, peso: "", unidadeDose: "mg/animal" }).resultado.ok);
});

test("todas as combinações de unidades cadastráveis: ida e volta", () => {
  let compativeis = 0;
  for (const unidadeDose of UNIDADES_DOSE) {
    const d = interpretarUnidadeDose(unidadeDose)!;
    for (const concentracaoUnidade of UNIDADES_CONCENTRACAO) {
      const c = interpretarConcentracao("75", concentracaoUnidade)!;
      const p = { ...base, dose: "0.25", unidadeDose, concentracaoValor: "75", concentracaoUnidade };
      const ida = calcularEntrada(p);
      if (d.grandeza !== "volume" && d.grandeza !== c.grandeza) {
        assert.equal(ida.resultado.ok, false);
        continue;
      }
      assert.ok(ida.resultado.ok);
      const total = 0.25 * (d.porAnimal ? 1 : 12.5);
      const esperado = d.grandeza === "volume" ? total : total * d.fator / c.porUnidade;
      near(ida.resultado.volume, esperado);
      const volta = calcularEntrada({ ...p, origem: "quantidade", quantidade: textoDecimal(ida.resultado.volume) });
      assert.ok(volta.resultado.ok, unidadeDose + " / " + concentracaoUnidade);
      assert.ok(Math.abs(numero(volta.dose)! - 0.25) < 0.00001);
      compativeis++;
    }
  }
  assert.ok(compativeis > 100);
});

test("concentração ausente/incompatível não inventa conversão", () => {
  for (const concentracaoValor of ["", "0", "-5", "errado"]) {
    assert.equal(calcularEntrada({ ...base, concentracaoValor }).resultado.ok, false);
  }
  assert.equal(calcularEntrada({ ...base, concentracaoUnidade: "UI/mL" }).resultado.ok, false);
  assert.ok(calcularEntrada({ ...base, unidadeDose: "mL/kg", concentracaoValor: "" }).resultado.ok);
  assert.equal(calcularDosePeloVolume({ ...base, volume: "1", concentracaoUnidade: "mg/comprimido" }).ok, false);
});

test("não arredonda uma dose pequena a zero nem muda comprimidos", () => {
  const r = calcularDose({ ...base, dose: "0.001", peso: "1" });
  assert.ok(r.ok);
  assert.equal(r.volumeTexto, "0,00002");
  const cp = calcularEntrada({ ...base, concentracaoUnidade: "mg/comprimido", dose: "2.2" });
  assert.equal(cp.quantidade, "0,55");
});

test("dose unificada usa cadastro comum em cão e gato", () => {
  const m = medicamentoVazio();
  m.cao.doseMin = "3";
  m.gato.doseMin = "9";
  assert.equal(doseDaEspecie(m, "gato").doseMin, "3");
  m.doseUnificada = false;
  assert.equal(doseDaEspecie(m, "gato").doseMin, "9");
});
