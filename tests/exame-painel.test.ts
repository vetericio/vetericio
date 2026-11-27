import assert from "node:assert/strict";
import test from "node:test";
import {
  criarLinhasLab,
  especieLaboratorial,
  preencherReferenciasLab,
  salvarExameLabSchema,
  seriesLaboratoriais,
  unidadeComparavel,
  type ExameLab,
} from "../src/lib/exame-painel.ts";

const id = (n: number) => "00000000-0000-4000-8000-" + String(n).padStart(12, "0");
const exame: ExameLab = {
  id: id(1),
  consultaId: null,
  painel: "bioquimico",
  especie: "Cachorro",
  data: "2024-02-29",
  hora: "16:00",
  laboratorio: "Lab de exemplo",
  autor: "Perfil de exemplo",
  observacoes: "",
  temPdf: false,
  resultados: [
    { parametroId: "ureia", nome: "Ureia", valor: "10,8", unidade: "mg/dL", referencia: "5–18" },
  ],
};
test("Bioquímico mantém a ordem solicitada, sem aplicar faixas de imagem, e estende o catálogo existente", () => {
  assert.deepEqual(
    criarLinhasLab("bioquimico")
      .slice(0, 7)
      .map((l) => l.nome),
    [
      "Ureia",
      "Creatinina",
      "AST (TGO)",
      "ALT (TGP)",
      "Fosfatase alcalina",
      "GGT",
      "Proteínas totais",
    ],
  );
  assert.ok(criarLinhasLab("hemograma").some((l) => l.parametroId === "hematocrito"));
  assert.ok(criarLinhasLab("bioquimico").every((l) => !l.referencia));
});
test("referência combina a origem conhecida, espécie, parâmetro e unidade; faixa cadastrada prevalece", () => {
  const painel = criarLinhasLab("bioquimico");
  assert.ok(preencherReferenciasLab(painel, [], "Cachorro", "LabNet")[0].referencia);
  assert.equal(preencherReferenciasLab(painel, [], "Gato", "LabNet")[0].referencia, "");
  assert.ok(preencherReferenciasLab(painel, [], "Gato", "diagVet")[0].referencia);
  assert.ok(
    preencherReferenciasLab(criarLinhasLab("hemograma"), [], "Gato", "DiagVet").every(
      (l) => !l.referencia,
    ),
  );
  assert.ok(preencherReferenciasLab(painel, [], "Outra", "LabNet").every((l) => !l.referencia));
  assert.ok(
    preencherReferenciasLab(painel, [], "Cachorro", "Outro laboratório").every(
      (l) => !l.referencia,
    ),
  );
  assert.equal(
    preencherReferenciasLab(
      painel,
      [{ parametroId: "ureia", referencia: "17–22", unidade: "mg/dl" }],
      "Cachorro",
      "LabNet",
    )[0].referencia,
    "17–22",
  );
  assert.equal(
    preencherReferenciasLab([{ ...painel[0], unidade: "g/L" }], [], "Cachorro", "LabNet")[0]
      .referencia,
    "",
  );
  assert.equal(especieLaboratorial("Canina"), "Cachorro");
  assert.equal(especieLaboratorial("Felina"), "Gato");
  assert.equal(especieLaboratorial("Coelho"), "Outra");
});
test("evolução separa unidades incompatíveis e preserva a faixa de cada registro", () => {
  const resultado = exame.resultados[0];
  const posterior = (
    n: number,
    data: string,
    valor: string,
    unidade: string,
    referencia = "6–20",
  ) => ({
    ...exame,
    id: id(n),
    data,
    resultados: [{ ...resultado, valor, unidade, referencia }],
  });
  const series = seriesLaboratoriais([
    posterior(2, "2025-01-02", "4,5", " mg / dl "),
    posterior(3, "2025-01-03", "1", "mmol/L"),
    posterior(4, "2025-01-04", ">5", "mg/dL"),
    posterior(5, "2025-01-05", "12", ""),
    posterior(6, "2025-01-06", "1.000", "mg/dL"),
    exame,
  ]);
  assert.equal(series.length, 3);
  const serie = series.find((s) => unidadeComparavel(s.unidade) === "mg/dl")!;
  assert.deepEqual(
    serie.pontos.map((p) => p.numerico),
    [10.8, 4.5, null, null],
  );
  assert.deepEqual(
    serie.pontos.map((p) => p.referencia),
    ["5–18", "6–20", "6–20", "6–20"],
  );
  assert.equal(series.find((s) => s.unidade === "")?.pontos[0].numerico, null);
  assert.notEqual(unidadeComparavel("Mg/dL"), unidadeComparavel("mg/dL"));
});
test("rejeita datas inválidas e painel vazio ou duplicado; aceita resultado qualitativo", () => {
  const entrada = {
    ...exame,
    accessToken: "token-ficticio-somente-para-teste",
    clinicaId: id(2),
    animalId: id(3),
  };
  assert.ok(salvarExameLabSchema.safeParse(entrada).success);
  assert.ok(
    salvarExameLabSchema.safeParse({
      ...entrada,
      resultados: [{ ...exame.resultados[0], valor: "Negativo" }],
    }).success,
  );
  assert.equal(salvarExameLabSchema.safeParse({ ...entrada, resultados: [] }).success, false);
  assert.equal(
    salvarExameLabSchema.safeParse({
      ...entrada,
      resultados: [...exame.resultados, ...exame.resultados],
    }).success,
    false,
  );
  assert.equal(salvarExameLabSchema.safeParse({ ...entrada, data: "2025-02-29" }).success, false);
  assert.equal(salvarExameLabSchema.safeParse({ ...entrada, data: "2099-01-01" }).success, false);
});
