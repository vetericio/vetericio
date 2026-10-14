export const COMANDAS_KEY = "oricse-comandas-v1";
export const LANCAMENTOS_FINANCEIROS_KEY = "oricse-financeiro-lancamentos-v1";

export type OrigemComanda = "Recepção" | "Consultório" | "Internação";
export type StatusComanda = "Aberta" | "Finalizada";

export type ItemComanda = {
  id: string;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  criadoEm: string;
  criadoPor: string;
  catalogoItemId?: string;
  tipo?: "servico" | "produto" | "avulso";
  diaComissao?: number;
  percentualComissao?: number;
  valorComissao?: number;
  comissaoFuncionarioId?: string;
  comissaoFuncionario?: string;
};

export type PagamentoComanda = {
  id: string;
  valor: number;
  formaPagamento: string;
  data: string;
  registradoPor: string;
};

export type Comanda = {
  id: string;
  numero: number;
  status: StatusComanda;
  origem: OrigemComanda;
  tutorId: string;
  tutorNome: string;
  animalId: string;
  animalNome: string;
  abertaEm: string;
  abertaPor: string;
  abertaPorId: string;
  itens: ItemComanda[];
  pagamentos: PagamentoComanda[];
  finalizadaEm?: string;
  finalizadaPor?: string;
  finalizadaPorId?: string;
  cortesia?: {
    justificativa: string;
    valor: number;
    registradaEm: string;
    registradaPor: string;
    registradaPorId: string;
  };
};

type LancamentoFinanceiro = {
  id: string;
  tipo: "Entrada" | "Saída";
  descricao: string;
  categoria: string;
  valor: number;
  data: string;
  formaPagamento: string;
  tutor?: string;
  tutorId?: string;
  status: "Pago";
  observacao?: string;
  comandaId?: string;
  registradoPor?: string;
};

export function lerComandas(): Comanda[] {
  if (typeof window === "undefined") return [];
  try {
    const dados: unknown = JSON.parse(window.localStorage.getItem(COMANDAS_KEY) || "[]");
    if (!Array.isArray(dados)) return [];
    return dados.filter(
      (item): item is Comanda =>
        Boolean(item) &&
        typeof item === "object" &&
        typeof item.id === "string" &&
        typeof item.tutorId === "string" &&
        typeof item.animalId === "string" &&
        (item.status === "Aberta" || item.status === "Finalizada") &&
        Array.isArray(item.itens) &&
        Array.isArray(item.pagamentos),
    );
  } catch {
    return [];
  }
}

export function salvarComandas(comandas: Comanda[]): void {
  window.localStorage.setItem(COMANDAS_KEY, JSON.stringify(comandas));
  window.dispatchEvent(new Event("oricse-comandas-atualizadas"));
}

function arredondarMoeda(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

export function totalComanda(comanda: Comanda): number {
  return arredondarMoeda(
    comanda.itens.reduce(
      (total, item) => total + arredondarMoeda(item.quantidade * item.valorUnitario),
      0,
    ),
  );
}

export function totalPagoComanda(comanda: Comanda): number {
  return arredondarMoeda(
    comanda.pagamentos.reduce((total, pagamento) => total + pagamento.valor, 0),
  );
}

export function saldoComanda(comanda: Comanda): number {
  return arredondarMoeda(Math.max(0, totalComanda(comanda) - totalPagoComanda(comanda)));
}

export function proximoNumeroComanda(comandas: readonly Comanda[]): number {
  return comandas.reduce((maior, comanda) => Math.max(maior, comanda.numero || 0), 0) + 1;
}

export function registrarLancamentoComanda(lancamento: LancamentoFinanceiro): void {
  let existentes: LancamentoFinanceiro[] = [];
  try {
    const dados: unknown = JSON.parse(
      window.localStorage.getItem(LANCAMENTOS_FINANCEIROS_KEY) || "[]",
    );
    if (Array.isArray(dados)) {
      existentes = dados.filter(
        (item): item is LancamentoFinanceiro =>
          Boolean(item) &&
          typeof item === "object" &&
          typeof item.id === "string" &&
          typeof item.valor === "number",
      );
    }
  } catch (error) {
    console.error(
      "Não foi possível carregar os lançamentos financeiros para registrar a comanda:",
      error,
    );
    throw new Error("Não foi possível registrar o lançamento financeiro. Tente novamente.");
  }

  if (existentes.some((item) => item.id === lancamento.id)) return;
  window.localStorage.setItem(
    LANCAMENTOS_FINANCEIROS_KEY,
    JSON.stringify([lancamento, ...existentes]),
  );
}
