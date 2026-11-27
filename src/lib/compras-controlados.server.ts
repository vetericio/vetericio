import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { contaDemoAlvorada } from "./demo-alvorada";
import { clienteSupabaseUsuario, exigirPermissaoClinica } from "./permissao-clinica.server";
import { exigirClinicaNoPilotoRelatorios } from "./relatorios-acesso";
import type {
  CompraControlado,
  EntradaGravarCompraControlado,
  EntradaListaComprasControlados,
  EntradaProdutoCompraControlado,
  ProdutoCompraControlado,
} from "./compras-controlados";

const TABELA = "oricse_compras_controlados";
const CAMPOS =
  "id,data_compra,produto_id,produto_nome,quantidade,fornecedor,nota_fiscal,lote,autor_nome,status";

type RegistroCompra = {
  id: string;
  data_compra: string;
  produto_id: string;
  produto_nome: string;
  quantidade: number | string | null;
  fornecedor: string | null;
  nota_fiscal: string | null;
  lote: string | null;
  autor_nome: string;
  status: CompraControlado["status"];
};

function converter(r: RegistroCompra): CompraControlado {
  return {
    id: r.id,
    dataCompra: r.data_compra,
    produtoId: r.produto_id,
    produtoNome: r.produto_nome,
    quantidade: r.quantidade === null ? null : Number(r.quantidade),
    fornecedor: r.fornecedor,
    notaFiscal: r.nota_fiscal,
    lote: r.lote,
    autorNome: r.autor_nome,
    status: r.status,
  };
}

async function autorizar(
  { accessToken, clinicaId }: { accessToken: string; clinicaId: string },
  escrita = false,
) {
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user) throw new Error("Sessão inválida ou expirada.");
  await exigirClinicaNoPilotoRelatorios(supabaseAdmin, clinicaId, data.user.id);
  await exigirPermissaoClinica(
    supabaseAdmin,
    data.user.id,
    clinicaId,
    ["estoque.catalogo.visualizar"],
    accessToken,
  );
  if (escrita) {
    if (contaDemoAlvorada(data.user)) throw new Error("A demonstração não pode registrar compras.");
    await exigirPermissaoClinica(
      supabaseAdmin,
      data.user.id,
      clinicaId,
      ["estoque.movimentar"],
      accessToken,
    );
  }
}

/** Somente após validação e autorização da clínica piloto pelo chamador. O JWT e RLS continuam obrigatórios. */
export async function listarComprasControladosAutorizadas({
  accessToken,
  clinicaId,
  inicio,
  fim,
  somentePendencias,
}: EntradaListaComprasControlados): Promise<CompraControlado[]> {
  const banco = clienteSupabaseUsuario(accessToken);
  const compras: CompraControlado[] = [];
  const pagina = 500;
  for (let de = 0; de < 20_000; de += pagina) {
    let consulta = banco
      .from(TABELA)
      .select(CAMPOS)
      .eq("clinica_id", clinicaId)
      .order("data_compra", { ascending: false })
      .order("id");
    if (inicio) consulta = consulta.gte("data_compra", inicio);
    if (fim) consulta = consulta.lte("data_compra", fim);
    if (somentePendencias) consulta = consulta.eq("status", "pendente");
    const { data, error } = await consulta.range(de, de + pagina - 1).returns<RegistroCompra[]>();
    if (error || !data) throw new Error("Não foi possível consultar o registro de compras.");
    compras.push(...data.map(converter));
    if (data.length < pagina) return compras;
  }
  throw new Error("Muitas compras no período. Reduza o intervalo da consulta.");
}

export async function listarComprasControladosServidor(entrada: EntradaListaComprasControlados) {
  await autorizar(entrada);
  return listarComprasControladosAutorizadas(entrada);
}

export async function listarProdutosCompraControladosServidor({
  accessToken,
  clinicaId,
  busca,
}: EntradaProdutoCompraControlado): Promise<ProdutoCompraControlado[]> {
  await autorizar({ accessToken, clinicaId });
  let consulta = clienteSupabaseUsuario(accessToken)
    .from("oricse_catalogo_itens")
    .select("id,nome")
    .eq("clinica_id", clinicaId)
    .eq("tipo", "produto")
    .eq("ativo", true);
  if (busca) consulta = consulta.ilike("nome", `%${busca.replace(/[\\%_*]/g, "\\$&")}%`);
  const { data, error } = await consulta
    .order("nome")
    .order("id")
    .limit(30)
    .returns<ProdutoCompraControlado[]>();
  if (error || !data) throw new Error("Não foi possível consultar os produtos do catálogo.");
  return data;
}

const MENSAGENS_RPC = new Set([
  "Revise a data, o produto e os dados da compra.",
  "A data da compra não pode estar no futuro.",
  "Informe quantidade, fornecedor, nota fiscal e lote para finalizar.",
  "Compra não encontrada nesta clínica.",
  "Selecione um produto ativo do catálogo desta clínica.",
  "Uma compra finalizada não pode ser alterada.",
  "A tentativa anterior já registrou a compra. Atualize a lista antes de editar.",
]);

export async function salvarCompraControladoServidor(entrada: EntradaGravarCompraControlado) {
  await autorizar(entrada, true);
  const { data, error } = await clienteSupabaseUsuario(entrada.accessToken).rpc(
    "oricse_salvar_compra_controlada",
    {
      p_clinica_id: entrada.clinicaId,
      p_id: entrada.id ?? null,
      p_requisicao_id: entrada.id ? null : (entrada.requestId ?? crypto.randomUUID()),
      p_data_compra: entrada.dataCompra,
      p_produto_id: entrada.produtoId,
      p_quantidade: entrada.quantidade,
      p_fornecedor: entrada.fornecedor,
      p_nota_fiscal: entrada.notaFiscal,
      p_lote: entrada.lote,
      p_finalizar: entrada.finalizar,
    },
  );
  if (error || !data) {
    if (error?.code === "42501")
      throw new Error("Seu acesso não permite registrar compras nesta clínica.");
    if (error && MENSAGENS_RPC.has(error.message)) throw new Error(error.message);
    throw new Error("Não foi possível registrar a compra.");
  }
  return converter(data as RegistroCompra);
}
