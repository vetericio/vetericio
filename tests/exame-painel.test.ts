import assert from "node:assert/strict";
import test from "node:test";
import {
  aplicarReferenciasDoLaboratorioLab,
  atualizarFaixaEtariaLab,
  faixaEtariaLaboratorial,
  referenciasDaIdadeLab,
  criarLinhasLab,
  resultadosConfirmadosLab,
  sugerirReferenciaLab,
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

test("o formulário sugere referências distintas para cão e gato sem depender de laboratório", () => {
  const painel = criarLinhasLab("bioquimico");
  const cao = painel.map((l) => sugerirReferenciaLab(l, "Cachorro", "12-meses-ou-mais"));
  const gato = painel.map((l) => sugerirReferenciaLab(l, "Gato", "12-meses-ou-mais"));
  assert.ok(cao.every((l) => l.referencia && l.origemReferencia === "sugestao"));
  assert.ok(gato.every((l) => l.referencia && l.origemReferencia === "sugestao"));
  assert.notEqual(cao[0].referencia, gato[0].referencia);
  assert.equal(cao.find((l) => l.parametroId === "ast")?.referencia, "21 – 45");
  assert.equal(gato.find((l) => l.parametroId === "ast")?.referencia, "26 – 43");
  assert.ok(
    criarLinhasLab("hemograma").some(
      (l) => sugerirReferenciaLab(l, "Gato", "12-meses-ou-mais").referencia,
    ),
  );
  assert.ok(painel.every((l) => !sugerirReferenciaLab(l, "Outra", "12-meses-ou-mais").referencia));
  assert.equal(
    sugerirReferenciaLab({ ...painel[0], unidade: "mmol/L" }, "Cachorro", "12-meses-ou-mais")
      .referencia,
    "",
  );
  assert.equal(
    sugerirReferenciaLab(
      { ...painel[0], parametroId: "personalizado-ureia" },
      "Cachorro",
      "12-meses-ou-mais",
    ).referencia,
    "",
  );
});

test("faixa do laudo prevalece; sugestões ficam fora do prontuário sem conferência", () => {
  const linhas = criarLinhasLab("bioquimico").map((l) =>
    sugerirReferenciaLab({ ...l, valor: "1" }, "Gato", "12-meses-ou-mais"),
  );
  linhas[1] = { ...linhas[1], referencia: "manual", origemReferencia: "manual" };
  const ajustadas = aplicarReferenciasDoLaboratorioLab(linhas, [
    { parametroId: "ureia", referencia: "8 – 15", unidade: "mg/dL" },
    { parametroId: "creatinina", referencia: "0,8 – 1,7", unidade: "mg/dL" },
    { parametroId: "ast", referencia: "20 – 40", unidade: "mmol/L" },
  ]);
  assert.equal(ajustadas[0].referencia, "8 – 15");
  assert.equal(ajustadas[1].referencia, "manual");
  assert.equal(ajustadas[2].origemReferencia, "sugestao");
  assert.deepEqual(
    resultadosConfirmadosLab(ajustadas.slice(0, 3), false).map((l) => l.referencia),
    ["8 – 15", "manual", ""],
  );
  assert.deepEqual(
    resultadosConfirmadosLab(ajustadas.slice(0, 3), true).map((l) => l.referencia),
    ["8 – 15", "manual", "26 – 43"],
  );
});

test("idade na data do exame impede sugestão de adulto para filhotes e idade desconhecida", () => {
  const linha = criarLinhasLab("bioquimico")[0];
  assert.equal(faixaEtariaLaboratorial("2026-01-08", "2027-01-07"), "menos-de-12-meses");
  assert.equal(faixaEtariaLaboratorial("2026-01-08", "2027-01-08"), "12-meses-ou-mais");
  assert.equal(faixaEtariaLaboratorial("2024-02-29", "2025-02-28"), "12-meses-ou-mais");
  assert.equal(faixaEtariaLaboratorial("2026-01-08", "2026-01-07"), null);
  assert.equal(faixaEtariaLaboratorial("2025-02-29", "2026-01-07"), null);
  assert.equal(faixaEtariaLaboratorial(null, "2026-01-07"), null);
  for (const especie of ["Cachorro", "Gato"] as const) {
    assert.equal(sugerirReferenciaLab(linha, especie, "menos-de-12-meses").referencia, "");
    assert.equal(sugerirReferenciaLab(linha, especie, null).referencia, "");
  }
});

test("configurar uma idade não altera a outra nem apaga referências legadas", () => {
  const base = { parametroId: "ureia", unidade: "mg/dL", referencia: "10 – 20" };
  const adulto = atualizarFaixaEtariaLab([base], [base], "12-meses-ou-mais");
  const ambos = atualizarFaixaEtariaLab(
    adulto,
    [{ ...base, referencia: "8 – 15" }],
    "menos-de-12-meses",
  );
  assert.deepEqual(referenciasDaIdadeLab(ambos, null), []);
  assert.equal(referenciasDaIdadeLab(ambos, "12-meses-ou-mais")[0]?.referencia, "10 – 20");
  assert.equal(referenciasDaIdadeLab(ambos, "menos-de-12-meses")[0]?.referencia, "8 – 15");
  const atualizadas = atualizarFaixaEtariaLab(
    ambos,
    [{ ...base, referencia: "11 – 20" }],
    "12-meses-ou-mais",
  );
  assert.equal(atualizadas.find((r) => !r.faixaEtaria)?.referencia, "10 – 20");
  assert.equal(referenciasDaIdadeLab(atualizadas, "menos-de-12-meses")[0]?.referencia, "8 – 15");
});
