export const STATUS_AGUARDANDO_PAGAMENTO = "aguardando_pagamento";
export const STATUS_ISENTO_AGUARDANDO_APROVACAO =
  "isento_aguardando_aprovacao";

export function statusDaContratacao(
  codigoPromocional: string | null | undefined,
  valorFinal: number,
) {
  return codigoPromocional?.trim() && valorFinal === 0
    ? STATUS_ISENTO_AGUARDANDO_APROVACAO
    : STATUS_AGUARDANDO_PAGAMENTO;
}
