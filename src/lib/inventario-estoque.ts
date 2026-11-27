export type ProdutoInventario = {
  id: string;
  nome: string;
  codigo_barras: string | null;
  estoque_atual: number | null;
  estoque_minimo: number | null;
  venda_por_peso: boolean;
  updated_at: string;
  inicio: string | null;
  fim: string;
  dias: number;
  quantidade: number | null;
};

export type RegistroInventario = {
  id: string;
  produto_nome: string;
  saldo_sistema: number | null;
  saldo_contado: number;
  diferenca: number | null;
  motivo: string;
  operador_id: string;
  registrado_em: string;
};

export const COBERTURAS_INVENTARIO = [7, 14, 30] as const;
type Cobertura = (typeof COBERTURAS_INVENTARIO)[number];

const quantidadeMaximaMilesimos = 999_999_999_999;

export function interpretarContagem(valor: string): number | null {
  const partes = /^(\d{1,9})(?:[.,](\d{1,3}))?$/.exec(valor.trim());
  if (!partes) return null;
  const milesimos = Number(partes[1]) * 1000 + Number((partes[2] ?? "").padEnd(3, "0"));
  return milesimos <= quantidadeMaximaMilesimos ? milesimos / 1000 : null;
}

export function calcularDiferencaInventario(saldo: number | null, contado: number): number | null {
  if (saldo === null) return null;
  return (Math.round(contado * 1000) - Math.round(saldo * 1000)) / 1000;
}

export function calcularReposicao(
  produto: Pick<
    ProdutoInventario,
    "dias" | "quantidade" | "estoque_atual" | "estoque_minimo" | "venda_por_peso"
  >,
  cobertura: Cobertura,
) {
  const { dias, quantidade, estoque_atual, estoque_minimo, venda_por_peso } = produto;
  if (
    !COBERTURAS_INVENTARIO.includes(cobertura) ||
    !Number.isInteger(dias) ||
    dias < 7 ||
    dias > 30 ||
    quantidade === null ||
    !Number.isFinite(quantidade) ||
    quantidade <= 0
  )
    return { tipo: "sem-consumo" } as const;
  if (estoque_atual === null || !Number.isFinite(estoque_atual) || estoque_atual < 0)
    return { tipo: "sem-saldo" } as const;
  const milesimosVendidos = Math.round(quantidade * 1000);
  if (!Number.isSafeInteger(milesimosVendidos * cobertura)) return { tipo: "sem-consumo" } as const;
  const minimo =
    estoque_minimo !== null && Number.isFinite(estoque_minimo) && estoque_minimo >= 0
      ? estoque_minimo
      : 0;
  const alvoMilesimos = Math.max(
    Math.ceil((milesimosVendidos * cobertura) / dias),
    Math.round(minimo * 1000),
  );
  const faltamMilesimos = Math.max(0, alvoMilesimos - Math.round(estoque_atual * 1000));
  const repor = venda_por_peso ? faltamMilesimos / 1000 : Math.ceil(faltamMilesimos / 1000);
  return { tipo: "observado", repor, media: quantidade / dias } as const;
}
