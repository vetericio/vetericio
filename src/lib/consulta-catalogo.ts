export const SERVICO_CONSULTA_PADRAO = {
  tipo: "servico",
  nome: "Consulta",
  categoria: "Consultas",
} as const;

type IdentidadeItem = { tipo: "servico" | "produto"; nome: string; canonico?: boolean };

function normalizarNome(nome: string) {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

export function encontrarServicoConsulta<T extends IdentidadeItem>(
  itens: readonly T[],
): T | undefined {
  const servicos = itens.filter(
    (item) =>
      item.tipo === "servico" &&
      /^consulta( clinica| veterinaria)?$/.test(normalizarNome(item.nome)),
  );
  const canonicos = servicos.filter((item) => item.canonico);
  const disponiveis = canonicos.length ? canonicos : servicos;
  return disponiveis.find((item) => normalizarNome(item.nome) === "consulta") ?? disponiveis[0];
}

export function valorFixoDoCatalogo(valor: number | string | null | undefined) {
  // Um valor ausente não é uma consulta de R$ 0,00. Zero explícito continua válido.
  if (valor == null || (typeof valor === "string" && !valor.trim())) return "";
  const numero = Number(valor);
  return Number.isFinite(numero) && numero >= 0 ? numero.toFixed(2).replace(".", ",") : "";
}

export function sugerirValorDaConsulta({
  valorCatalogo,
  usaFaixas,
  valorEditado,
  valorComAprovacao,
}: {
  valorCatalogo?: number | string | null;
  usaFaixas: boolean;
  valorEditado?: string;
  valorComAprovacao?: string;
}) {
  if (usaFaixas) return valorComAprovacao ?? "";
  return valorEditado ?? valorFixoDoCatalogo(valorCatalogo);
}
