import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { DailyInput, MediaInput } from "@/lib/analysis";
import { diaBrasilia } from "@/lib/metrics";

export type MediaRow = MediaInput & {
  instagram_account_id: string;
  thumbnail_url: string | null;
  like_count: number | null;
  comments_count: number | null;
  insights_em: string | null;
  insights_erro: string | null;
};

/** Real data for the metrics views: daily account metrics and media (with latest insights). */
export function useMetricsData(accountId: string | "todas", dias: number) {
  return useQuery({
    queryKey: ["metrics", accountId, dias],
    queryFn: async () => {
      const desde = diaBrasilia(new Date(Date.now() - (dias * 2 + 120) * 86_400_000));
      let qd = supabase
        .from("metric_snapshots")
        .select("instagram_account_id, dia, metrica, valor")
        .is("ig_media_id", null)
        .gte("dia", desde);
      let qm = supabase
        .from("ig_media")
        .select(
          "ig_media_id, instagram_account_id, publicado_em, media_type, media_product_type, caption, permalink, thumbnail_url, like_count, comments_count, insights, insights_em, insights_erro",
        )
        .gte("publicado_em", `${desde}T00:00:00Z`)
        .order("publicado_em", { ascending: false });
      if (accountId !== "todas") {
        qd = qd.eq("instagram_account_id", accountId);
        qm = qm.eq("instagram_account_id", accountId);
      }
      const [d, m, s] = await Promise.all([
        qd.limit(5000),
        qm.limit(1000),
        supabase.from("app_settings").select("ultimo_ciclo_coleta").eq("id", true).maybeSingle(),
      ]);
      if (d.error) throw d.error;
      if (m.error) throw m.error;
      const daily = (d.data ?? []).map((r) => ({
        account: r.instagram_account_id,
        dia: r.dia!,
        metrica: r.metrica,
        valor: r.valor == null ? null : Number(r.valor),
      }));
      const media = (m.data ?? []).map((r) => ({
        ...r,
        insights: (r.insights ?? {}) as Record<string, number>,
      })) as MediaRow[];
      return { daily, media, coletadoEm: s.data?.ultimo_ciclo_coleta ?? null };
    },
  });
}

/** Sums the same metric across accounts per day (for the consolidated view). */
export function dailyByMetric(
  daily: { account: string; dia: string; metrica: string; valor: number | null }[],
): DailyInput[] {
  const map = new Map<string, number>();
  for (const d of daily) {
    if (d.valor == null) continue;
    const k = `${d.dia}|${d.metrica}`;
    map.set(k, (map.get(k) ?? 0) + d.valor);
  }
  return [...map.entries()].map(([k, valor]) => {
    const [dia, metrica] = k.split("|");
    return { dia: dia!, metrica: metrica!, valor };
  });
}

export function rangeDias(dias: number) {
  const fim = diaBrasilia(new Date(Date.now() - 86_400_000));
  const inicio = diaBrasilia(new Date(Date.now() - dias * 86_400_000));
  return { inicio, fim };
}
