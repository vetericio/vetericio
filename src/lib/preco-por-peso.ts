/** Faixas consecutivas: até o limite (inclusivo), a última sem limite superior. */
export type FaixaPrecoPeso = { ateKg: number | null; valor: number };

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
  if (!Array.isArray(faixas) || faixas.length < 2 || faixas.length > 20)
    return "Cadastre entre 2 e 20 faixas de peso.";
  let anterior = 0;
  for (let i = 0; i < faixas.length; i++) {
    const faixa = faixas[i];
    if (!Number.isFinite(faixa?.valor) || faixa.valor < 0 ||
        Math.abs(Math.round(faixa.valor * 100) - faixa.valor * 100) > 0.00001)
      return "Informe preços válidos em reais e centavos.";
    if (i === faixas.length - 1) {
      if (faixa.ateKg !== null) return "A última faixa precisa ser sem limite de peso.";
    } else if (typeof faixa.ateKg !== "number" || !Number.isFinite(faixa.ateKg) ||
      faixa.ateKg <= anterior || faixa.ateKg > 9999) {
      return "Os limites de peso devem ser positivos e crescentes, sem repetição.";
    }
    if (faixa.ateKg !== null) anterior = faixa.ateKg;
  }
  return null;
}

export function faixasValidas(valor: unknown): FaixaPrecoPeso[] {
  if (!Array.isArray(valor)) return [];
  const linhas = valor.map((v): FaixaPrecoPeso => ({
    ateKg: v && typeof v === "object" && v.ateKg === null ? null : Number(v?.ateKg),
    valor: Number(v?.valor),
  }));
  return validarFaixasPeso(linhas) === null ? linhas : [];
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
