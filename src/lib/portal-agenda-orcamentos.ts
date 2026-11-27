import { supabaseBanco } from "@/integrations/supabase/client";

export type AgendaPortalMarcacao = {
  id: string;
  inicio: string;
  estado: string;
  tipo: string;
  animal_id: string | null;
};
export type AgendaPortalEvento = {
  id: string;
  agendamento_id: string;
  tipo: "confirmacao" | "pedido" | "resposta";
  pedido_id: string | null;
  mensagem: string;
  criado_em: string;
  horario_referencia: string;
  inicio: string;
  estado: string;
  servico: string;
  animal: string;
  tutor: string;
};
export type ItemOrcamentoPortal = {
  id: string;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  subtotalCentavos: number;
};
export type OrcamentoPortal = {
  id: string;
  estado: "compartilhado" | "aprovado" | "convertido";
  total_centavos: number;
  observacoes: string;
  itens: ItemOrcamentoPortal[];
  validade_em: string;
  compartilhado_em: string;
  aprovado_em: string | null;
  convertido_em: string | null;
  animal_id: string;
  animal: string;
  tutor: string;
  comanda_id: string | null;
  comanda_numero: number | null;
  vencido: boolean;
};

// The generated Supabase definitions lag planned migrations; this adapter
// limits dynamic RPC typing to the explicit contracts in this module.
type RpcResult = { data: unknown; error: { message: string } | null };
export async function rpcPortal<T>(nome: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await (
    supabaseBanco.rpc as unknown as (
      nome: string,
      args: Record<string, unknown>,
    ) => PromiseLike<RpcResult>
  ).call(supabaseBanco, nome, args);
  if (error) throw new Error(error.message);
  return data as T;
}
export function dataHoraPortal(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  });
}
export function mesmoHorarioPortal(a: string, b: string) {
  return Date.parse(a) === Date.parse(b);
}
export function estadoOrcamentoTextual(o: OrcamentoPortal) {
  if (o.estado === "convertido") return "Convertido em comanda";
  if (o.estado === "aprovado") return "Aprovado pelo tutor";
  return o.vencido ? "Vencido" : "Aguardando aprovação";
}
export const reaisPortal = (centavos: number) =>
  (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
