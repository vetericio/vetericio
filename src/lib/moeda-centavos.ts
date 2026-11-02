/** Máscara monetária: cada algarismo digitado representa um centavo.
 * "5" -> "0,05"; "50" -> "0,50"; "5000" -> "50,00".
 * Para campos controlados, ao receber um texto já formatado, remove a pontuação.
 */
export function digitarCentavos(valor: string): string {
  const digitos = valor.replace(/\D/g, "").slice(0, 13);
  const centavos = Number(digitos || "0");
  return (centavos / 100).toLocaleString("pt-BR", {minimumFractionDigits:2,maximumFractionDigits:2});
}
/** Converte um valor exibido pela máscara para centavos inteiros. */
export function centavosDoCampo(valor: string): number {
  return Number(valor.replace(/\D/g, "") || "0");
}
