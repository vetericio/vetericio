export type CotaPerfisClinica = { ilimitado: boolean; limite: number | null; bonus_perfis: number };

export function parseCotaPerfisClinica(value: unknown): CotaPerfisClinica | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const bonus = Number(row.bonus_perfis);
  if ((row.bonus_perfis !== 0 && row.bonus_perfis !== 2) || typeof row.ilimitado !== "boolean") return null;
  if (row.ilimitado) return row.limite === null && bonus === 0
    ? { ilimitado: true, limite: null, bonus_perfis: 0 }
    : null;
  return typeof row.limite === "number" && Number.isSafeInteger(row.limite) && row.limite > 0
    ? { ilimitado: false, limite: row.limite, bonus_perfis: bonus }
    : null;
}
