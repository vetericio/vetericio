// Loads real data for a period, builds the report and stores it (one per type/period/scope).
import type { DailyInput, MediaInput } from "../analysis";
import { buildReport, shiftDay } from "../report";
import { diaBrasilia } from "../metrics";

type Admin = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];

export async function generateReport(
  admin: Admin,
  tipo: string,
  inicio: string,
  fim: string,
  accountId: string | null,
) {
  let q = admin.from("instagram_accounts").select("id, username").eq("gerenciada", true);
  if (accountId) q = q.eq("id", accountId);
  const { data: accounts } = await q;
  const desde = shiftDay(inicio, -120);

  const contas = [];
  for (const a of accounts ?? []) {
    const [{ data: media }, { data: daily }, { data: brand }, { data: falhas }] = await Promise.all(
      [
        admin
          .from("ig_media")
          .select(
            "ig_media_id, publicado_em, media_type, media_product_type, caption, permalink, insights",
          )
          .eq("instagram_account_id", a.id)
          .gte("publicado_em", `${desde}T00:00:00Z`)
          .lte("publicado_em", `${shiftDay(fim, 1)}T03:00:00Z`),
        admin
          .from("metric_snapshots")
          .select("dia, metrica, valor")
          .eq("instagram_account_id", a.id)
          .is("ig_media_id", null)
          .gte("dia", desde)
          .lte("dia", fim),
        admin
          .from("brands")
          .select("frequencia_semanal")
          .eq("instagram_account_id", a.id)
          .maybeSingle(),
        admin
          .from("posts")
          .select("titulo, legenda, ultimo_erro, agendado_para")
          .eq("instagram_account_id", a.id)
          .eq("status", "falhou")
          .gte("agendado_para", `${inicio}T03:00:00Z`)
          .lte("agendado_para", `${shiftDay(fim, 1)}T03:00:00Z`),
      ],
    );
    contas.push({
      id: a.id,
      username: a.username ?? a.id,
      frequenciaSemanal: brand?.frequencia_semanal ?? null,
      media: (media ?? []).map((m) => ({
        ...m,
        insights: (m.insights ?? {}) as Record<string, number>,
      })) as MediaInput[],
      daily: (daily ?? []).map((d) => ({
        dia: d.dia!,
        metrica: d.metrica,
        valor: d.valor == null ? null : Number(d.valor),
      })) as DailyInput[],
      falhas: (falhas ?? []).map(
        (f) => `${f.titulo || (f.legenda ?? "").slice(0, 40)}: ${f.ultimo_erro ?? "erro"}`,
      ),
    });
  }

  const conteudo = buildReport({ tipo, inicio, fim, contas });
  let del = admin.from("reports").delete().eq("tipo", tipo).eq("periodo_inicio", inicio);
  del = accountId
    ? del.eq("instagram_account_id", accountId)
    : del.is("instagram_account_id", null);
  await del;
  const { data, error } = await admin
    .from("reports")
    .insert({
      tipo,
      periodo_inicio: inicio,
      periodo_fim: fim,
      instagram_account_id: accountId,
      conteudo: conteudo as any,
      gerado_em: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw new Error(`Falha ao salvar relatório: ${error.message}`);
  return data.id;
}

/** Daily job: yesterday's report every day, the weekly one on Mondays, the monthly one on the 1st. */
export async function runScheduledReports(admin: Admin, now = new Date()) {
  const hoje = diaBrasilia(now);
  const ontem = shiftDay(hoje, -1);
  const gerados: string[] = [];
  gerados.push(await generateReport(admin, "diario", ontem, ontem, null));
  const dow = new Date(`${hoje}T12:00:00Z`).getUTCDay();
  if (dow === 1)
    gerados.push(await generateReport(admin, "semanal", shiftDay(hoje, -7), ontem, null));
  if (hoje.endsWith("-01")) {
    const ini = `${ontem.slice(0, 7)}-01`;
    gerados.push(await generateReport(admin, "mensal", ini, ontem, null));
    const { data: accs } = await admin
      .from("instagram_accounts")
      .select("id")
      .eq("gerenciada", true);
    for (const a of accs ?? [])
      gerados.push(await generateReport(admin, "mensal", ini, ontem, a.id));
  }
  return gerados;
}
