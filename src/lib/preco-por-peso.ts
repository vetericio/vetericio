/** Faixas consecutivas: até o limite (inclusivo), a última sem limite superior. */
export type EspeciePreco = "Cão" | "Gato" | null;
export type SexoPreco = "Macho" | "Fêmea" | null;
/** Uma regra pode valer para todos os animais ou somente para uma espécie/sexo. */
export type FaixaPrecoPeso = { ateKg: number | null; valor: number; especie?: EspeciePreco; sexo?: SexoPreco };

export type AprovacaoPrecoPeso = {
  pesoKg: number | null;
  faixaSugerida: string | null;
  valorSugerido: number | null;
  faixaEscolhida: string;
  valorAprovado: number;
  justificativa: string;
  aprovadoPor: string;
  aprovadoEm: string;
};

export function validarFaixasPeso(faixas: readonly FaixaPrecoPeso[]): string | null {
  if (!Array.isArray(faixas) || faixas.length < 1 || faixas.length > 20)
    return "Cadastre entre 1 e 20 preços.";
  const grupos = new Map<string, FaixaPrecoPeso[]>();
  for (const faixa of faixas) {
    const chave = `${faixa?.especie || "todos"}|${faixa?.sexo || "todos"}`;
    grupos.set(chave, [...(grupos.get(chave) || []), faixa]);
  }
  for (const grupo of grupos.values()) {
    let anterior = 0;
    for (let i = 0; i < grupo.length; i++) {
      const faixa = grupo[i];
    if (!Number.isFinite(faixa?.valor) || faixa.valor < 0 ||
        Math.abs(Math.round(faixa.valor * 100) - faixa.valor * 100) > 0.00001)
      return "Informe preços válidos em reais e centavos.";
    if (i === grupo.length - 1) {
      if (faixa.ateKg !== null) return "A última faixa precisa ser sem limite de peso.";
    } else if (typeof faixa.ateKg !== "number" || !Number.isFinite(faixa.ateKg) ||
      faixa.ateKg <= anterior || faixa.ateKg > 9999) {
      return "Os limites de peso devem ser positivos e crescentes, sem repetição.";
    }
    if (faixa.ateKg !== null) anterior = faixa.ateKg;
  }
  }
  return null;
}

export function faixasValidas(valor: unknown): FaixaPrecoPeso[] {
  if (!Array.isArray(valor)) return [];
  const linhas = valor.map((v): FaixaPrecoPeso => ({
    ateKg: v && typeof v === "object" && v.ateKg === null ? null : Number(v?.ateKg),
    valor: Number(v?.valor),
    especie: v?.especie === "Cão" || v?.especie === "Gato" ? v.especie : null,
    sexo: v?.sexo === "Macho" || v?.sexo === "Fêmea" ? v.sexo : null,
  }));
  return validarFaixasPeso(linhas) === null ? linhas : [];
}

function especiePadrao(valor?: string): EspeciePreco {
  const texto = (valor || "").toLocaleLowerCase("pt-BR");
  return /gato|fel/.test(texto) ? "Gato" : /cao|cão|can/.test(texto) ? "Cão" : null;
}
function sexoPadrao(valor?: string): SexoPreco {
  const texto = (valor || "").toLocaleLowerCase("pt-BR");
  return /macho|mascul/.test(texto) ? "Macho" : /fêmea|femea|femin/.test(texto) ? "Fêmea" : null;
}
/** Escolhe a regra mais específica compatível com o paciente. */
export function faixasParaAnimal(valor: unknown, especie?: string, sexo?: string): FaixaPrecoPeso[] {
  const todas = faixasValidas(valor);
  const especieAnimal = especiePadrao(especie), sexoAnimal = sexoPadrao(sexo);
  const compativeis = todas.filter(f => (!f.especie || f.especie === especieAnimal) && (!f.sexo || f.sexo === sexoAnimal));
  const maiorEspecificidade = Math.max(-1, ...compativeis.map(f => Number(Boolean(f.especie)) + Number(Boolean(f.sexo))));
  return compativeis.filter(f => Number(Boolean(f.especie)) + Number(Boolean(f.sexo)) === maiorEspecificidade);
}

export function rotuloCondicao(faixa: FaixaPrecoPeso): string {
  return [faixa.especie, faixa.sexo].filter(Boolean).join(" · ") || "Todos os animais";
}

export function tituloFaixa(faixas: readonly FaixaPrecoPeso[], indice: number): string {
  if (indice < 0 || indice >= faixas.length) return "Faixa inválida";
  const anterior = indice > 0 ? faixas[indice - 1].ateKg : 0;
  const atual = faixas[indice].ateKg;
  const kg = (v: number | null) => v === null ? "" : v.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
  if (indice === 0) return "Até " + kg(atual) + " kg";
  return atual === null ? "Acima de " + kg(anterior) + " kg" :
    "Acima de " + kg(anterior) + " até " + kg(atual) + " kg";
}

export function sugerirFaixaPeso(faixas: readonly FaixaPrecoPeso[], peso: number | null): number {
  if (peso === null || !Number.isFinite(peso) || peso <= 0 || validarFaixasPeso(faixas))
    return -1;
  return faixas.findIndex(f => f.ateKg === null || peso <= f.ateKg);
}

export function valorEmReais(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
