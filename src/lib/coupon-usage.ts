/**
 * Um uso de cupom pertence a uma contratação, não a uma cobrança.
 * Cupons integrais são consumidos quando a solicitação é recebida,
 * mesmo sem evento de pagamento do Mercado Pago.
 */
export type ContratacaoComCupom = {
  status?: string | null;
  pagamento_aprovado_em?: string | null;
  valor_total?: number | string | null;
  promo_codigo?: string | null;
  promo_valor_original?: number | string | null;
  promo_desconto?: number | string | null;
  promo_valor_final?: number | string | null;
};

const STATUS_ISENCAO_RECEBIDA = new Set([
  "isento_aguardando_aprovacao",
  "em_analise",
  "em_configuracao",
  "pagamento_aprovado",
  "aprovada",
  "ativa",
  "ativada",
]);

export function contratacaoConsomeCupom(c: ContratacaoComCupom): boolean {
  if (["cancelada", "recusada"].includes(String(c.status || ""))) return false;
  if (Boolean(c.pagamento_aprovado_em)) return true;

  const original = Number(c.promo_valor_original);
  return Boolean(c.promo_codigo) &&
    Number(c.valor_total) === 0 &&
    original > 0 &&
    Number(c.promo_desconto) >= original &&
    Number(c.promo_valor_final) === 0 &&
    STATUS_ISENCAO_RECEBIDA.has(String(c.status || ""));
}
