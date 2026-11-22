/**
 * Garante que o bloco de assinaturas não fique sozinho numa página.
 * Testado separadamente para todos os modelos de termos.
 *
 * O limite considera a última linha escrita e toda a altura do bloco.
 * Ao quebrar antes das linhas finais, o profissional e o responsável
 * assinam junto com o último trecho do consentimento.
 */
export function quebrarAntesDaLinhaFinal({
  y,
  linhasRestantes,
  passo,
  reservaAssinaturas,
  limite = 273,
  linhasJuntoAssinatura = 4,
}: {
  y: number;
  linhasRestantes: number;
  passo: number;
  reservaAssinaturas: number;
  limite?: number;
  linhasJuntoAssinatura?: number;
}): boolean {
  if (y + passo > limite) return true;
  return (
    linhasRestantes <= linhasJuntoAssinatura &&
    y + linhasRestantes * passo + reservaAssinaturas > limite
  );
}
