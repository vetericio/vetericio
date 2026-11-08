import { useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Loader2, SquarePen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-header";
import { AccountFilter } from "@/components/filters";
import { POST_STATUS } from "@/components/post-list";
import { supabase } from "@/integrations/supabase/client";
import { analyze } from "@/lib/analysis";
import { diaBrasilia, formatoDe, fmtNum, fmtRate, taxaInteracao } from "@/lib/metrics";
import { useMetricsData } from "@/lib/metrics-data";
import { useAccounts, useBrands } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/calendario")({
  head: () => ({ meta: [{ title: "Calendário — Gestor Instagram" }] }),
  component: CalendarPage,
});

type Item = {
  id: string;
  quando: string;
  dia: string;
  conta: string;
  formato: string;
  titulo: string;
  legenda: string;
  status: string;
  campanha: string | null;
  link: { to: "/posts/$postId"; postId: string } | { href: string } | null;
  metrica: string | null;
};

const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const addDays = (dia: string, n: number) =>
  new Date(new Date(`${dia}T12:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10);
const dow = (dia: string) => new Date(`${dia}T12:00:00Z`).getUTCDay();
const horaBR = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });

function CalendarPage() {
  const [conta, setConta] = useState("todas");
  const [modo, setModo] = useState<"mes" | "semana" | "dia">("mes");
  const [ref, setRef] = useState(diaBrasilia(new Date()));
  const accounts = useAccounts();
  const brands = useBrands();
  const metrics = useMetricsData(conta, 90);

  const range = useMemo(() => {
    if (modo === "dia") return { ini: ref, fim: ref };
    if (modo === "semana") {
      const ini = addDays(ref, -dow(ref));
      return { ini, fim: addDays(ini, 6) };
    }
    const first = `${ref.slice(0, 7)}-01`;
    const ini = addDays(first, -dow(first));
    const last = addDays(
      `${new Date(Date.UTC(Number(ref.slice(0, 4)), Number(ref.slice(5, 7)), 1)).toISOString().slice(0, 10)}`,
      -1,
    );
    return { ini, fim: addDays(last, 6 - dow(last)) };
  }, [modo, ref]);

  const posts = useQuery({
    queryKey: ["calendar-posts", conta, range.ini, range.fim],
    queryFn: async () => {
      let q = supabase
        .from("posts")
        .select(
          "id, instagram_account_id, tipo, titulo, legenda, status, agendado_para, campanha, ig_media_id",
        )
        .gte("agendado_para", `${range.ini}T03:00:00Z`)
        .lt("agendado_para", `${addDays(range.fim, 1)}T03:00:00Z`)
        .neq("status", "rascunho");
      if (conta !== "todas") q = q.eq("instagram_account_id", conta);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const accName = (id: string) =>
    `@${(accounts.data ?? []).find((a) => a.id === id)?.username ?? "conta"}`;
  const TIPO: Record<string, string> = {
    imagem: "Imagem",
    carrossel: "Carrossel",
    reels: "Reels",
    story: "Story",
  };

  const items: Item[] = useMemo(() => {
    const ours = (posts.data ?? []).map((p) => ({
      id: p.id,
      quando: p.agendado_para!,
      dia: diaBrasilia(new Date(p.agendado_para!)),
      conta: accName(p.instagram_account_id),
      formato: TIPO[p.tipo] ?? p.tipo,
      titulo: p.titulo || (p.legenda ?? "").split("\n")[0] || "Sem título",
      legenda: p.legenda ?? "",
      status: p.status,
      campanha: p.campanha,
      link: { to: "/posts/$postId" as const, postId: p.id },
      metrica: null as string | null,
      ig: p.ig_media_id,
    }));
    const ourMedia = new Set(ours.map((o) => o.ig).filter(Boolean));
    const external = (metrics.data?.media ?? [])
      .filter((m) => m.publicado_em && !ourMedia.has(m.ig_media_id))
      .map((m) => ({ m, dia: diaBrasilia(new Date(m.publicado_em!)) }))
      .filter(({ dia }) => dia >= range.ini && dia <= range.fim)
      .map(({ m, dia }) => ({
        id: m.ig_media_id,
        quando: m.publicado_em!,
        dia,
        conta: accName(m.instagram_account_id),
        formato: formatoDe(m.media_product_type, m.media_type),
        titulo: (m.caption ?? "").split("\n")[0] || "Sem legenda",
        legenda: m.caption ?? "",
        status: "publicado",
        campanha: null,
        link: m.permalink ? { href: m.permalink } : null,
        metrica: `alcance ${fmtNum(m.insights["reach"])} · taxa ${fmtRate(taxaInteracao(m.insights["total_interactions"], m.insights["reach"]))}`,
        ig: m.ig_media_id,
      }));
    const mediaById = new Map((metrics.data?.media ?? []).map((m) => [m.ig_media_id, m]));
    return [...ours, ...external]
      .map((i) => {
        const m = i.ig ? mediaById.get(i.ig) : undefined;
        return m && !i.metrica
          ? {
              ...i,
              metrica: `alcance ${fmtNum(m.insights["reach"])} · taxa ${fmtRate(taxaInteracao(m.insights["total_interactions"], m.insights["reach"]))}`,
            }
          : i;
      })
      .sort((a, b) => a.quando.localeCompare(b.quando));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts.data, metrics.data, range, accounts.data]);

  const conflitos = useMemo(() => {
    const ids = new Set<string>();
    for (let i = 0; i < items.length; i++)
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i]!;
        const b = items[j]!;
        if (
          a.conta === b.conta &&
          a.formato !== "Story" &&
          b.formato !== "Story" &&
          Math.abs(new Date(a.quando).getTime() - new Date(b.quando).getTime()) < 30 * 60_000
        ) {
          ids.add(a.id);
          ids.add(b.id);
        }
      }
    return ids;
  }, [items]);

  const freq =
    conta === "todas"
      ? null
      : ((brands.data ?? []).find((b) => b.instagram_account_id === conta)?.frequencia_semanal ??
        null);
  const sugestao = useMemo(
    () =>
      metrics.data && conta !== "todas"
        ? analyze({ media: metrics.data.media, daily: [] }).melhoresHorarios
        : [],
    [metrics.data, conta],
  );

  const dias: string[] = [];
  for (let d = range.ini; d <= range.fim; d = addDays(d, 1)) dias.push(d);
  const porDia = (d: string) => items.filter((i) => i.dia === d);
  const hoje = diaBrasilia(new Date());
  const step = (n: number) => {
    if (modo === "dia") setRef(addDays(ref, n));
    else if (modo === "semana") setRef(addDays(ref, 7 * n));
    else {
      const d = new Date(`${ref.slice(0, 7)}-15T12:00:00Z`);
      d.setUTCMonth(d.getUTCMonth() + n);
      setRef(d.toISOString().slice(0, 10));
    }
  };
  const tituloPeriodo =
    modo === "mes"
      ? new Date(`${ref.slice(0, 7)}-15T12:00:00Z`).toLocaleDateString("pt-BR", {
          month: "long",
          year: "numeric",
        })
      : modo === "semana"
        ? `${range.ini.split("-").reverse().join("/")} a ${range.fim.split("-").reverse().join("/")}`
        : new Date(`${ref}T12:00:00Z`).toLocaleDateString("pt-BR", {
            weekday: "long",
            day: "2-digit",
            month: "long",
          });

  const semanas: string[][] = [];
  for (let i = 0; i < dias.length; i += 7) semanas.push(dias.slice(i, i + 7));
  const feedNaSemana = (sem: string[]) =>
    items.filter((i) => sem.includes(i.dia) && i.formato !== "Story" && i.status !== "falhou")
      .length;

  return (
    <>
      <PageHeader
        title="Calendário editorial"
        description="Agendadas, aguardando aprovação e publicadas (inclusive as feitas fora do sistema). Conflitos: duas publicações de feed da mesma conta a menos de 30 minutos."
        actions={
          <Button asChild>
            <Link to="/criar">
              <SquarePen className="size-4" />
              Nova publicação
            </Link>
          </Button>
        }
      />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <AccountFilter value={conta} onChange={setConta} />
        <Tabs value={modo} onValueChange={(v) => setModo(v as typeof modo)}>
          <TabsList>
            <TabsTrigger value="mes">Mês</TabsTrigger>
            <TabsTrigger value="semana">Semana</TabsTrigger>
            <TabsTrigger value="dia">Dia</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-1 sm:ml-auto">
          <Button variant="outline" size="icon" onClick={() => step(-1)} aria-label="Anterior">
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setRef(hoje)}>
            Hoje
          </Button>
          <Button variant="outline" size="icon" onClick={() => step(1)} aria-label="Próximo">
            <ChevronRight className="size-4" />
          </Button>
          <span className="ml-2 text-sm font-medium capitalize">{tituloPeriodo}</span>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
        {freq ? (
          <span>Frequência planejada: {freq} publicação(ões) de feed por semana.</span>
        ) : (
          <span>Escolha uma conta para comparar com a frequência planejada da marca.</span>
        )}
        {sugestao.length ? (
          <span>Horário com melhor alcance histórico (estimativa): {sugestao.join(", ")}.</span>
        ) : (
          <span>
            {conta === "todas"
              ? "Escolha uma conta para ver o horário sugerido (cada marca tem o seu público)."
              : "Ainda não há dados suficientes para sugerir horários."}
          </span>
        )}
        {conflitos.size ? (
          <span className="text-destructive">
            {conflitos.size} publicação(ões) em conflito de horário.
          </span>
        ) : null}
      </div>

      {posts.isLoading ? (
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      ) : modo === "mes" ? (
        <div className="overflow-x-auto">
          <div className="grid min-w-[720px] grid-cols-[repeat(7,1fr)_88px] gap-px rounded-md border bg-border text-xs">
            {[...DIAS, "semana"].map((d) => (
              <div key={d} className="bg-muted px-2 py-1 font-medium capitalize">
                {d}
              </div>
            ))}
            {semanas.map((sem) => (
              <SemanaLinha
                key={sem[0]}
                sem={sem}
                hoje={hoje}
                ref_={ref}
                porDia={porDia}
                conflitos={conflitos}
                freq={freq}
                feed={feedNaSemana(sem)}
                onDia={(d) => {
                  setRef(d);
                  setModo("dia");
                }}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {dias.map((d) => (
            <Card key={d} className={d === hoje ? "border-primary/50" : undefined}>
              <CardHeader className="py-3">
                <CardTitle className="text-sm capitalize">
                  {new Date(`${d}T12:00:00Z`).toLocaleDateString("pt-BR", {
                    weekday: "long",
                    day: "2-digit",
                    month: "2-digit",
                  })}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pb-4">
                {porDia(d).map((i) => (
                  <ItemLinha key={i.id} i={i} conflito={conflitos.has(i.id)} detalhado />
                ))}
                {!porDia(d).length ? (
                  <p className="text-xs text-muted-foreground">Nada neste dia.</p>
                ) : null}
              </CardContent>
            </Card>
          ))}
          {modo === "semana" && freq ? (
            <p
              className={cn(
                "text-sm",
                feedNaSemana(dias) < freq
                  ? "text-amber-600"
                  : feedNaSemana(dias) > freq * 1.5
                    ? "text-amber-600"
                    : "text-muted-foreground",
              )}
            >
              {feedNaSemana(dias)} publicação(ões) de feed nesta semana; planejado: {freq}.
              {feedNaSemana(dias) < freq
                ? " Faltam conteúdos."
                : feedNaSemana(dias) > freq * 1.5
                  ? " Semana carregada acima do planejado."
                  : ""}
            </p>
          ) : null}
        </div>
      )}
    </>
  );
}

function SemanaLinha({
  sem,
  hoje,
  ref_,
  porDia,
  conflitos,
  freq,
  feed,
  onDia,
}: {
  sem: string[];
  hoje: string;
  ref_: string;
  porDia: (d: string) => Item[];
  conflitos: Set<string>;
  freq: number | null;
  feed: number;
  onDia: (d: string) => void;
}) {
  return (
    <>
      {sem.map((d) => (
        <div
          key={d}
          className={cn(
            "min-h-24 bg-background p-1",
            d.slice(0, 7) !== ref_.slice(0, 7) && "opacity-50",
          )}
        >
          <button
            type="button"
            onClick={() => onDia(d)}
            className={cn(
              "mb-1 rounded px-1 font-medium hover:bg-muted",
              d === hoje && "bg-primary text-primary-foreground",
            )}
          >
            {Number(d.slice(8, 10))}
          </button>
          <div className="space-y-1">
            {porDia(d)
              .slice(0, 4)
              .map((i) => (
                <ItemLinha key={i.id} i={i} conflito={conflitos.has(i.id)} />
              ))}
            {porDia(d).length > 4 ? (
              <p className="px-1 text-muted-foreground">+{porDia(d).length - 4}</p>
            ) : null}
          </div>
        </div>
      ))}
      <div
        className={cn(
          "bg-background p-2",
          freq != null &&
            (feed < freq
              ? "text-amber-600"
              : feed > freq * 1.5
                ? "text-amber-600"
                : "text-emerald-600"),
        )}
      >
        {feed}
        {freq != null ? `/${freq}` : ""} feed
        {freq != null && feed < freq ? <p className="text-[10px]">abaixo do plano</p> : null}
        {freq != null && feed > freq * 1.5 ? <p className="text-[10px]">acima do plano</p> : null}
      </div>
    </>
  );
}

function ItemLinha({
  i,
  conflito,
  detalhado,
}: {
  i: Item;
  conflito: boolean;
  detalhado?: boolean;
}) {
  const tone = POST_STATUS[i.status]?.tone ?? "";
  const body = (
    <div
      className={cn("rounded border px-1 py-0.5", tone, conflito && "ring-2 ring-destructive")}
      title={`${i.conta} · ${i.formato} · ${POST_STATUS[i.status]?.label ?? i.status}${i.campanha ? ` · ${i.campanha}` : ""}\n${i.legenda}`}
    >
      <p className="truncate">
        {horaBR(i.quando)} {i.formato} · {i.titulo}
      </p>
      {detalhado ? (
        <p className="truncate text-[11px] opacity-80">
          {i.conta} · {POST_STATUS[i.status]?.label ?? i.status}
          {i.campanha ? ` · ${i.campanha}` : ""}
          {i.metrica ? ` · ${i.metrica}` : ""}
          {conflito ? " · conflito de horário" : ""}
        </p>
      ) : null}
    </div>
  );
  if (i.link && "to" in i.link)
    return (
      <Link to={i.link.to} params={{ postId: i.link.postId }}>
        {body}
      </Link>
    );
  if (i.link && "href" in i.link)
    return (
      <a href={i.link.href} target="_blank" rel="noreferrer">
        {body}
      </a>
    );
  return body;
}
