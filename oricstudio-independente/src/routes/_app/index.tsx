import { useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Circle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { AccountFilter, PeriodFilter } from "@/components/filters";
import { TimeChart } from "@/components/time-chart";
import { PostStatusBadge } from "@/components/post-list";
import { supabase } from "@/integrations/supabase/client";
import { getConfigStatus } from "@/lib/app.functions";
import { fmtNum, fmtPct, variacao } from "@/lib/metrics";
import { dailyByMetric, rangeDias, useMetricsData } from "@/lib/metrics-data";
import { formatDateTime, useAccounts, useBrands, useConnections, useSettings } from "@/lib/queries";
import { shiftDay } from "@/lib/report";

export const Route = createFileRoute("/_app/")({
  head: () => ({ meta: [{ title: "Visão geral — OricStudio" }] }),
  component: Overview,
});

const MODO_LABEL: Record<string, string> = {
  assistido: "Assistido",
  automatico_regras: "Automático com regras",
  gestao_ampliada: "Gestão ampliada",
};

function Overview() {
  const [conta, setConta] = useState("todas");
  const [dias, setDias] = useState(7);
  const connections = useConnections();
  const accounts = useAccounts();
  const brands = useBrands();
  const settings = useSettings();
  const metrics = useMetricsData(conta, dias);
  const config = useQuery({
    queryKey: ["config-status"],
    queryFn: () => getConfigStatus(),
    retry: false,
  });
  const ops = useQuery({
    queryKey: ["dashboard-ops", conta],
    refetchInterval: 60_000,
    queryFn: async () => {
      const f = <T,>(q: T) => q;
      let posts = supabase
        .from("posts")
        .select("id, titulo, legenda, status, agendado_para, instagram_account_id, tipo")
        .in("status", [
          "agendado",
          "processando",
          "aguardando_aprovacao",
          "falhou",
          "resultado_desconhecido",
        ])
        .order("agendado_para");
      let alerts = supabase
        .from("alerts")
        .select("id, mensagem, severidade, created_at, tipo")
        .eq("resolvido", false)
        .order("created_at", { ascending: false })
        .limit(5);
      if (conta !== "todas") {
        posts = posts.eq("instagram_account_id", conta);
        alerts = alerts.eq("instagram_account_id", conta);
      }
      const [p, a] = await Promise.all([f(posts), f(alerts)]);
      return { posts: p.data ?? [], alerts: a.data ?? [] };
    },
  });

  const accs = (accounts.data ?? []).filter((a) => a.gerenciada);
  const conns = (connections.data ?? []).filter((c) => c.status !== "desconectada");
  const problem = [
    ...conns.filter((c) => c.status !== "ativa"),
    ...accs.filter((a) => a.status !== "ativa"),
  ];
  const filaParada = settings.data?.ultimo_ciclo_fila
    ? Date.now() - new Date(settings.data.ultimo_ciclo_fila).getTime() > 5 * 60_000
    : true;

  const { inicio, fim } = rangeDias(dias);
  const view = useMemo(() => {
    if (!metrics.data) return null;
    const daily = dailyByMetric(metrics.data.daily);
    const sum = (m: string, a: string, b: string) => {
      const v = daily.filter((d) => d.metrica === m && d.dia >= a && d.dia <= b);
      return v.length ? v.reduce((s, d) => s + (d.valor ?? 0), 0) : null;
    };
    const pIni = shiftDay(inicio, -dias);
    const pFim = shiftDay(inicio, -1);
    const k = (m: string) => ({ atual: sum(m, inicio, fim), anterior: sum(m, pIni, pFim) });
    const pubs = metrics.data.media.filter(
      (m) =>
        m.publicado_em && m.media_product_type !== "STORY" && m.publicado_em.slice(0, 10) >= inicio,
    );
    const pubsAnt = metrics.data.media.filter(
      (m) =>
        m.publicado_em &&
        m.media_product_type !== "STORY" &&
        m.publicado_em.slice(0, 10) >= pIni &&
        m.publicado_em.slice(0, 10) < inicio,
    );
    const seg = daily
      .filter((d) => d.metrica === "followers_count")
      .sort((a, b) => a.dia.localeCompare(b.dia));
    const diasLista = [
      ...new Set(daily.filter((d) => d.dia >= inicio && d.dia <= fim).map((d) => d.dia)),
    ].sort();
    const serie = diasLista.map((dia) => ({
      dia,
      reach: daily.find((d) => d.dia === dia && d.metrica === "reach")?.valor ?? null,
      total_interactions:
        daily.find((d) => d.dia === dia && d.metrica === "total_interactions")?.valor ?? null,
    }));
    return {
      reach: k("reach"),
      views: k("views"),
      inter: k("total_interactions"),
      pubs: pubs.length,
      pubsAnt: pubsAnt.length,
      segIni: seg.find((d) => d.dia >= inicio),
      segFim: seg.at(-1),
      serie,
    };
  }, [metrics.data, inicio, fim, dias]);

  const posts = ops.data?.posts ?? [];
  const agendados = posts.filter((p) => p.status === "agendado" || p.status === "processando");
  const falhas = posts.filter(
    (p) => p.status === "falhou" || p.status === "resultado_desconhecido",
  );
  const aprovacao = posts.filter((p) => p.status === "aguardando_aprovacao");
  const brandIds = new Set((brands.data ?? []).map((b) => b.instagram_account_id));
  const steps = [
    {
      done: config.isSuccess && config.data.missing.length === 0,
      label: "Configurar os secrets do app Meta",
      to: "/configuracoes",
    },
    { done: conns.length > 0, label: "Conectar uma conta Meta", to: "/contas" },
    { done: accs.length > 0, label: "Escolher as contas gerenciadas", to: "/contas" },
    {
      done: accs.length > 0 && accs.every((a) => brandIds.has(a.id)),
      label: "Preencher o perfil de cada marca",
      to: "/contas",
    },
  ];
  const accName = (id: string) =>
    `@${(accounts.data ?? []).find((a) => a.id === id)?.username ?? "conta"}`;

  return (
    <>
      <PageHeader
        title="Visão geral"
        description={`Dados reais. Período: últimos ${dias} dias, comparado com os ${dias} anteriores. Automação: ${settings.data?.pausa_geral ? "PAUSADA" : (MODO_LABEL[settings.data?.modo_autonomia ?? ""] ?? "—")}.`}
      />
      <div className="mb-6 flex flex-col gap-2 sm:flex-row">
        <AccountFilter value={conta} onChange={setConta} />
        <PeriodFilter value={dias} onChange={setDias} />
      </div>

      {filaParada ? (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="size-4" />O agendador não roda há mais de 5 minutos (último
          ciclo: {formatDateTime(settings.data?.ultimo_ciclo_fila)}). Publicações agendadas podem
          atrasar.
        </div>
      ) : null}

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Publicações no feed"
          value={view ? String(view.pubs) : "…"}
          hint={view ? `${fmtPct(variacao(view.pubs, view.pubsAnt))} vs. anterior` : ""}
        />
        <Stat
          label="Alcance diário somado"
          value={fmtNum(view?.reach.atual)}
          hint={`${fmtPct(variacao(view?.reach.atual, view?.reach.anterior))} vs. anterior`}
        />
        <Stat
          label="Visualizações"
          value={fmtNum(view?.views.atual)}
          hint={`${fmtPct(variacao(view?.views.atual, view?.views.anterior))} vs. anterior`}
        />
        <Stat
          label="Interações"
          value={fmtNum(view?.inter.atual)}
          hint={`${fmtPct(variacao(view?.inter.atual, view?.inter.anterior))} vs. anterior`}
        />
        <Stat
          label="Seguidores"
          value={fmtNum(view?.segFim?.valor)}
          hint={
            view?.segIni && view.segFim && view.segIni.dia !== view.segFim.dia
              ? `${fmtPct(variacao(view.segFim.valor, view.segIni.valor))} no período`
              : "histórico em formação"
          }
        />
        <Stat
          label="Agendadas"
          value={String(agendados.length)}
          hint="Na fila do servidor"
          to="/agendadas"
        />
        <Stat
          label="Falhas / a verificar"
          value={String(falhas.length)}
          hint="Veja o histórico"
          to="/historico"
          alert={falhas.length > 0}
        />
        <Stat
          label="Aguardando aprovação"
          value={String(aprovacao.length)}
          hint="Rascunhos e pendências"
          to="/rascunhos"
          alert={aprovacao.length > 0}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Alcance e interações por dia</CardTitle>
            <CardDescription>
              <Link to="/metricas" className="underline">
                Ver métricas completas
              </Link>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {metrics.isLoading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <TimeChart
                data={view?.serie ?? []}
                series={[
                  { key: "reach", label: "Alcance" },
                  { key: "total_interactions", label: "Interações" },
                ]}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Alertas abertos</CardTitle>
            <CardDescription>
              <Link to="/alertas" className="underline">
                Ver todos
              </Link>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {(ops.data?.alerts ?? []).map((a) => (
              <div key={a.id} className="flex gap-2">
                <AlertTriangle
                  className={`mt-0.5 size-4 shrink-0 ${a.severidade === "alta" ? "text-destructive" : "text-amber-600"}`}
                />
                <span>{a.mensagem}</span>
              </div>
            ))}
            {!ops.data?.alerts.length ? (
              <p className="text-muted-foreground">Nenhum alerta aberto.</p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Integrações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {accs.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-2">
                <span>@{a.username}</span>
                <StatusBadge status={a.status} />
              </div>
            ))}
            {conns.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-2 text-muted-foreground"
              >
                <span>Conexão {c.meta_user_name}</span>
                <StatusBadge status={c.status} />
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              Fila: último ciclo {formatDateTime(settings.data?.ultimo_ciclo_fila)} · coleta:{" "}
              {formatDateTime(settings.data?.ultimo_ciclo_coleta)}
            </p>
            {problem.length ? (
              <Link to="/contas" className="text-xs text-destructive underline">
                {problem.length} integração(ões) com problema
              </Link>
            ) : null}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Próximas publicações</CardTitle>
            <CardDescription>
              <Link to="/calendario" className="underline">
                Abrir calendário
              </Link>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {[...aprovacao, ...agendados].slice(0, 6).map((p) => (
              <Link
                key={p.id}
                to="/posts/$postId"
                params={{ postId: p.id }}
                className="flex flex-wrap items-center gap-2 rounded p-1 hover:bg-muted"
              >
                <span className="w-32 shrink-0 text-muted-foreground">
                  {formatDateTime(p.agendado_para)}
                </span>
                <PostStatusBadge status={p.status} />
                <span className="text-muted-foreground">{accName(p.instagram_account_id)}</span>
                <span className="min-w-0 truncate">
                  {p.titulo || (p.legenda ?? "").split("\n")[0]}
                </span>
              </Link>
            ))}
            {![...aprovacao, ...agendados].length ? (
              <p className="text-muted-foreground">Nada agendado.</p>
            ) : null}
          </CardContent>
        </Card>

        {steps.some((s) => !s.done) ? (
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="text-base">Configuração pendente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {steps.map((s) => (
                <Link
                  key={s.label}
                  to={s.to}
                  className="flex items-center gap-2 rounded-md p-1 text-sm hover:bg-muted"
                >
                  {s.done ? (
                    <CheckCircle2 className="size-4 text-emerald-600" />
                  ) : (
                    <Circle className="size-4 text-muted-foreground" />
                  )}
                  <span className={s.done ? "text-muted-foreground line-through" : ""}>
                    {s.label}
                  </span>
                </Link>
              ))}
            </CardContent>
          </Card>
        ) : null}
      </div>
      {settings.data?.pausa_geral ? (
        <Badge variant="destructive" className="mt-4">
          Pausa geral ativa
        </Badge>
      ) : null}
    </>
  );
}

function Stat({
  label,
  value,
  hint,
  alert,
  to,
}: {
  label: string;
  value: string;
  hint: string;
  alert?: boolean;
  to?: string;
}) {
  const body = (
    <Card className={alert ? "border-destructive/40" : undefined}>
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p
          className={`mt-1 text-2xl font-semibold tabular-nums ${alert ? "text-destructive" : ""}`}
        >
          {value}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}
