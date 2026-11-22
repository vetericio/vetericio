/** Prazos de retorno calculados em dias corridos no calendário da clínica (Brasil). */
export const OPCOES_DIAS_RETORNO = [3, 5, 7, 10, 15, 30, 45, 60, 90, 180, 365] as const;

export function hojeRetornoBrasil(): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

function diaUtc(dataISO: string): number {
  const [ano, mes, dia] = dataISO.slice(0, 10).split("-").map(Number);
  return Date.UTC(ano, mes - 1, dia);
}

/** Soma dias de calendário, sem erro de horário de verão/fuso. */
export function calcularDataRetorno(dias: number, baseISO = hojeRetornoBrasil()): string {
  if (!Number.isInteger(dias) || dias < 0) throw new Error("Prazo de retorno inválido.");
  return new Date(diaUtc(baseISO) + dias * 86_400_000).toISOString().slice(0, 10);
}

export function diasAteRetorno(dataISO: string, referenciaISO = hojeRetornoBrasil()): number {
  return Math.round((diaUtc(dataISO) - diaUtc(referenciaISO)) / 86_400_000);
}

export type SituacaoPrazoRetorno = "a_marcar" | "programado" | "no_prazo" | "hoje" | "atrasado";

export function situacaoPrazoRetorno(dataISO: string | null, referenciaISO = hojeRetornoBrasil()): SituacaoPrazoRetorno {
  if (!dataISO) return "a_marcar";
  const dias = diasAteRetorno(dataISO, referenciaISO);
  if (dias < 0) return "atrasado";
  if (dias === 0) return "hoje";
  return dias <= 2 ? "no_prazo" : "programado";
}

export function formatarDataRetorno(dataISO: string): string {
  const [ano, mes, dia] = dataISO.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}
