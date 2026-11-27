import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { readFileSync } from "node:fs";
import test from "node:test";

// Estado fictício: os cálculos não usam banco, sessão, storage ou sites externos.
const fixture = "export const oricseStorage = {}, oricseSession = {};";
const hook = registerHooks({
  resolve(specifier, context, nextResolve) {
    return specifier === "@/lib/oricse-storage"
      ? { url: "data:text/javascript," + encodeURIComponent(fixture), shortCircuit: true }
      : nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    return url.endsWith("/medicamentos-padrao.json")
      ? nextLoad(url, { ...context, importAttributes: { type: "json" } })
      : nextLoad(url, context);
  },
});
const { dosePadraoCadastrada, calcularDose, calcularFaixaDose, doseDaEspecie } = await import("../src/lib/medicamentos.ts");
hook.deregister();

test("faixa é referência mesmo com só um limite; apenas dose explícita pode preencher", () => {
  const faixa = { doseMin: "1", doseMax: "3", intervalo: "", unidade: "mg/kg" };
  assert.equal(dosePadraoCadastrada(faixa), null);
  assert.equal(dosePadraoCadastrada({ ...faixa, doseMax: "" }), null);
  assert.equal(dosePadraoCadastrada({ ...faixa, doseMin: "" }), null);
  assert.equal(dosePadraoCadastrada({ ...faixa, dosePadrao: "" }), null);
  assert.equal(dosePadraoCadastrada({ ...faixa, dosePadrao: "0" }), null);
  assert.equal(dosePadraoCadastrada({ ...faixa, dosePadrao: "inválida" }), null);
  assert.equal(dosePadraoCadastrada({ ...faixa, dosePadrao: "1,5" }), 1.5);
  assert.equal(dosePadraoCadastrada({ ...faixa, dosePadrao: "1,5", proibido: true }), null);
  assert.equal(dosePadraoCadastrada({ dose: "1,25", intervalo: "" }), 1.25);
  assert.equal(dosePadraoCadastrada({ ...faixa, dose: "1,25", dosePadrao: "" }), null);
  const matematica = { peso: "2", concentracaoValor: "2", concentracaoUnidade: "mg/mL" };
  assert.equal(calcularFaixaDose({ ...matematica, dose: faixa }).ok, true);
  assert.equal(calcularDose({ ...matematica, unidadeDose: "mg/kg", dose: "" }).ok, false);
  assert.equal(calcularDose({ ...matematica, unidadeDose: "mg/kg", dose: "1,5" }).ok, true);
});

test("sequência de espécie mantém ausência de padrão e não aproveita campo de outra espécie", () => {
  const medicamento = {
    doseUnificada: false,
    cao: { doseMin: "1", doseMax: "3", intervalo: "" },
    gato: { dosePadrao: "2", intervalo: "" },
  } as Parameters<typeof doseDaEspecie>[0];
  assert.equal(dosePadraoCadastrada(doseDaEspecie(medicamento, "cao")), null);
  assert.equal(dosePadraoCadastrada(doseDaEspecie(medicamento, "gato")), 2);
});

test("não reintroduz limite como preenchimento na consulta avulsa ou no cartão", () => {
  const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
  assert.doesNotMatch(ler("../src/components/medicamentos/PesquisaAvulsa.tsx"), /setDose\([^;]+:\s*f\.min\)/);
  assert.doesNotMatch(ler("../src/routes/medicacoes.tsx"), /\(volMin\s*\+\s*volMax\)\s*\/\s*2/);
  assert.match(ler("../src/components/medicamentos/DialogoMinistrar.tsx"), /dose padrão não cadastrada/i);
});

test("não converte volume para sólido; registro manual mantém unidade da apresentação", async () => {
  const { calcularEntrada, unidadesRegistroManual, calcularDosePeloVolume } = await import("../src/lib/medicamentos.ts");
  const solido = { peso: "4", dose: "1", quantidade: "1", origem: "quantidade" as const,
    unidadeDose: "mL/kg", concentracaoValor: "15", concentracaoUnidade: "mg/cápsula" };
  assert.deepEqual(unidadesRegistroManual(solido.concentracaoUnidade), ["cápsula"]);
  assert.deepEqual(unidadesRegistroManual("mg/comprimido"), ["comprimido"]);
  assert.deepEqual(unidadesRegistroManual("mg/mL"), ["mL"]);
  assert.ok(unidadesRegistroManual("").includes("gota"));
  assert.equal(calcularDose(solido).ok, false);
  assert.equal(calcularEntrada(solido).resultado.ok, false);
  assert.equal(calcularEntrada(solido).unidadeQuantidade, "");
  assert.equal(calcularDosePeloVolume({ ...solido, volume: "1", unidadeQuantidade: "mL" }).ok, false);
  assert.equal(calcularDosePeloVolume({ ...solido, volume: "1", concentracaoUnidade: "", unidadeQuantidade: "cápsula" }).ok, false);
  assert.equal(calcularDose({ ...solido, concentracaoUnidade: "mg/mL" }).ok, true);
});

test("formulários descartam contexto vencido e não projetam faixa com unidade editada", () => {
  const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
  const avulsa = ler("../src/components/medicamentos/PesquisaAvulsa.tsx");
  assert.match(avulsa, /setUnidadeDose\(e.target.value\); limparCalculo\(\)/);
  assert.match(avulsa, /setUnidadeConcentracao\(e.target.value\);\s*setConcentracao\(""\);\s*limparCalculo\(\)/);
  assert.match(avulsa, /unidadeDose === faixa.unidade && usaApresentacaoCadastrada/);
  assert.match(avulsa, /unidadeDose: faixa\?\.unidade/);
  const prescricoes = ler("../src/components/Medicacoes.tsx");
  assert.match(prescricoes, /\[props.pacienteId, props.especie, props.peso, medicamentos\]/);
  assert.match(prescricoes, /<MedicacoesContexto key=\{contexto\}/);
  assert.match(prescricoes, /edição de uma linha já registrada não converte a quantidade/);
  const administracao = ler("../src/components/medicamentos/DialogoMinistrar.tsx");
  assert.doesNotMatch(administracao, /Usar somente mL/);
  assert.match(administracao, /manual \? quantidadeManualValida : resultado.ok/);
  assert.match(administracao, /setUnidadeManual\(e.target.value\); setQuantidade\(""\)/);
});

test("espécie não confirmada não representa cão e troca de paciente invalida o formulário", async () => {
  const { especieMedicacaoDaFicha } = await import("../src/lib/medicamentos.ts");
  assert.equal(especieMedicacaoDaFicha(" Canina "), "cao");
  assert.equal(especieMedicacaoDaFicha("FELINO"), "gato");
  for (const especie of ["", "felino?", "Gato-do-mato", "Aves", "Coelho", undefined])
    assert.equal(especieMedicacaoDaFicha(especie), null);
  const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
  const consulta = ler("../src/routes/registro-clinico.tsx");
  assert.match(consulta, /key=\{JSON.stringify\(\[animalId, agendamentoId, tipo\]\)\}/);
  assert.match(consulta, /pacienteId=\{animal.id\} especie=\{animal.especie\}/);
  const ficha = ler("../src/components/FormAvaliacao.tsx");
  assert.match(ficha, /especie: a.especie \|\| "",\s*peso: a.peso \|\| ""/);
  assert.doesNotMatch(ficha, /a.peso \|\| valores.peso/);
});
