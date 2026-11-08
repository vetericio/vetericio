// Rules for the automatic mode, per account. They gate what the assistant may schedule on its own:
// anything outside the rules goes to human approval instead of the queue (it is never silently dropped).
type Admin = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];

const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

export async function checkRules(
  admin: Admin,
  post: {
    id?: string;
    instagram_account_id: string;
    tipo: string;
    legenda: string | null;
    campanha: string | null;
    agendado_para: string | null;
  },
): Promise<string[]> {
  const { data: r } = await admin
    .from("regras_publicacao")
    .select("*")
    .eq("instagram_account_id", post.instagram_account_id)
    .maybeSingle();
  const { data: brand } = await admin
    .from("brands")
    .select("temas_proibidos")
    .eq("instagram_account_id", post.instagram_account_id)
    .maybeSingle();
  const out: string[] = [];
  if (!r) return ["A conta não tem regras de automação configuradas."];
  if (!r.ativa) out.push("As regras de automação desta conta estão desligadas.");
  if (r.suspensa_em)
    out.push(`A automação desta conta está suspensa: ${r.motivo_suspensao ?? "falhas seguidas"}.`);
  if (!r.formatos.includes(post.tipo))
    out.push(`O formato “${post.tipo}” não está entre os permitidos no modo automático.`);

  if (post.agendado_para) {
    const t = new Date(post.agendado_para);
    const br = new Date(t.getTime() - 3 * 3600_000);
    const h = br.getUTCHours();
    if (h < r.hora_inicio || h >= r.hora_fim)
      out.push(`Horário fora da janela permitida (${r.hora_inicio}h às ${r.hora_fim}h).`);
    if (!r.dias_semana.includes(br.getUTCDay()))
      out.push(`Publicações automáticas não são permitidas em ${DIAS[br.getUTCDay()]}.`);

    const dayStart = new Date(Date.UTC(br.getUTCFullYear(), br.getUTCMonth(), br.getUTCDate(), 3));
    const weekStart = new Date(dayStart.getTime() - ((br.getUTCDay() + 6) % 7) * 86_400_000);
    const count = async (from: Date, days: number) => {
      let q = admin
        .from("posts")
        .select("id", { count: "exact", head: true })
        .eq("instagram_account_id", post.instagram_account_id)
        .in("status", ["agendado", "processando", "publicado", "aguardando_aprovacao"])
        .gte("agendado_para", from.toISOString())
        .lt("agendado_para", new Date(from.getTime() + days * 86_400_000).toISOString());
      if (post.id) q = q.neq("id", post.id);
      return (await q).count ?? 0;
    };
    if ((await count(dayStart, 1)) >= r.max_por_dia)
      out.push(`Limite de ${r.max_por_dia} publicação(ões) por dia atingido.`);
    if ((await count(weekStart, 7)) >= r.max_por_semana)
      out.push(`Limite de ${r.max_por_semana} publicação(ões) por semana atingido.`);
  }

  const texto = (post.legenda ?? "").toLowerCase();
  const proibidas = [
    ...r.palavras_proibidas,
    ...(brand?.temas_proibidos ?? "")
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 3),
  ];
  const hit = proibidas.find((p) => p && texto.includes(p.toLowerCase()));
  if (hit) out.push(`A legenda menciona um tema proibido: “${hit}”.`);
  if (
    post.campanha &&
    r.campanhas_com_aprovacao.some((c) => c.toLowerCase() === post.campanha!.toLowerCase())
  ) {
    out.push(`A campanha “${post.campanha}” exige aprovação humana.`);
  }
  return out;
}

/** Called after a failure: suspends the account's automation after N consecutive failures. */
export async function registerFailure(admin: Admin, accountId: string) {
  const { data: r } = await admin
    .from("regras_publicacao")
    .select("suspender_apos_falhas, suspensa_em")
    .eq("instagram_account_id", accountId)
    .maybeSingle();
  if (!r || r.suspensa_em) return false;
  const { data: last } = await admin
    .from("posts")
    .select("status")
    .eq("instagram_account_id", accountId)
    .in("status", ["publicado", "falhou"])
    .order("updated_at", { ascending: false })
    .limit(r.suspender_apos_falhas);
  if ((last ?? []).length >= r.suspender_apos_falhas && last!.every((p) => p.status === "falhou")) {
    await admin
      .from("regras_publicacao")
      .update({
        suspensa_em: new Date().toISOString(),
        motivo_suspensao: `${r.suspender_apos_falhas} falhas de publicação seguidas`,
      })
      .eq("instagram_account_id", accountId);
    return true;
  }
  return false;
}
