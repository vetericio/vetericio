// Alerts without duplicates: at most one open alert per (account, type, key). Raising an alert that is
// already open does nothing; resolving closes it so a new occurrence can alert again later.
type Admin = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];

export type AlertInput = {
  instagram_account_id: string | null;
  tipo: string;
  chave?: string;
  severidade: "baixa" | "media" | "alta";
  mensagem: string;
  detalhe?: Record<string, unknown>;
};

export async function raiseAlert(admin: Admin, a: AlertInput) {
  let q = admin
    .from("alerts")
    .select("id")
    .eq("tipo", a.tipo)
    .eq("chave", a.chave ?? "")
    .eq("resolvido", false);
  q = a.instagram_account_id
    ? q.eq("instagram_account_id", a.instagram_account_id)
    : q.is("instagram_account_id", null);
  const { data: open } = await q.limit(1);
  if (open?.length) return false;
  const { error } = await admin.from("alerts").insert({
    instagram_account_id: a.instagram_account_id,
    tipo: a.tipo,
    chave: a.chave ?? "",
    severidade: a.severidade,
    mensagem: a.mensagem.slice(0, 500),
    detalhe: (a.detalhe ?? {}) as any,
  });
  return !error; // unique index rejects a concurrent duplicate
}

export async function resolveAlerts(
  admin: Admin,
  accountId: string | null,
  tipo: string,
  chave?: string,
) {
  let q = admin
    .from("alerts")
    .update({ resolvido: true, resolvido_em: new Date().toISOString() })
    .eq("tipo", tipo)
    .eq("resolvido", false);
  q = accountId ? q.eq("instagram_account_id", accountId) : q.is("instagram_account_id", null);
  if (chave !== undefined) q = q.eq("chave", chave);
  await q;
}

export type AlertLimits = {
  queda_alcance_pct: number;
  aprovacao_horas: number;
  variacao_incomum_pct: number;
};
export const DEFAULT_LIMITS: AlertLimits = {
  queda_alcance_pct: 30,
  aprovacao_horas: 12,
  variacao_incomum_pct: 150,
};

export async function limitsFor(admin: Admin, accountId: string): Promise<AlertLimits> {
  const { data } = await admin
    .from("brands")
    .select("limites_alerta")
    .eq("instagram_account_id", accountId)
    .maybeSingle();
  return { ...DEFAULT_LIMITS, ...((data?.limites_alerta as Partial<AlertLimits>) ?? {}) };
}
