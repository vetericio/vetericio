export const DURACOES_ATENDIMENTO = {
  Consulta: 30,
  Retorno: 30,
  Cirurgia: 120,
  "Banho e Tosa": 60,
  Vacina: 30,
  Procedimento: 30,
};

export const TIPOS_ATENDIMENTO = Object.keys(DURACOES_ATENDIMENTO) as Array<keyof typeof DURACOES_ATENDIMENTO>;
export const LIMITE_PDF_TERMO = 5 * 1024 * 1024;

export type AreaProtegida = "assinar" | "receituario";

export function intervaloNovaAgenda(valor: number | null) {
  return valor !== null && Number.isInteger(valor) && valor >= 5 && valor <= 240 ? valor : 30;
}
