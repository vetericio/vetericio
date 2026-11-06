import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/components/page-header";
import { AccountFilter, PeriodFilter } from "@/components/filters";
import { TimeChart } from "@/components/time-chart";
import { Recommendations } from "@/components/recommendations";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { analyze } from "@/lib/analysis";
import {
  ACCOUNT_METRICS,
  CALCULATED,
  MEDIA_METRICS,
  fmtNum,
  fmtPct,
  fmtRate,
  formatoDe,
  taxaInteracao,
  variacao,
} from "@/lib/metrics";
import { dailyByMetric, rangeDias, useMetricsData, type MediaRow } from "@/lib/metrics-data";
import { collectNow } from "@/lib/ops.functions";
import { errorMessage, formatDateTime, useAccounts, useBrands } from "@/lib/queries";
import { shiftDay } from "@/lib/report";

export const Route = createFileRoute("/_app/metricas")({
  head: () => ({ meta: [{ title: "Métricas — Gestor Instagram" }] }),
  component: MetricsPage,
});

function MetricsPage() {
  const [conta, setConta] = useState("todas");
  const [dias, setDias] = useState(30);
  const [aberta, setAberta] = useState<MediaRow | null>(null);
  const data = useMetricsData(conta, dias);
  const brands = useBrands();
  const accounts = useAccounts();
  const qc = useQueryClient();
  const coletar = useMutation({
    mutationFn: () => collectNow({ data: conta === "todas" ? {} : { accountId: conta } }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["metrics"] });
      const erros = r.resultados.filter((x) => x["erro"]);
      if (erros.length)
        toast.warning(
          `Coleta concluída com ${erros.length} erro(s): ${erros.map((e) => e["erro"]).join("; ")}`,
        );
      else toast.success("Dados atualizados com a Meta.");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const { inicio, fim } = rangeDias(dias);
  const pIni = shiftDay(inicio, -dias);
  const pFim = shiftDay(inicio, -1);

  const view = useMemo(() => {
    if (!data.data) return null;
    const daily = dailyByMetric(data.data.daily);
    const sum = (m: string, a: string, b: string) => {
      const v = daily.filter((d) => d.metrica === m && d.dia >= a && d.dia <= b);
      return v.length ? v.reduce((s, d) => s + (d.valor ?? 0), 0) : null;
    };
    const kpi = (m: string) => ({ atual: sum(m, inicio, fim), anterior: sum(m, pIni, pFim) });
    const seg = daily
      .filter((d) => d.metrica === "followers_count")
      .sort((a, b) => a.dia.localeCompare(b.dia));
    const segIni = seg.find((d) => d.dia >= inicio) ?? null;
    const segFim = seg.at(-1) ?? null;
    const dias = [
      ...new Set(daily.filter((d) => d.dia >= inicio && d.dia <= fim).map((d) => d.dia)),
    ].sort();
    const serie = (ms: string[]) =>
      dias.map((dia) =>
        Object.fromEntries([
          ["dia", dia],
          ...ms.map((m) => [m, daily.find((d) => d.dia === dia && d.metrica === m)?.valor ?? null]),
        ]),
      );
    const pubs = data.data.media.filter(
      (m) =>
        m.publicado_em && m.publicado_em.slice(0, 10) >= inicio && m.media_product_type !== "STORY",
    );
    const stories = data.data.media.filter(
      (m) =>
        m.media_product_type === "STORY" && m.publicado_em && m.publicado_em.slice(0, 10) >= inicio,
    );
    const formatos = new Map<string, MediaRow[]>();
    for (const p of pubs)
      formatos.set(formatoDe(p.media_product_type, p.media_type), [
        ...(formatos.get(formatoDe(p.media_product_type, p.media_type)) ?? []),
        p,
      ]);
    const freq =
      conta === "todas"
        ? null
        : ((brands.data ?? []).find((b) => b.instagram_account_id === conta)?.frequencia_semanal ??
          null);
    // Never mix brands: each account is analysed against its own history.
    const contasAnalise =
      conta === "todas"
        ? [...new Set(data.data.media.map((m) => m.instagram_account_id))]
        : [conta];
    const analises = contasAnalise.map((id) => ({
      id,
      username: (accounts.data ?? []).find((a) => a.id === id)?.username ?? "conta",
      ...analyze({
        media: data.data.media.filter((m) => m.instagram_account_id === id),
        daily: dailyByMetric(data.data.daily.filter((d) => d.account === id)),
        frequenciaSemanal:
          conta === "todas"
            ? ((brands.data ?? []).find((b) => b.instagram_account_id === id)?.frequencia_semanal ??
              null)
            : freq,
      }),
    }));
    return { kpi, segIni, segFim, serie, pubs, stories, formatos, analises };
  }, [data.data, inicio, fim, pIni, pFim, conta, brands.data, accounts.data]);

  return (
    <>
      <PageHeader
        title="Métricas e desempenho"
        description={`Dados reais da Meta. Período: ${inicio.split("-").reverse().join("/")} a ${fim.split("-").reverse().join("/")}, comparado com os ${dias} dias anteriores. Última coleta: ${formatDateTime(data.data?.coletadoEm)}.`}
        actions={
          <Button variant="outline" onClick={() => coletar.mutate()} disabled={coletar.isPending}>
            {coletar.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Coletar agora
          </Button>
        }
      />
      <div className="mb-6 flex flex-col gap-2 sm:flex-row">
        <AccountFilter value={conta} onChange={setConta} />
        <PeriodFilter value={dias} onChange={setDias} />
      </div>

      {data.isLoading || !view ? (
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi
              titulo="Alcance diário somado"
              {...view.kpi("reach")}
              nota={ACCOUNT_METRICS["reach"]!.limitacoes}
            />
            <Kpi titulo="Visualizações" {...view.kpi("views")} />
            <Kpi titulo="Interações" {...view.kpi("total_interactions")} />
            <Kpi titulo="Contas engajadas (soma diária)" {...view.kpi("accounts_engaged")} />
            <Kpi titulo="Toques em links do perfil" {...view.kpi("profile_links_taps")} />
            <Kpi titulo="Compartilhamentos" {...view.kpi("shares")} />
            <Kpi titulo="Salvamentos" {...view.kpi("saves")} />
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Seguidores</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {fmtNum(view.segFim?.valor)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {view.segIni && view.segFim && view.segIni.dia !== view.segFim.dia
                    ? `${fmtPct(variacao(view.segFim.valor, view.segIni.valor))} desde ${view.segIni.dia.split("-").reverse().join("/")} (${fmtNum(view.segIni.valor)})`
                    : "Histórico começa no primeiro dia de coleta"}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Alcance e visualizações por dia</CardTitle>
              </CardHeader>
              <CardContent>
                <TimeChart
                  data={view.serie(["reach", "views"])}
                  series={[
                    { key: "reach", label: "Alcance" },
                    { key: "views", label: "Visualizações" },
                  ]}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Interações e seguidores</CardTitle>
              </CardHeader>
              <CardContent>
                <TimeChart
                  data={view.serie(["total_interactions", "followers_count"])}
                  series={[
                    { key: "total_interactions", label: "Interações" },
                    { key: "followers_count", label: "Seguidores" },
                  ]}
                />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Análise e recomendações</CardTitle>
              <CardDescription>
                Baseadas no histórico de cada conta. Hipóteses, não certezas; a confiança depende do
                tamanho da amostra.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {view.analises.map((a) => (
                  <div key={a.id}>
                    {view.analises.length > 1 ? (
                      <p className="mb-2 text-sm font-semibold">@{a.username}</p>
                    ) : null}
                    <Recommendations items={a.recomendacoes} avisos={a.avisos} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Desempenho por formato</CardTitle>
              <CardDescription>
                Formatos têm objetivos diferentes; compare com cuidado.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Formato</TableHead>
                    <TableHead className="text-right">Publicações</TableHead>
                    <TableHead className="text-right">Alcance médio</TableHead>
                    <TableHead className="text-right">Interações médias</TableHead>
                    <TableHead className="text-right">Taxa de interação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...view.formatos.entries()].map(([f, ms]) => {
                    const reach = ms
                      .map((m) => m.insights["reach"])
                      .filter((x): x is number => x != null);
                    const inter = ms
                      .map((m) => m.insights["total_interactions"])
                      .filter((x): x is number => x != null);
                    const avg = (xs: number[]) =>
                      xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
                    return (
                      <TableRow key={f}>
                        <TableCell>{f}</TableCell>
                        <TableCell className="text-right">{ms.length}</TableCell>
                        <TableCell className="text-right">{fmtNum(avg(reach))}</TableCell>
                        <TableCell className="text-right">{fmtNum(avg(inter))}</TableCell>
                        <TableCell className="text-right">
                          {fmtRate(
                            taxaInteracao(
                              inter.reduce((a, b) => a + b, 0),
                              reach.reduce((a, b) => a + b, 0) || null,
                            ),
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {!view.formatos.size ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                        Nenhuma publicação no período.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ranking de publicações do período</CardTitle>
              <CardDescription>
                Ordenado pela taxa de interação. Clique para ver a evolução.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <MediaTable rows={[...view.pubs, ...view.stories]} onOpen={setAberta} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Definições</CardTitle>
              <CardDescription>
                Origem: “Meta” são valores retornados pela API; “calculado” são indicadores do
                sistema. Dados da Meta podem atrasar até 48h e, quando não estão disponíveis,
                aparecem como “não disponível” (nunca como zero).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-3 text-sm md:grid-cols-2">
                {Object.entries({ ...ACCOUNT_METRICS, ...CALCULATED }).map(([k, d]) => (
                  <div key={k}>
                    <dt className="font-medium">
                      {d.label}{" "}
                      <span className="text-xs font-normal text-muted-foreground">
                        ({d.origem === "meta" ? `Meta: ${k}` : "calculado"})
                      </span>
                    </dt>
                    <dd className="text-muted-foreground">
                      {d.definicao}
                      {d.limitacoes ? ` Limitação: ${d.limitacoes}` : ""}
                    </dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        </div>
      )}
      <MediaDialog media={aberta} onClose={() => setAberta(null)} />
    </>
  );
}

function Kpi({
  titulo,
  atual,
  anterior,
  nota,
}: {
  titulo: string;
  atual: number | null;
  anterior: number | null;
  nota?: string | undefined;
}) {
  const v = variacao(atual, anterior);
  return (
    <Card>
      <CardContent className="p-4" title={nota}>
        <p className="text-sm text-muted-foreground">{titulo}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{fmtNum(atual)}</p>
        <p
          className={`mt-1 text-xs ${v == null ? "text-muted-foreground" : v >= 0 ? "text-emerald-600" : "text-destructive"}`}
        >
          {fmtPct(v)} vs. período anterior ({fmtNum(anterior)})
        </p>
      </CardContent>
    </Card>
  );
}

export function MediaTable({ rows, onOpen }: { rows: MediaRow[]; onOpen: (m: MediaRow) => void }) {
  const sorted = [...rows].sort(
    (a, b) =>
      (taxaInteracao(b.insights["total_interactions"], b.insights["reach"]) ?? -1) -
      (taxaInteracao(a.insights["total_interactions"], a.insights["reach"]) ?? -1),
  );
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Publicação</TableHead>
          <TableHead>Formato</TableHead>
          <TableHead className="text-right">Alcance</TableHead>
          <TableHead className="text-right">Visualizações</TableHead>
          <TableHead className="text-right">Interações</TableHead>
          <TableHead className="text-right">Taxa</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((m) => (
          <TableRow key={m.ig_media_id} className="cursor-pointer" onClick={() => onOpen(m)}>
            <TableCell className="max-w-72">
              <div className="flex items-center gap-2">
                {m.thumbnail_url ? (
                  <img
                    src={m.thumbnail_url}
                    alt=""
                    className="size-10 shrink-0 rounded object-cover"
                    loading="lazy"
                  />
                ) : null}
                <div className="min-w-0">
                  <p className="truncate text-sm">
                    {(m.caption ?? "").split("\n")[0] || "Sem legenda"}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(m.publicado_em)}</p>
                </div>
              </div>
            </TableCell>
            <TableCell className="text-sm">
              {formatoDe(m.media_product_type, m.media_type)}
            </TableCell>
            <TableCell className="text-right tabular-nums">{fmtNum(m.insights["reach"])}</TableCell>
            <TableCell className="text-right tabular-nums">{fmtNum(m.insights["views"])}</TableCell>
            <TableCell className="text-right tabular-nums">
              {fmtNum(m.insights["total_interactions"])}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {fmtRate(taxaInteracao(m.insights["total_interactions"], m.insights["reach"]))}
            </TableCell>
            <TableCell>
              {m.permalink ? (
                <a
                  href={m.permalink}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Abrir no Instagram"
                >
                  <ExternalLink className="size-4 text-muted-foreground" />
                </a>
              ) : null}
            </TableCell>
          </TableRow>
        ))}
        {!rows.length ? (
          <TableRow>
            <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
              Nenhuma publicação coletada no período. Use “Coletar agora” se a conta acabou de ser
              conectada.
            </TableCell>
          </TableRow>
        ) : null}
      </TableBody>
    </Table>
  );
}

function MediaDialog({ media, onClose }: { media: MediaRow | null; onClose: () => void }) {
  const hist = useQuery({
    queryKey: ["media-hist", media?.ig_media_id],
    enabled: !!media,
    queryFn: async () => {
      const { data } = await supabase
        .from("metric_snapshots")
        .select("metrica, valor, coletado_em")
        .eq("ig_media_id", media!.ig_media_id)
        .order("coletado_em")
        .limit(2000);
      const byTime = new Map<string, Record<string, string | number | null>>();
      for (const r of data ?? []) {
        const k = r.coletado_em.slice(0, 13);
        byTime.set(k, {
          ...(byTime.get(k) ?? {
            dia: r.coletado_em.slice(0, 10) + " " + r.coletado_em.slice(11, 13) + "h",
          }),
          [r.metrica]: r.valor == null ? null : Number(r.valor),
        });
      }
      return [...byTime.values()];
    },
  });
  return (
    <Dialog open={!!media} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-base">
            {(media?.caption ?? "Publicação").split("\n")[0]?.slice(0, 80)}
          </DialogTitle>
        </DialogHeader>
        {media ? (
          <div className="space-y-4 text-sm">
            <p className="text-muted-foreground">
              {formatoDe(media.media_product_type, media.media_type)} · publicado em{" "}
              {formatDateTime(media.publicado_em)} · métricas de {formatDateTime(media.insights_em)}
              {media.insights_erro ? ` · ${media.insights_erro}` : ""}
            </p>
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {Object.entries(MEDIA_METRICS).map(([k, d]) => (
                <div key={k} className="rounded border p-2" title={d.definicao}>
                  <dt className="text-xs text-muted-foreground">{d.label}</dt>
                  <dd className="font-medium tabular-nums">{fmtNum(media.insights[k])}</dd>
                </div>
              ))}
              <div className="rounded border p-2">
                <dt className="text-xs text-muted-foreground">Taxa de interação (calculada)</dt>
                <dd className="font-medium tabular-nums">
                  {fmtRate(
                    taxaInteracao(media.insights["total_interactions"], media.insights["reach"]),
                  )}
                </dd>
              </div>
            </dl>
            <TimeChart
              data={(hist.data ?? []).map((r) => ({ ...r, dia: String(r["dia"]) }))}
              series={[
                { key: "reach", label: "Alcance" },
                { key: "views", label: "Visualizações" },
                { key: "total_interactions", label: "Interações" },
              ]}
            />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
