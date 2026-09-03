/** Palavras de ligação que ficam em minúscula no meio do nome. */
const LIGACOES = new Set(["de", "da", "do", "das", "dos", "e", "em", "por", "com"]);

/**
 * Padroniza o nome de um medicamento: primeira letra de cada palavra relevante
 * em maiúscula e o restante em minúscula. "CLORIDRATO DE METOCLOPRAMIDA"
 * vira "Cloridrato de Metoclopramida".
 */
export function normalizarNomeMedicamento(valor: string): string {
  const limpo = (valor ?? "").trim().replace(/\s+/g, " ");
  if (!limpo) return "";
  return limpo
    .split(" ")
    .map((palavra, indice) => {
      const minuscula = palavra.toLocaleLowerCase("pt-BR");
      if (indice > 0 && LIGACOES.has(minuscula)) return minuscula;
      // Preserva números e siglas com dígitos (ex.: "500", "B12").
      if (/\d/.test(palavra)) return palavra;
      return minuscula.charAt(0).toLocaleUpperCase("pt-BR") + minuscula.slice(1);
    })
    .join(" ");
}
