import { z } from "zod";
import { diaNoFuso } from "./relatorios";

export type CompraControlado = {
  id: string;
  dataCompra: string;
  produtoId: string;
  produtoNome: string;
  quantidade: number | null;
  fornecedor: string | null;
  notaFiscal: string | null;
  lote: string | null;
  autorNome: string;
  status: "pendente" | "completo";
};

export type ProdutoCompraControlado = { id: string; nome: string };

export function camposPendentesCompra(
  compra: Pick<CompraControlado, "quantidade" | "fornecedor" | "notaFiscal" | "lote">,
) {
  const faltantes: string[] = [];
  if (compra.quantidade === null || compra.quantidade <= 0) faltantes.push("Quantidade");
  if (!compra.fornecedor?.trim()) faltantes.push("Fornecedor");
  if (!compra.notaFiscal?.trim()) faltantes.push("Nota fiscal");
  if (!compra.lote?.trim()) faltantes.push("Lote");
  return faltantes;
}

const dataValida = (valor: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor) || valor < "2000-01-01" || valor > "2099-12-31")
    return false;
  const data = new Date(`${valor}T00:00:00.000Z`);
  return Number.isFinite(data.getTime()) && data.toISOString().slice(0, 10) === valor;
};
const dia = z.string().refine(dataValida, "Informe uma data válida.");
const baseSchema = z.object({
  accessToken: z.string().min(20).max(16384),
  clinicaId: z.string().uuid(),
});

export const listarComprasControladosSchema = baseSchema
  .extend({
    inicio: dia.optional(),
    fim: dia.optional(),
    somentePendencias: z.boolean().optional(),
  })
  .refine(({ inicio, fim }) => !inicio || !fim || inicio <= fim, "Informe um período válido.");

export const listarProdutosCompraControladosSchema = baseSchema.extend({
  busca: z.string().trim().max(120),
});
const textoOpcional = (limite: number) =>
  z
    .string()
    .trim()
    .max(limite)
    .nullish()
    .transform((valor) => valor || null);
const quantidadeOpcional = z
  .number()
  .positive()
  .max(999999999999.999)
  .refine((valor) => /^\d+(\.\d{1,3})?$/.test(String(valor)), "Use até três casas decimais.")
  .nullish()
  .transform((valor) => valor ?? null);

export const salvarCompraControladoSchema = baseSchema
  .extend({
    id: z.string().uuid().optional(),
    requestId: z.string().uuid().optional(),
    dataCompra: dia.refine(
      (valor) => valor <= diaNoFuso(new Date().toISOString()),
      "A data da compra não pode estar no futuro.",
    ),
    produtoId: z.string().uuid(),
    quantidade: quantidadeOpcional,
    fornecedor: textoOpcional(180),
    notaFiscal: textoOpcional(100),
    lote: textoOpcional(100),
    finalizar: z.boolean(),
  })
  .superRefine((compra, ctx) => {
    if (!compra.finalizar) return;
    const faltantes = camposPendentesCompra(compra);
    if (faltantes.length)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Preencha para finalizar: ${faltantes.join(", ")}.`,
      });
  });

export type EntradaListaComprasControlados = z.output<typeof listarComprasControladosSchema>;
export type EntradaProdutoCompraControlado = z.output<typeof listarProdutosCompraControladosSchema>;
export type EntradaGravarCompraControlado = z.output<typeof salvarCompraControladoSchema>;
