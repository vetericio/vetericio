/**
 * Fonte única para consultas de clínicas ativas no produto.
 * Itens enviados à lixeira mantêm o registro, mas nunca entram em listas,
 * indicadores ou cálculos operacionais.
 */
export function semClinicasNaLixeira(consulta: any) {
  return consulta.is("excluido_em", null);
}
