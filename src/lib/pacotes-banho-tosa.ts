export type PacoteBanho = {
  id: string;
  nome: string;
  servicoId: string;
  servicoNome: string;
  validade: string;
  vendidoEm: string;
  total: number;
  usadas: number;
  reservadas: number;
  saldo: number;
  disponiveis: number;
  status: "ativo" | "vencido" | "esgotado" | "suspenso";
  historico: { consumidoEm: string }[];
};

export type VendaPacoteBanho = {
  p_clinica: string;
  p_animal: string;
  p_servico: string;
  p_nome: string;
  p_sessoes: number;
  p_validade: string;
  p_valor_centavos: number;
  p_forma: string;
  p_requisicao: string;
};

export const formasPacoteBanho = ["Pix", "Dinheiro", "Débito", "Crédito", "Transferência"];
export const statusPacoteBanho: Record<PacoteBanho["status"], string> = {
  ativo: "Ativo",
  vencido: "Vencido",
  esgotado: "Esgotado",
  suspenso: "Suspenso",
};

export function diaDoPacote(iso: string | number | Date) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date(iso));
}

export function pacoteElegivel(pacote: PacoteBanho, servico: string, inicio: Date, hoje: string) {
  if (!Number.isFinite(inicio.getTime())) return false;
  const dia = diaDoPacote(inicio);
  return (
    pacote.status === "ativo" &&
    pacote.disponiveis > 0 &&
    pacote.servicoId === servico &&
    pacote.validade >= hoje &&
    dia <= pacote.validade &&
    dia >= diaDoPacote(pacote.vendidoEm)
  );
}
