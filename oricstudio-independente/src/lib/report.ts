// Report content builder (pure). The server feeds it real rows; the UI renders and exports the result.
import { analyze, type DailyInput, type MediaInput, type Recomendacao } from "./analysis";
import { fmtNum, fmtPct, fmtRate, formatoDe, taxaInteracao, variacao } from "./metrics";

export type Kpis = {
  publicacoes: number;
  alcance_diario_somado: number | null;
  visualizacoes: number | null;
  interacoes: number | null;
  seguidores_inicio: number | null;
  seguidores_fim: number | null;
  crescimento_seguidores_pct: number | null;
  taxa_interacao_mediana: number | null;
};

export type ContaRelatorio = {
  id: string;
  username: string;
  kpis: Kpis;
  anterior: Kpis;
  variacoes: Record<string, number | null>;
  melhores: {
    titulo: string;
    formato: string;
    alcance: number | null;
    taxa: number | null;
    permalink: string | null;
  }[];
  piores: {
    titulo: string;
    formato: string;
    alcance: number | null;
    taxa: number | null;
    permalink: string | null;
  }[];
  por_formato: {
    formato: string;
    publicacoes: number;
    alcance_mediano: number | null;
    taxa_mediana: number | null;
  }[];
  problemas: string[];
  recomendacoes: Recomendacao[];
  avisos: string[];
};

export type Relatorio = {
  tipo: string;
  inicio: string;
  fim: string;
  atualizado_em: string;
  resumo: string[];
  contas: ContaRelatorio[];
  definicoes: string;
};

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

const inRange = (dia: string, ini: string, fim: string) => dia >= ini && dia <= fim;
const diaBR = (iso: string) =>
  new Date(new Date(iso).getTime() - 3 * 3600_000).toISOString().slice(0, 10);

function kpis(media: MediaInput[], daily: DailyInput[], ini: string, fim: string): Kpis {
  const pubs = media.filter(
    (m) =>
      m.publicado_em &&
      m.media_product_type !== "STORY" &&
      inRange(diaBR(m.publicado_em), ini, fim),
  );
  const sum = (metrica: string) => {
    const vals = daily.filter(
      (d) => d.metrica === metrica && inRange(d.dia, ini, fim) && d.valor != null,
    );
    return vals.length ? vals.reduce((a, d) => a + d.valor!, 0) : null;
  };
  const seg = daily
    .filter((d) => d.metrica === "followers_count" && d.valor != null && d.dia <= fim)
    .sort((a, b) => a.dia.localeCompare(b.dia));
  const segIni =
    [...seg].reverse().find((d) => d.dia <= ini) ?? seg.find((d) => d.dia >= ini) ?? null;
  const segFim = [...seg].reverse().find((d) => d.dia <= fim) ?? null;
  const taxas = pubs
    .map((m) => taxaInteracao(m.insights["total_interactions"], m.insights["reach"]))
    .filter((x): x is number => x != null);
  return {
    publicacoes: pubs.length,
    alcance_diario_somado: sum("reach"),
    visualizacoes: sum("views"),
    interacoes: sum("total_interactions"),
    seguidores_inicio: segIni?.valor ?? null,
    seguidores_fim: segFim?.valor ?? null,
    crescimento_seguidores_pct:
      segIni && segFim && segIni.dia !== segFim.dia ? variacao(segFim.valor, segIni.valor) : null,
    taxa_interacao_mediana: median(taxas),
  };
}

export function shiftDay(dia: string, days: number) {
  return new Date(new Date(`${dia}T12:00:00Z`).getTime() + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

export function buildReport(input: {
  tipo: string;
  inicio: string;
  fim: string;
  contas: {
    id: string;
    username: string;
    frequenciaSemanal: number | null;
    media: MediaInput[];
    daily: DailyInput[];
    falhas: string[];
  }[];
}): Relatorio {
  const dur =
    Math.round(
      (new Date(`${input.fim}T12:00:00Z`).getTime() -
        new Date(`${input.inicio}T12:00:00Z`).getTime()) /
        86_400_000,
    ) + 1;
  const pIni = shiftDay(input.inicio, -dur);
  const pFim = shiftDay(input.inicio, -1);

  const contas: ContaRelatorio[] = input.contas.map((c) => {
    const atual = kpis(c.media, c.daily, input.inicio, input.fim);
    const anterior = kpis(c.media, c.daily, pIni, pFim);
    const pubs = c.media
      .filter(
        (m) =>
          m.publicado_em &&
          m.media_product_type !== "STORY" &&
          inRange(diaBR(m.publicado_em), input.inicio, input.fim),
      )
      .map((m) => ({
        titulo: (m.caption ?? "").split("\n")[0]!.slice(0, 80) || m.ig_media_id,
        formato: formatoDe(m.media_product_type, m.media_type),
        alcance: m.insights["reach"] ?? null,
        taxa: taxaInteracao(m.insights["total_interactions"], m.insights["reach"]),
        permalink: m.permalink,
      }));
    const comTaxa = pubs.filter((p) => p.taxa != null).sort((a, b) => b.taxa! - a.taxa!);
    const formatos = new Map<string, typeof pubs>();
    for (const p of pubs) formatos.set(p.formato, [...(formatos.get(p.formato) ?? []), p]);
    const a = analyze({
      media: c.media,
      daily: c.daily,
      frequenciaSemanal: c.frequenciaSemanal,
      hoje: new Date(`${input.fim}T23:00:00Z`),
    });
    return {
      id: c.id,
      username: c.username,
      kpis: atual,
      anterior,
      variacoes: {
        publicacoes: variacao(atual.publicacoes, anterior.publicacoes),
        alcance: variacao(atual.alcance_diario_somado, anterior.alcance_diario_somado),
        visualizacoes: variacao(atual.visualizacoes, anterior.visualizacoes),
        interacoes: variacao(atual.interacoes, anterior.interacoes),
      },
      melhores: comTaxa.slice(0, 3),
      piores: comTaxa.length > 3 ? comTaxa.slice(-3).reverse() : [],
      por_formato: [...formatos.entries()].map(([formato, ps]) => ({
        formato,
        publicacoes: ps.length,
        alcance_mediano: median(ps.map((p) => p.alcance).filter((x): x is number => x != null)),
        taxa_mediana: median(ps.map((p) => p.taxa).filter((x): x is number => x != null)),
      })),
      problemas: c.falhas,
      recomendacoes: a.recomendacoes,
      avisos: a.avisos,
    };
  });

  const resumo: string[] = contas.map((c) => {
    const partes = [
      `@${c.username}: ${c.kpis.publicacoes} publicação(ões) no feed`,
      `alcance diário somado ${fmtNum(c.kpis.alcance_diario_somado)} (${fmtPct(c.variacoes["alcance"])} vs. período anterior)`,
      `interações ${fmtNum(c.kpis.interacoes)} (${fmtPct(c.variacoes["interacoes"])})`,
      `seguidores ${fmtNum(c.kpis.seguidores_fim)}${c.kpis.crescimento_seguidores_pct != null ? ` (${fmtPct(c.kpis.crescimento_seguidores_pct)})` : ""}`,
      `taxa de interação mediana ${fmtRate(c.kpis.taxa_interacao_mediana)}`,
    ];
    if (c.problemas.length) partes.push(`${c.problemas.length} falha(s) de publicação`);
    if (c.recomendacoes[0]) partes.push(`prioridade: ${c.recomendacoes[0].titulo.toLowerCase()}`);
    return `${partes.join("; ")}.`;
  });

  return {
    tipo: input.tipo,
    inicio: input.inicio,
    fim: input.fim,
    atualizado_em: new Date().toISOString(),
    resumo,
    contas,
    definicoes:
      "Alcance diário somado = soma do alcance de cada dia (a mesma pessoa pode contar em dias diferentes). Taxa de interação = interações ÷ alcance × 100 (interações = total_interactions da Meta). Variações comparam com o período imediatamente anterior de mesma duração. Dados da Meta podem atrasar até 48 horas.",
  };
}

/** CSV with one line per account and KPI (UTF-8 with BOM so Excel opens accents correctly). */
export function reportToCsv(r: Relatorio) {
  const rows = [["conta", "indicador", "periodo_atual", "periodo_anterior", "variacao_pct"]];
  const add = (
    c: ContaRelatorio,
    nome: string,
    a: number | null,
    b: number | null,
    v: number | null,
  ) =>
    rows.push([
      c.username,
      nome,
      a == null ? "" : String(a),
      b == null ? "" : String(b),
      v == null ? "" : v.toFixed(1),
    ]);
  for (const c of r.contas) {
    add(
      c,
      "publicacoes_feed",
      c.kpis.publicacoes,
      c.anterior.publicacoes,
      c.variacoes["publicacoes"] ?? null,
    );
    add(
      c,
      "alcance_diario_somado",
      c.kpis.alcance_diario_somado,
      c.anterior.alcance_diario_somado,
      c.variacoes["alcance"] ?? null,
    );
    add(
      c,
      "visualizacoes",
      c.kpis.visualizacoes,
      c.anterior.visualizacoes,
      c.variacoes["visualizacoes"] ?? null,
    );
    add(
      c,
      "interacoes",
      c.kpis.interacoes,
      c.anterior.interacoes,
      c.variacoes["interacoes"] ?? null,
    );
    add(
      c,
      "seguidores_fim",
      c.kpis.seguidores_fim,
      c.anterior.seguidores_fim,
      c.kpis.crescimento_seguidores_pct,
    );
    add(
      c,
      "taxa_interacao_mediana_pct",
      c.kpis.taxa_interacao_mediana,
      c.anterior.taxa_interacao_mediana,
      null,
    );
  }
  return "﻿" + rows.map((r) => r.map((x) => `"${x.replace(/"/g, '""')}"`).join(";")).join("\r\n");
}
