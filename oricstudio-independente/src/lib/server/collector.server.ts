// Collects real data from Meta: profile (followers), daily account insights, media list and media
// insights, stories (whose insights expire in 24h) and comments. Runs hourly; each part has its own
// refresh interval to respect API limits. Missing metrics are stored as absent, never as zero.
import { CORE_MEDIA_METRICS, diaBrasilia, mediaMetricsFor } from "../metrics";
import { classify, needsBrandReply, suggestReply } from "../comment-classifier";
import { GraphError, graphGet, graphPost } from "./meta.server";
import { accountContext, type Ctx } from "./publisher.server";
import { limitsFor, raiseAlert, resolveAlerts } from "./alerts.server";

type Admin = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];

const ACCOUNT_METRICS = [
  "reach",
  "views",
  "accounts_engaged",
  "total_interactions",
  "likes",
  "comments",
  "shares",
  "saves",
  "replies",
  "profile_links_taps",
  "follows_and_unfollows",
];
const DAILY_REFRESH_MS = 6 * 3600_000;
const MEDIA_REFRESH_MS = 6 * 3600_000;
const MAX_MEDIA_INSIGHTS_PER_RUN = 25;

export type Resumo = Record<string, string | number | string[] | null>;
type Account = { id: string; ig_user_id: string; username: string | null };

export async function runCollection(admin: Admin, onlyAccountId?: string) {
  let q = admin
    .from("instagram_accounts")
    .select("id, ig_user_id, username")
    .eq("gerenciada", true)
    .eq("status", "ativa");
  if (onlyAccountId) q = q.eq("id", onlyAccountId);
  const { data: accounts } = await q;
  const resultados: Resumo[] = [];
  for (const acc of accounts ?? []) {
    try {
      const ctx = await accountContext(admin, acc.id);
      if (!ctx) throw new Error("Sem token da Página para esta conta.");
      const r = await collectAccount(admin, acc, ctx);
      await resolveAlerts(admin, acc.id, "coleta");
      resultados.push({ conta: acc.username, ...r });
    } catch (e: any) {
      const msg = String(e?.message || e).slice(0, 300);
      await raiseAlert(admin, {
        instagram_account_id: acc.id,
        tipo: "coleta",
        severidade: "media",
        mensagem: `Falha ao coletar dados de @${acc.username}: ${msg}`,
      });
      resultados.push({ conta: acc.username, erro: msg });
    }
  }
  await admin
    .from("app_settings")
    .update({ ultimo_ciclo_coleta: new Date().toISOString() })
    .eq("id", true);
  return resultados;
}

async function collectAccount(admin: Admin, acc: Account, ctx: Ctx) {
  const hoje = diaBrasilia(new Date());
  const out: Resumo = {};

  // Profile → followers snapshot for today (overwritten during the day)
  const prof = await graphGet<{
    followers_count?: number;
    follows_count?: number;
    media_count?: number;
  }>(`${ctx.graph}/${ctx.igUserId}`, {
    fields: "followers_count,follows_count,media_count",
    access_token: ctx.token,
  });
  if (prof.followers_count != null) {
    await upsertDaily(admin, acc.id, "followers_count", hoje, prof.followers_count, "perfil");
    await admin
      .from("instagram_accounts")
      .update({ seguidores: prof.followers_count })
      .eq("id", acc.id);
  }

  // Daily account insights (backfill 30 days the first time, then refresh the last 3 days every 6h)
  const { data: lastReach } = await admin
    .from("metric_snapshots")
    .select("coletado_em, dia")
    .eq("instagram_account_id", acc.id)
    .eq("metrica", "reach")
    .is("ig_media_id", null)
    .order("coletado_em", { ascending: false })
    .limit(1);
  const stale =
    !lastReach?.length ||
    Date.now() - new Date(lastReach[0]!.coletado_em).getTime() > DAILY_REFRESH_MS;
  if (stale) {
    const days = lastReach?.length ? 3 : 30;
    const indisponiveis = new Set<string>();
    for (let i = days; i >= 1; i--) {
      const dia = diaBrasilia(new Date(Date.now() - i * 86_400_000));
      const since = Math.floor(new Date(`${dia}T03:00:00Z`).getTime() / 1000);
      const values = await accountInsights(ctx, since, since + 86_400, indisponiveis);
      for (const [metrica, valor] of Object.entries(values))
        await upsertDaily(admin, acc.id, metrica, dia, valor, "insights_conta");
    }
    out["dias_coletados"] = days;
    if (indisponiveis.size) out["metricas_indisponiveis"] = [...indisponiveis];
  }

  // Media list (feed + reels) and stories
  const media = await graphGet<{ data: any[] }>(`${ctx.graph}/${ctx.igUserId}/media`, {
    fields:
      "id,caption,media_type,media_product_type,permalink,thumbnail_url,media_url,timestamp,like_count,comments_count",
    limit: "50",
    access_token: ctx.token,
  });
  const stories = await graphGet<{ data: any[] }>(`${ctx.graph}/${ctx.igUserId}/stories`, {
    fields: "id,caption,media_type,media_product_type,permalink,thumbnail_url,media_url,timestamp",
    access_token: ctx.token,
  }).catch(() => ({ data: [] as any[] }));
  const all = [...media.data, ...stories.data.map((s) => ({ ...s, media_product_type: "STORY" }))];
  const { data: ours } = await admin
    .from("posts")
    .select("id, ig_media_id")
    .eq("instagram_account_id", acc.id)
    .not("ig_media_id", "is", null);
  const postByMedia = new Map((ours ?? []).map((p) => [p.ig_media_id, p.id]));
  for (const m of all) {
    await admin.from("ig_media").upsert(
      {
        ig_media_id: m.id,
        instagram_account_id: acc.id,
        post_id: postByMedia.get(m.id) ?? null,
        media_type: m.media_type ?? null,
        media_product_type: m.media_product_type ?? null,
        caption: m.caption ?? null,
        permalink: m.permalink ?? null,
        thumbnail_url: m.thumbnail_url ?? m.media_url ?? null,
        publicado_em: m.timestamp ?? null,
        like_count: m.like_count ?? null,
        comments_count: m.comments_count ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "ig_media_id" },
    );
  }
  out["midias"] = all.length;

  // Media insights: stories every run (they expire), recent posts every 6h, limited per run
  const { data: due } = await admin
    .from("ig_media")
    .select("ig_media_id, media_type, media_product_type, insights_em, publicado_em")
    .eq("instagram_account_id", acc.id)
    .gte("publicado_em", new Date(Date.now() - 90 * 86_400_000).toISOString())
    .order("publicado_em", { ascending: false });
  const now = Date.now();
  const toRefresh = (due ?? [])
    .filter((m) => {
      if (m.media_product_type === "STORY")
        return now - new Date(m.publicado_em!).getTime() < 24 * 3600_000;
      const age = now - new Date(m.publicado_em!).getTime();
      const interval = age < 7 * 86_400_000 ? MEDIA_REFRESH_MS : 24 * 3600_000;
      return !m.insights_em || now - new Date(m.insights_em).getTime() > interval;
    })
    .slice(0, MAX_MEDIA_INSIGHTS_PER_RUN);
  let ok = 0;
  for (const m of toRefresh) {
    const res = await mediaInsights(
      ctx,
      m.ig_media_id,
      mediaMetricsFor(m.media_product_type, m.media_type),
    );
    await admin
      .from("ig_media")
      .update({
        insights: res.values as any,
        insights_em: new Date().toISOString(),
        insights_erro: res.erro,
      })
      .eq("ig_media_id", m.ig_media_id);
    const rows = Object.entries(res.values).map(([metrica, valor]) => ({
      instagram_account_id: acc.id,
      ig_media_id: m.ig_media_id,
      metrica,
      valor,
      origem: "insights_midia",
      periodo: "lifetime",
    }));
    if (rows.length) await admin.from("metric_snapshots").insert(rows);
    if (!res.erro) ok++;
  }
  out["insights_midias"] = `${ok}/${toRefresh.length}`;

  out["comentarios_novos"] = await collectComments(admin, acc, ctx);
  await metricAlerts(admin, acc);
  return out;
}

async function accountInsights(ctx: Ctx, since: number, until: number, indisponiveis: Set<string>) {
  const values: Record<string, number> = {};
  const ask = async (metrics: string[]) => {
    const r = await graphGet<{ data: { name: string; total_value?: { value: number } }[] }>(
      `${ctx.graph}/${ctx.igUserId}/insights`,
      {
        metric: metrics.join(","),
        metric_type: "total_value",
        period: "day",
        since: String(since),
        until: String(until),
        access_token: ctx.token,
      },
    );
    for (const d of r.data) if (d.total_value?.value != null) values[d.name] = d.total_value.value;
  };
  const wanted = ACCOUNT_METRICS.filter((m) => !indisponiveis.has(m));
  try {
    await ask(wanted);
  } catch (e) {
    if (!(e instanceof GraphError)) throw e;
    // One invalid metric fails the whole call: retry one by one and remember which are unavailable.
    for (const m of wanted) {
      try {
        await ask([m]);
      } catch (err) {
        if (!(err instanceof GraphError)) throw err;
        indisponiveis.add(m);
      }
    }
  }
  return values;
}

async function mediaInsights(ctx: Ctx, mediaId: string, metrics: string[]) {
  const values: Record<string, number> = {};
  const ask = async (ms: string[]) => {
    const r = await graphGet<{
      data: { name: string; values?: { value: number }[]; total_value?: { value: number } }[];
    }>(`${ctx.graph}/${mediaId}/insights`, { metric: ms.join(","), access_token: ctx.token });
    for (const d of r.data) {
      const v = d.total_value?.value ?? d.values?.[0]?.value;
      if (typeof v === "number") values[d.name] = v;
    }
  };
  try {
    await ask(metrics);
    return { values, erro: null as string | null };
  } catch (e) {
    if (!(e instanceof GraphError)) throw e;
    try {
      await ask(CORE_MEDIA_METRICS.filter((m) => metrics.includes(m)));
      return { values, erro: `Algumas métricas indisponíveis: ${e.message}`.slice(0, 300) };
    } catch (e2: any) {
      return { values, erro: `Métricas indisponíveis: ${String(e2?.message || e2)}`.slice(0, 300) };
    }
  }
}

async function upsertDaily(
  admin: Admin,
  accountId: string,
  metrica: string,
  dia: string,
  valor: number,
  origem: string,
) {
  await admin
    .from("metric_snapshots")
    .delete()
    .eq("instagram_account_id", accountId)
    .eq("metrica", metrica)
    .eq("dia", dia)
    .is("ig_media_id", null);
  await admin.from("metric_snapshots").insert({
    instagram_account_id: accountId,
    metrica,
    dia,
    valor,
    origem,
    periodo: "day",
    coletado_em: new Date().toISOString(),
  });
}

async function collectComments(admin: Admin, acc: Account, ctx: Ctx) {
  const { data: medias } = await admin
    .from("ig_media")
    .select("ig_media_id, comments_count")
    .eq("instagram_account_id", acc.id)
    .neq("media_product_type", "STORY")
    .gt("comments_count", 0)
    .gte("publicado_em", new Date(Date.now() - 30 * 86_400_000).toISOString())
    .limit(20);
  const { data: brand } = await admin
    .from("brands")
    .select("contato_resposta")
    .eq("instagram_account_id", acc.id)
    .maybeSingle();
  const { data: settings } = await admin
    .from("app_settings")
    .select("modo_autonomia, pausa_geral")
    .eq("id", true)
    .maybeSingle();
  const { data: regras } = await admin
    .from("regras_publicacao")
    .select("respostas_automaticas, suspensa_em")
    .eq("instagram_account_id", acc.id)
    .maybeSingle();
  const autoReply =
    settings?.modo_autonomia === "gestao_ampliada" &&
    !settings.pausa_geral &&
    !!regras?.respostas_automaticas &&
    !regras.suspensa_em;

  let novos = 0;
  for (const m of medias ?? []) {
    const r = await graphGet<{ data: any[] }>(`${ctx.graph}/${m.ig_media_id}/comments`, {
      fields:
        "id,text,timestamp,username,like_count,hidden,replies{id,text,timestamp,username,like_count}",
      limit: "50",
      access_token: ctx.token,
    }).catch(() => ({ data: [] as any[] }));
    const flat = r.data.flatMap((c) => [
      c,
      ...((c.replies?.data ?? []) as any[]).map((x) => ({ ...x, parent: c.id })),
    ]);
    const ids = flat.map((c) => c.id);
    const { data: existing } = ids.length
      ? await admin
          .from("comments")
          .select(
            "ig_comment_id, respondido, arquivado, sugestao_por, categoria, resposta_sugerida",
          )
          .in("ig_comment_id", ids)
      : { data: [] };
    const knownRows = new Map((existing ?? []).map((e) => [e.ig_comment_id, e]));
    const repliedByUs = new Set(
      flat.filter((c) => c.parent && c.username === acc.username).map((c) => c.parent),
    );
    for (const c of flat) {
      const proprio = c.username === acc.username;
      const cls = classify(c.text ?? "");
      const precisaResposta = needsBrandReply(c.text ?? "", !!c.parent, acc.username);
      const sugestao =
        proprio || !precisaResposta
          ? null
          : suggestReply(cls.categoria, c.username ?? null, brand?.contato_resposta ?? null);
      const row = knownRows.get(c.id);
      if (row) {
        // Keep template suggestions up to date; never touch answered, archived or assistant-written ones.
        const refresh =
          !proprio && !row.respondido && !row.arquivado && row.sugestao_por === "modelo";
        await admin
          .from("comments")
          .update({
            like_count: c.like_count ?? null,
            oculto: !!c.hidden,
            ...(repliedByUs.has(c.id) ? { respondido: true } : {}),
            ...(refresh
              ? {
                  categoria: cls.categoria,
                  precisa_humano: cls.precisaHumano,
                  motivo_humano: cls.motivo,
                  resposta_sugerida: sugestao,
                }
              : {}),
          })
          .eq("ig_comment_id", c.id);
        continue;
      }
      await admin.from("comments").insert({
        instagram_account_id: acc.id,
        ig_comment_id: c.id,
        ig_media_id: m.ig_media_id,
        parent_ig_comment_id: c.parent ?? null,
        autor: c.username ?? null,
        texto: c.text ?? null,
        publicado_em: c.timestamp ?? null,
        like_count: c.like_count ?? null,
        oculto: !!c.hidden,
        respondido: proprio || repliedByUs.has(c.id),
        arquivado: proprio,
        categoria: proprio ? "outro" : cls.categoria,
        precisa_humano: !proprio && cls.precisaHumano,
        motivo_humano: cls.motivo,
        resposta_sugerida: sugestao,
      });
      if (!proprio) novos++;
      if (cls.precisaHumano && !proprio) {
        await raiseAlert(admin, {
          instagram_account_id: acc.id,
          tipo: "comentario_sensivel",
          chave: c.id,
          severidade: cls.categoria === "sensivel" ? "alta" : "media",
          mensagem: `Comentário de @${c.username} precisa de atenção humana: “${(c.text ?? "").slice(0, 120)}”`,
        });
      }
      // Automatic replies: only in "gestão ampliada", only if enabled for the account, only for praise,
      // questions and commercial interest, only top-level, recent and not already answered.
      const recente = c.timestamp && Date.now() - new Date(c.timestamp).getTime() < 48 * 3600_000;
      if (
        autoReply &&
        !proprio &&
        !c.parent &&
        recente &&
        sugestao &&
        ["elogio", "pergunta", "oportunidade"].includes(cls.categoria) &&
        !repliedByUs.has(c.id)
      ) {
        try {
          await graphPost(`${ctx.graph}/${c.id}/replies`, {
            message: sugestao,
            access_token: ctx.token,
          });
          await admin
            .from("comments")
            .update({
              respondido: true,
              resposta_enviada: sugestao,
              respondido_em: new Date().toISOString(),
              respondido_por: "automatico",
            })
            .eq("ig_comment_id", c.id);
        } catch {
          /* stays pending for a human */
        }
      }
    }
  }
  return novos;
}

async function metricAlerts(admin: Admin, acc: Account) {
  const limits = await limitsFor(admin, acc.id);
  const { data } = await admin
    .from("metric_snapshots")
    .select("dia, valor")
    .eq("instagram_account_id", acc.id)
    .eq("metrica", "reach")
    .is("ig_media_id", null)
    .order("dia", { ascending: false })
    .limit(14);
  const vals = (data ?? []).filter((d) => d.valor != null);
  if (vals.length < 14) return; // not enough history: no alert on incomplete data
  const last = vals.slice(0, 7).reduce((a, d) => a + Number(d.valor), 0);
  const prev = vals.slice(7, 14).reduce((a, d) => a + Number(d.valor), 0);
  if (prev < 50) return;
  const v = ((last - prev) / prev) * 100;
  const semana = vals[0]!.dia!;
  if (v <= -limits.queda_alcance_pct) {
    await raiseAlert(admin, {
      instagram_account_id: acc.id,
      tipo: "queda_alcance",
      chave: semana,
      severidade: "media",
      mensagem: `Alcance de @${acc.username} caiu ${Math.abs(v).toFixed(0)}% nos últimos 7 dias (${last} contra ${prev}).`,
    });
  } else if (v >= limits.variacao_incomum_pct) {
    await raiseAlert(admin, {
      instagram_account_id: acc.id,
      tipo: "variacao_incomum",
      chave: semana,
      severidade: "baixa",
      mensagem: `Alcance de @${acc.username} subiu ${v.toFixed(0)}% nos últimos 7 dias (${last} contra ${prev}). Vale entender o que funcionou.`,
    });
  }
}

/** Human actions on comments (always explicit, from the panel). */
export async function replyToComment(admin: Admin, commentId: string, message: string, by: string) {
  const { data: c } = await admin
    .from("comments")
    .select("ig_comment_id, instagram_account_id, respondido")
    .eq("id", commentId)
    .maybeSingle();
  if (!c) throw new Error("Comentário não encontrado.");
  const ctx = await accountContext(admin, c.instagram_account_id);
  if (!ctx) throw new Error("Conta sem conexão ativa.");
  const r = await graphPost<{ id: string }>(`${ctx.graph}/${c.ig_comment_id}/replies`, {
    message,
    access_token: ctx.token,
  });
  await admin
    .from("comments")
    .update({
      respondido: true,
      resposta_enviada: message,
      respondido_em: new Date().toISOString(),
      respondido_por: by,
      precisa_humano: false,
    })
    .eq("id", commentId);
  await resolveAlerts(admin, c.instagram_account_id, "comentario_sensivel", c.ig_comment_id);
  return r.id;
}

export async function setCommentHidden(admin: Admin, commentId: string, hide: boolean) {
  const { data: c } = await admin
    .from("comments")
    .select("ig_comment_id, instagram_account_id")
    .eq("id", commentId)
    .maybeSingle();
  if (!c) throw new Error("Comentário não encontrado.");
  const ctx = await accountContext(admin, c.instagram_account_id);
  if (!ctx) throw new Error("Conta sem conexão ativa.");
  await graphPost(`${ctx.graph}/${c.ig_comment_id}`, {
    hide: String(hide),
    access_token: ctx.token,
  });
  await admin.from("comments").update({ oculto: hide }).eq("id", commentId);
}
