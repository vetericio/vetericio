/** Compare-and-swap of JSON state keys; called inside the single Cloudflare coordinator. */
export type EstadoChange = { chave: string; valor: string | null; esperado?: string | null };

export function validarVersaoEstado(
  estado: Record<string, string>,
  alteracoes: EstadoChange[],
) {
  for (const alteracao of alteracoes) {
    if (!Object.prototype.hasOwnProperty.call(alteracao, "esperado")) continue;
    const atual = estado[alteracao.chave] ?? null;
    const anterior = alteracao.esperado ?? null;
    const novo = alteracao.valor ?? null;
    // Repeated delivery of an already applied mutation is idempotent.
    if (atual === anterior || atual === novo) continue;
    const error = new Error(
      "Outros usuários alteraram dados de " + alteracao.chave +
      ". Atualize a tela e revise antes de salvar.",
    );
    Object.assign(error, { code: "DRIVE_CONFLICT", field: alteracao.chave });
    throw error;
  }
}
