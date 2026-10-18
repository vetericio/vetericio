/** Valores monetários sempre em centavos inteiros. Não é uma confirmação de tarifa real. */
export type ModalidadePagamento = "pix" | "cartao" | "boleto";
export type ModoCobranca = "receber" | "cobrar";
export type Taxas = {
  mercadoPagoPercentual: number;
  mercadoPagoFixoCentavos: number;
  oricsePercentual: number;
};
export type ResultadoSplit = {
  modo: ModoCobranca;
  valorInformadoCentavos: number;
  cobradoTutorCentavos: number;
  taxaMercadoPagoCentavos: number;
  taxaOricseCentavos: number;
  liquidoClinicaCentavos: number;
};
function validarTaxas(t: Taxas) {
  if (![t.mercadoPagoPercentual, t.mercadoPagoFixoCentavos, t.oricsePercentual].every(Number.isFinite) ||
      t.mercadoPagoPercentual < 0 || t.oricsePercentual < 0 ||
      t.mercadoPagoPercentual >= 100 || t.oricsePercentual >= 100 ||
      !Number.isSafeInteger(t.mercadoPagoFixoCentavos) || t.mercadoPagoFixoCentavos < 0) {
    throw new Error("Taxas inválidas: percentuais devem ser menores que 100% e valores não negativos.");
  }
}
function divisao(bruto: number, t: Taxas) {
  const mp = Math.min(bruto, Math.round(bruto * t.mercadoPagoPercentual / 100) + t.mercadoPagoFixoCentavos);
  const aposMp = bruto - mp;
  // No Split 1:1 o marketplace desconta sua comissão do saldo após a taxa Mercado Pago.
  const oricse = Math.round(aposMp * t.oricsePercentual / 100);
  return { mp, oricse, clinica: aposMp - oricse };
}
export function simularSplit(modo: ModoCobranca, valorCentavos: number, t: Taxas): ResultadoSplit {
  validarTaxas(t);
  if (!Number.isSafeInteger(valorCentavos) || valorCentavos <= 0 || valorCentavos > 1_000_000_000)
    throw new Error("Informe um valor monetário válido.");
  let bruto = valorCentavos;
  if (modo === "receber") {
    let esquerda = valorCentavos, direita = 2_000_000_000;
    if (divisao(direita, t).clinica < valorCentavos) throw new Error("Não é possível atingir o líquido informado.");
    while (esquerda < direita) {
      const meio = Math.floor((esquerda + direita) / 2);
      if (divisao(meio, t).clinica >= valorCentavos) direita = meio;
      else esquerda = meio + 1;
    }
    bruto = esquerda;
  } else if (modo !== "cobrar") throw new Error("Modo inválido.");
  const {mp, oricse, clinica} = divisao(bruto, t);
  return {
    modo, valorInformadoCentavos: valorCentavos, cobradoTutorCentavos: bruto,
    taxaMercadoPagoCentavos: mp, taxaOricseCentavos: oricse, liquidoClinicaCentavos: clinica,
  };
}
export const formatarCentavos = (v: number) => (v / 100).toLocaleString("pt-BR", { style:"currency", currency:"BRL" });
