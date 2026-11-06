import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Recommendations } from "@/components/recommendations";
import { supabase } from "@/integrations/supabase/client";
import { fmtNum, fmtPct, fmtRate } from "@/lib/metrics";
import { reportToCsv, type Relatorio } from "@/lib/report";
import { formatDateTime } from "@/lib/queries";

export const Route = createFileRoute("/_app/relatorios/$reportId")({
  head: () => ({ meta: [{ title: "Relatório — Gestor Instagram" }] }),
  component: ReportPage,
});

const br = (d: string) => d.split("-").reverse().join("/");

function ReportPage() {
  const { reportId } = Route.useParams();
  const report = useQuery({
    queryKey: ["report", reportId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .eq("id", reportId)
        .single();
      if (error) throw error;
      return { ...data, conteudo: data.conteudo as unknown as Relatorio };
    },
  });

  const exportCsv = () => {
    const r = report.data!.conteudo;
    const blob = new Blob([reportToCsv(r)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `relatorio-${r.tipo}-${r.inicio}-a-${r.fim}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (report.isLoading) return <Loader2 className="size-5 animate-spin text-muted-foreground" />;
  if (!report.data)
    return <p className="text-sm text-muted-foreground">Relatório não encontrado.</p>;
  const r = report.data.conteudo;

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link to="/relatorios">
            <ArrowLeft className="size-4" />
            Relatórios
          </Link>
        </Button>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={exportCsv}>
          <Download className="size-4" />
          CSV
        </Button>
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="size-4" />
          PDF / imprimir
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Relatório {r.tipo} · {br(r.inicio)} a {br(r.fim)}
        </h1>
        <p className="text-sm text-muted-foreground">
          Dados atualizados em {formatDateTime(r.atualizado_em)}. Comparação com o período anterior
          de mesma duração.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resumo executivo</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {r.resumo.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {r.contas.map((c) => (
        <Card key={c.id} className="break-inside-avoid">
          <CardHeader>
            <CardTitle className="text-base">@{c.username}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Indicador</TableHead>
                  <TableHead className="text-right">Período</TableHead>
                  <TableHead className="text-right">Anterior</TableHead>
                  <TableHead className="text-right">Variação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <Linha
                  nome="Publicações no feed"
                  a={c.kpis.publicacoes}
                  b={c.anterior.publicacoes}
                  v={c.variacoes["publicacoes"]}
                />
                <Linha
                  nome="Alcance diário somado"
                  a={c.kpis.alcance_diario_somado}
                  b={c.anterior.alcance_diario_somado}
                  v={c.variacoes["alcance"]}
                />
                <Linha
                  nome="Visualizações"
                  a={c.kpis.visualizacoes}
                  b={c.anterior.visualizacoes}
                  v={c.variacoes["visualizacoes"]}
                />
                <Linha
                  nome="Interações"
                  a={c.kpis.interacoes}
                  b={c.anterior.interacoes}
                  v={c.variacoes["interacoes"]}
                />
                <TableRow>
                  <TableCell>Seguidores (fim)</TableCell>
                  <TableCell className="text-right">{fmtNum(c.kpis.seguidores_fim)}</TableCell>
                  <TableCell className="text-right">{fmtNum(c.kpis.seguidores_inicio)}</TableCell>
                  <TableCell className="text-right">
                    {fmtPct(c.kpis.crescimento_seguidores_pct)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Taxa de interação (mediana)</TableCell>
                  <TableCell className="text-right">
                    {fmtRate(c.kpis.taxa_interacao_mediana)}
                  </TableCell>
                  <TableCell className="text-right">
                    {fmtRate(c.anterior.taxa_interacao_mediana)}
                  </TableCell>
                  <TableCell className="text-right">—</TableCell>
                </TableRow>
              </TableBody>
            </Table>

            <div className="grid gap-4 md:grid-cols-2">
              <Lista titulo="Melhores publicações" itens={c.melhores} />
              <Lista titulo="Publicações com desempenho mais baixo" itens={c.piores} />
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Resultados por formato</p>
              {c.por_formato.length ? (
                <ul className="text-sm">
                  {c.por_formato.map((f) => (
                    <li key={f.formato}>
                      {f.formato}: {f.publicacoes} publicação(ões), alcance mediano{" "}
                      {fmtNum(f.alcance_mediano)}, taxa mediana {fmtRate(f.taxa_mediana)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma publicação no período.</p>
              )}
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Problemas de publicação</p>
              {c.problemas.length ? (
                <ul className="list-disc pl-5 text-sm text-destructive">
                  {c.problemas.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma falha no período.</p>
              )}
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Oportunidades e recomendações prioritárias</p>
              <Recommendations items={c.recomendacoes} avisos={c.avisos} />
            </div>
          </CardContent>
        </Card>
      ))}
      <p className="text-xs text-muted-foreground">{r.definicoes}</p>
    </div>
  );
}

function Linha({
  nome,
  a,
  b,
  v,
}: {
  nome: string;
  a: number | null;
  b: number | null;
  v: number | null | undefined;
}) {
  return (
    <TableRow>
      <TableCell>{nome}</TableCell>
      <TableCell className="text-right tabular-nums">{fmtNum(a)}</TableCell>
      <TableCell className="text-right tabular-nums">{fmtNum(b)}</TableCell>
      <TableCell className="text-right tabular-nums">{fmtPct(v ?? null)}</TableCell>
    </TableRow>
  );
}

function Lista({
  titulo,
  itens,
}: {
  titulo: string;
  itens: Relatorio["contas"][number]["melhores"];
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium">{titulo}</p>
      {itens.length ? (
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          {itens.map((i) => (
            <li key={i.titulo + i.permalink}>
              {i.permalink ? (
                <a href={i.permalink} target="_blank" rel="noreferrer" className="underline">
                  {i.titulo}
                </a>
              ) : (
                i.titulo
              )}{" "}
              <span className="text-muted-foreground">
                ({i.formato}, alcance {fmtNum(i.alcance)}, taxa {fmtRate(i.taxa)})
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-muted-foreground">Sem dados suficientes.</p>
      )}
    </div>
  );
}
