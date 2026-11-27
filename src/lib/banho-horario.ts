export const FUSO_BANHO = "America/Sao_Paulo";

const calendario = new Intl.DateTimeFormat("sv-SE", {
  timeZone: FUSO_BANHO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const local = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const absoluto = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/i;

export function horaGradeBanho(instante: string | Date) {
  const d = new Date(instante);
  return Number.isFinite(d.getTime()) ? calendario.format(d).replace(" ", "T") : "";
}

/** Accepts old timezone-less links as Brasília wall time and converts new UTC links. */
export function horaBanhoDoLink(valor: string | null) {
  if (!valor) return "";
  if (local.test(valor)) return Number.isFinite(instanteBanho(valor).getTime()) ? valor : "";
  return absoluto.test(valor) ? horaGradeBanho(valor) : "";
}

/** Form wall time in the same zone used by the scheduling/series database. */
export function instanteBanho(valor: string) {
  if (absoluto.test(valor)) return new Date(valor);
  if (!local.test(valor)) return new Date(NaN);
  const base = new Date(`${valor}:00Z`);
  if (!Number.isFinite(base.getTime()) || base.toISOString().slice(0, 16) !== valor)
    return new Date(NaN);
  let candidato = base;
  for (let i = 0; i < 3; i++) {
    const exibido = horaGradeBanho(candidato);
    if (exibido === valor) return candidato;
    candidato = new Date(candidato.getTime() + base.getTime() - Date.parse(`${exibido}:00Z`));
  }
  return new Date(NaN);
}
