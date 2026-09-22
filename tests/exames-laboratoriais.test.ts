import assert from "node:assert/strict";
import { test } from "node:test";
import {
  atualizarReferenciaExame,
  avaliarExame,
  carregarReferenciasExames,
  CHAVE_REFERENCIAS_EXAMES,
  criarExamesPadrao,
  normalizarExames,
  numeroExame,
  prepararExamesParaSalvar,
  referenciaCadastrada,
  referenciaDoExame,
  referenciasVazias,
  salvarReferenciasExames,
  trocarEspecieDosExames,
} from "../src/lib/exames-laboratoriais.ts";
import { ANAMNESE_VAZIA, salvarAnamneses, type Anamnese } from "../src/lib/anamnese.ts";
import { blocoAnamnese, blocoExamesLaboratoriais } from "../src/lib/ficha.ts";

// Números sintéticos exercitam o código; não são referências clínicas.
test("campo vazio e texto livre não são zero nem geram alertas", () => {
  for (const valor of ["", " ", "negativo", "<5", "1,", "1.", "1,2,3", "Infinity", "NaN", "0x10", "1e3"]) {
    assert.equal(numeroExame(valor), null, valor);
    assert.equal(avaliarExame(valor, "10–20"), "neutro", valor);
  }
  assert.equal(numeroExame("0"), 0);
  assert.equal(avaliarExame("0", "10–20"), "abaixo");
});

test("aceita vírgula ou ponto, limites inclusivos e várias formas de intervalo", () => {
  assert.equal(numeroExame("1,25"), 1.25);
  assert.equal(numeroExame("1.25"), 1.25);
  for (const faixa of ["1–2", "1 - 2", "1 a 2", "1 até 2", "1—2", "1,0–2,0", "1.0–2.0"]) {
    assert.equal(avaliarExame("1", faixa), "dentro");
    assert.equal(avaliarExame("2", faixa), "dentro");
    assert.equal(avaliarExame("1,25", faixa), "dentro");
    assert.equal(avaliarExame("1.25", faixa), "dentro");
    assert.equal(avaliarExame("0,9", faixa), "abaixo");
    assert.equal(avaliarExame("2.1", faixa), "acima");
  }
  assert.equal(avaliarExame("-2", "-3–-1"), "dentro");
});

test("referência malformada não produz sinal verde ou vermelho enganoso", () => {
  for (const ref of ["", "texto", "1–2–3", "20–10", "teste 1, resultado 2", "1.2.3–5", "1–2 mg/dL"]) {
    assert.equal(avaliarExame("1,5", ref), "neutro", ref);
  }
  assert.equal(avaliarExame("2", "<2"), "acima");
  assert.equal(avaliarExame("2", "≤2"), "dentro");
  assert.equal(avaliarExame("2", ">2"), "abaixo");
  assert.equal(avaliarExame("2", ">=2"), "dentro");
});

test("referências são separadas por espécie e por unidade", () => {
  const exame = { nome: "Teste", unidade: "U/L", valor: "1,5", referencia: "1–2" };
  let refs = atualizarReferenciaExame(referenciasVazias(), "Cachorro", exame);
  refs = atualizarReferenciaExame(refs, "Gato", { ...exame, referencia: "10–20" });
  assert.equal(referenciaCadastrada(exame, "Cachorro", refs), "1–2");
  assert.equal(referenciaCadastrada(exame, "Gato", refs), "10–20");
  assert.equal(referenciaCadastrada(exame, "", refs), "");
  assert.equal(referenciaCadastrada({ ...exame, unidade: "mg/dL" }, "Cachorro", refs), "");
  assert.deepEqual(atualizarReferenciaExame(refs, "", exame), refs);
});

test("trocar a espécie conserva resultado mas não leva a referência da anterior", () => {
  const grupos = criarExamesPadrao();
  const vg = { ...grupos.hemograma[0]!, valor: "1,5", referencia: "1–2" };
  grupos.hemograma[0] = { ...vg, referenciaEspecie: "Cachorro" };
  let refs = atualizarReferenciaExame(referenciasVazias(), "Cachorro", vg);
  const gatoSemCadastro = trocarEspecieDosExames(grupos, "Gato", refs);
  assert.equal(gatoSemCadastro.hemograma[0]?.valor, "1,5");
  assert.equal(gatoSemCadastro.hemograma[0]?.referencia, "");
  refs = atualizarReferenciaExame(refs, "Gato", { ...vg, referencia: "10–20" });
  const gato = trocarEspecieDosExames(grupos, "Gato", refs);
  assert.equal(gato.hemograma[0]?.referencia, "10–20");
  const cao = trocarEspecieDosExames(gato, "Cachorro", refs);
  assert.equal(cao.hemograma[0]?.referencia, "1–2");
  assert.equal(trocarEspecieDosExames(cao, "", refs).hemograma[0]?.referencia, "");
});

test("salvar usa a referência exibida e editar cadastro não reescreve o histórico", () => {
  const grupos = criarExamesPadrao();
  const vg = { ...grupos.hemograma[0]!, referencia: "1–2" };
  let refs = atualizarReferenciaExame(referenciasVazias(), "Gato", vg);
  grupos.hemograma[0]!.valor = "1.25";
  const salvos = prepararExamesParaSalvar(grupos, "Gato", refs);
  assert.equal(salvos.hemograma[0]?.referencia, "1–2");
  assert.equal(salvos.hemograma[0]?.valor, "1.25");
  refs = atualizarReferenciaExame(refs, "Gato", { ...vg, referencia: "10–20" });
  assert.equal(referenciaDoExame(salvos.hemograma[0]!, "Gato", refs), "1–2");
  assert.equal(referenciaDoExame({ ...salvos.hemograma[0]!, referencia: "" }, "Gato", refs), "");
  assert.equal(prepararExamesParaSalvar(salvos, "Gato", refs).hemograma[0]?.referencia, "1–2");
});

test("fichas antigas, VG/Hematócrito e referências v2 continuam compatíveis", () => {
  const antigos = normalizarExames({ hemograma: [{ nome: "VG", valor: "15", referencia: "10–20" }] });
  assert.equal(antigos.hemograma[0]?.unidade, "%");
  assert.equal(antigos.hemograma[0]?.valor, "15");
  assert.equal(antigos.hemograma[0]?.referencia, "10–20");
  const refs = { Cachorro: { VG: "1–2" }, Gato: {} };
  assert.equal(referenciaCadastrada(criarExamesPadrao().hemograma[0]!, "Cachorro", refs), "1–2");
  assert.equal(referenciaCadastrada({ ...antigos.hemograma[0]!, unidade: "U/L" }, "Cachorro", refs), "");
  assert.equal(normalizarExames({ hemograma: [] }).hemograma.length, 0);
  assert.equal(normalizarExames({}).hemograma.length, 3);
});

test("padrões não inventam referências clínicas e não compartilham objetos mutáveis", () => {
  const a = criarExamesPadrao();
  a.hemograma[0]!.valor = "123";
  assert.equal(criarExamesPadrao().hemograma[0]?.valor, "");
  assert.ok(Object.values(criarExamesPadrao()).flat().every((x) => x.referencia === ""));
});

test("ficha/PDF omitem exames vazios e incluem unidade, referência e observação", () => {
  const anamnese: Anamnese = {
    ...ANAMNESE_VAZIA, id: "teste", atualizadoEm: "2026-09-22", animal: "Teste", especie: "Gato",
    relato: "Relato de teste", exames: "Exame de teste", conduta: "Plano de teste",
    hemograma: [
      { nome: "VG", unidade: "%", valor: "15", referencia: "10–20" },
      { nome: "Plaquetas", unidade: "mil/µL", valor: "", referencia: "1–2" },
      { nome: "", valor: "100", referencia: "" },
    ],
  };
  const texto = blocoAnamnese({ anamneseId: "teste" }, [anamnese]).join("\n");
  assert.match(texto, /^Observação:/);
  assert.match(texto, /Relato: Relato de teste/);
  assert.match(texto, /Exame:/);
  assert.match(texto, /VG \(%\): 15 \(Ref\.: 10–20\)/);
  assert.match(texto, /Outras informações:/);
  assert.doesNotMatch(texto, /Plaquetas|Anamnese:|100/);
  assert.deepEqual(blocoAnamnese({ anamneseId: "ausente" }, [anamnese]), []);
  assert.deepEqual(blocoExamesLaboratoriais({ examesLaboratoriais: { hemograma: [{ nome: "VG", valor: "" }] } }), []);
});

test("armazenamento: recarrega, tolera JSON inválido e informa falha sem lançar erro", () => {
  const dados = new Map<string, string>();
  const armazenamento = { getItem: (chave: string) => dados.get(chave) ?? null, setItem: (chave: string, valor: string) => { dados.set(chave, valor); } };
  const anterior = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: armazenamento } });
  try {
    const refs = atualizarReferenciaExame(referenciasVazias(), "Cachorro", { nome: "Teste", unidade: "U/L", valor: "", referencia: "1–2" });
    assert.equal(salvarReferenciasExames(refs), true);
    assert.deepEqual(carregarReferenciasExames(), refs);
    assert.equal(salvarAnamneses([]), true);
    for (const invalido of ["{", "null", "[]", '{"Cachorro":null,"Gato":5}', '{"Cachorro":{"Teste":false}}']) {
      dados.set(CHAVE_REFERENCIAS_EXAMES, invalido);
      assert.deepEqual(carregarReferenciasExames(), referenciasVazias());
    }
    Object.defineProperty(globalThis, "window", { configurable: true, value: { get localStorage() { throw new Error("blocked"); } } });
    assert.deepEqual(carregarReferenciasExames(), referenciasVazias());
    assert.equal(salvarReferenciasExames(refs), false);
    assert.equal(salvarAnamneses([]), false);
  } finally {
    if (anterior) Object.defineProperty(globalThis, "window", anterior);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
