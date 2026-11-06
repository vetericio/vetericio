// Strategic analysis over real collected data. Every recommendation states what was observed, the
// numbers behind it, a hypothesis (never a proven cause), the action, the KPI to watch and a
// confidence level driven by sample size. Small samples produce "insufficient data", not conclusions.
import { fmtNum, fmtPct, fmtRate, formatoDe, taxaInteracao, variacao } from "./metrics";

export type MediaInput = {
  ig_media_id: string;
  publicado_em: string | null;
  media_type: string | null;
  media_product_type: string | null;
  caption: string | null;
  permalink: string | null;
  insights: Record<string, number | null | undefined>;
};
export type DailyInput = { dia: string; metrica: string; valor: number | null };

export type Confianca = "baixa" | "média" | "alta";
export type Recomendacao = {
  id: string;
  titulo: string;
  observado: string;
  dados: string;
  hipotese: string;
  acao: string;
  indicador: string;
  confianca: Confianca;
  impacto: 1 | 2 | 3;
  esforco: 1 | 2 | 3;
  urgencia: 1 | 2 | 3;
  prioridade: number;
};

/** Below this reach a rate like "3 of 3 = 100%" is noise, so the post is left out of comparisons. */
export const MIN_ALCANCE = 20;

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};
const conf = (n: number): Confianca => (n >= 20 ? "alta" : n >= 10 ? "média" : "baixa");
const hourBR = (iso: string) => (new Date(iso).getUTCHours() + 21) % 24;
const turno = (h: number) =>
  h < 6
    ? "madrugada (0h–6h)"
    : h < 12
      ? "manhã (6h–12h)"
      : h < 18
        ? "tarde (12h–18h)"
        : "noite (18h–24h)";
const title = (m: MediaInput) => (m.caption ?? "").split("\n")[0]!.slice(0, 60) || m.ig_media_id;

function rec(r: Omit<Recomendacao, "prioridade">): Recomendacao {
  return { ...r, prioridade: r.impacto * 2 + r.urgencia * 2 - r.esforco };
}

export function analyze(opts: {
  media: MediaInput[];
  daily: DailyInput[];
  frequenciaSemanal?: number | null;
  hoje?: Date;
}): { recomendacoes: Recomendacao[]; avisos: string[]; melhoresHorarios: string[] } {
  const hoje = opts.hoje ?? new Date();
  const out: Recomendacao[] = [];
  const avisos: string[] = [];
  const feed = opts.media.filter((m) => m.media_product_type !== "STORY" && m.publicado_em);
  const comAlcance = feed
    .map((m) => ({
      m,
      reach: m.insights["reach"] ?? null,
      rate: taxaInteracao(m.insights["total_interactions"], m.insights["reach"]),
    }))
    .filter(
      (x): x is { m: MediaInput; reach: number; rate: number } =>
        x.reach != null && x.reach >= MIN_ALCANCE && x.rate != null,
    );

  if (comAlcance.length < 5) {
    avisos.push(
      `Há ${comAlcance.length} publicação(ões) com alcance de pelo menos ${MIN_ALCANCE} contas. São necessárias ao menos 5 para comparar desempenho; com menos que isso, qualquer conclusão seria palpite. Continue publicando e coletando por mais alguns dias.`,
    );
  }

  // 1. Above / below the account's own median
  if (comAlcance.length >= 5) {
    const med = median(comAlcance.map((x) => x.rate));
    const acima = comAlcance.filter((x) => x.rate >= med * 1.5).sort((a, b) => b.rate - a.rate);
    const abaixo = comAlcance.filter((x) => x.rate <= med * 0.5).sort((a, b) => a.rate - b.rate);
    if (acima.length) {
      const top = acima.slice(0, 3);
      out.push(
        rec({
          id: "acima-media",
          titulo: "Publicações com desempenho bem acima da média da conta",
          observado: `${acima.length} publicação(ões) tiveram taxa de interação pelo menos 50% acima da mediana da conta.`,
          dados: `Mediana da conta: ${fmtRate(med)} (n=${comAlcance.length}). Destaques: ${top.map((x) => `“${title(x.m)}” ${fmtRate(x.rate)}`).join("; ")}.`,
          hipotese:
            "O tema, o formato ou a chamada dessas publicações conversa melhor com o público. É uma hipótese: o horário, a distribuição da Meta e eventos externos também influenciam.",
          acao: "Produzir 2 ou 3 conteúdos novos no mesmo tema e formato dos destaques e comparar com a mediana nas próximas 2 semanas.",
          indicador: "Taxa de interação das novas publicações versus a mediana atual.",
          confianca: conf(comAlcance.length),
          impacto: 3,
          esforco: 2,
          urgencia: 2,
        }),
      );
    }
    if (abaixo.length) {
      out.push(
        rec({
          id: "abaixo-media",
          titulo: "Publicações com desempenho bem abaixo da média",
          observado: `${abaixo.length} publicação(ões) ficaram com taxa de interação até a metade da mediana da conta.`,
          dados: `Mediana: ${fmtRate(med)}. Mais baixas: ${abaixo
            .slice(0, 3)
            .map((x) => `“${title(x.m)}” ${fmtRate(x.rate)}`)
            .join("; ")}.`,
          hipotese:
            "O tema pode ter pouco apelo para o público atual, ou a chamada para ação não ficou clara.",
          acao: "Evitar repetir esse tipo de conteúdo sem ajuste; se repetir, mudar a primeira frase da legenda e a capa.",
          indicador: "Taxa de interação de conteúdos parecidos depois do ajuste.",
          confianca: conf(comAlcance.length),
          impacto: 2,
          esforco: 1,
          urgencia: 1,
        }),
      );
    }

    // 2. Fatigue: last 3 vs previous 3
    const recentes = [...comAlcance].sort((a, b) =>
      b.m.publicado_em!.localeCompare(a.m.publicado_em!),
    );
    if (recentes.length >= 6) {
      const ult = median(recentes.slice(0, 3).map((x) => x.rate));
      const ant = median(recentes.slice(3, 6).map((x) => x.rate));
      const v = variacao(ult, ant);
      if (v != null && v <= -40) {
        out.push(
          rec({
            id: "fadiga",
            titulo: "Possível sinal de fadiga de conteúdo",
            observado:
              "As 3 publicações mais recentes tiveram taxa de interação bem menor que as 3 anteriores.",
            dados: `Mediana das 3 últimas: ${fmtRate(ult)}; das 3 anteriores: ${fmtRate(ant)} (${fmtPct(v)}).`,
            hipotese:
              "O público pode estar vendo conteúdos muito parecidos em sequência. Com só 6 publicações, pode ser apenas variação normal.",
            acao: "Alternar o formato e o tema nas próximas publicações (por exemplo, intercalar ao vivo, bastidores e chamada para contratar).",
            indicador: "Mediana da taxa de interação das próximas 3 publicações.",
            confianca: "baixa",
            impacto: 2,
            esforco: 2,
            urgencia: 2,
          }),
        );
      }
    }

    // 3. Reuse opportunities
    const antigos = acima.filter(
      (x) => hoje.getTime() - new Date(x.m.publicado_em!).getTime() > 30 * 86_400_000,
    );
    if (antigos.length) {
      out.push(
        rec({
          id: "reaproveitar",
          titulo: "Conteúdos fortes que podem ser reaproveitados",
          observado: `${antigos.length} publicação(ões) de mais de 30 dias ficaram bem acima da média.`,
          dados: antigos
            .slice(0, 3)
            .map(
              (x) =>
                `“${title(x.m)}” ${fmtRate(x.rate)}${x.m.permalink ? ` (${x.m.permalink})` : ""}`,
            )
            .join("; "),
          hipotese: "Parte do público atual não viu esses conteúdos.",
          acao: "Republicar em outro formato (por exemplo, um trecho como Reels, ou repostar nos Stories com uma chamada nova).",
          indicador: "Alcance e interações do conteúdo reaproveitado versus o original.",
          confianca: conf(comAlcance.length),
          impacto: 2,
          esforco: 1,
          urgencia: 1,
        }),
      );
    }
  }

  // 4. Formats
  const porFormato = new Map<string, number[]>();
  for (const x of comAlcance) {
    const f = formatoDe(x.m.media_product_type, x.m.media_type);
    porFormato.set(f, [...(porFormato.get(f) ?? []), x.reach]);
  }
  const formatos = [...porFormato.entries()]
    .filter(([, v]) => v.length >= 3)
    .map(([f, v]) => ({ f, n: v.length, med: median(v) }));
  if (formatos.length >= 2) {
    formatos.sort((a, b) => b.med - a.med);
    const [best, second] = formatos;
    if (best && second && best.med >= second.med * 1.3) {
      out.push(
        rec({
          id: "formato",
          titulo: `${best.f} alcança mais pessoas que os outros formatos`,
          observado: `A mediana de alcance de ${best.f} é maior que a dos demais formatos.`,
          dados: formatos.map((x) => `${x.f}: mediana ${fmtNum(x.med)} (n=${x.n})`).join("; "),
          hipotese:
            "A Meta tende a distribuir mais esse formato para não seguidores, e o público responde melhor a ele. Formatos diferentes têm objetivos diferentes, então a comparação é só de alcance.",
          acao: `Aumentar a proporção de ${best.f} no calendário das próximas 2 semanas, mantendo os outros formatos para conversão.`,
          indicador: "Alcance semanal da conta e a mediana de alcance por formato.",
          confianca: conf(Math.min(...formatos.map((x) => x.n))),
          impacto: 3,
          esforco: 2,
          urgencia: 2,
        }),
      );
    }
  } else if (comAlcance.length >= 5) {
    avisos.push(
      "Ainda não há ao menos 3 publicações de dois formatos diferentes para comparar formatos.",
    );
  }

  // 5. Time of day
  const porTurno = new Map<string, number[]>();
  for (const x of comAlcance)
    porTurno.set(turno(hourBR(x.m.publicado_em!)), [
      ...(porTurno.get(turno(hourBR(x.m.publicado_em!))) ?? []),
      x.reach,
    ]);
  const turnos = [...porTurno.entries()]
    .filter(([, v]) => v.length >= 3)
    .map(([t, v]) => ({ t, n: v.length, med: median(v) }))
    .sort((a, b) => b.med - a.med);
  const melhoresHorarios = turnos.length >= 2 ? [turnos[0]!.t] : [];
  if (turnos.length >= 2 && turnos[0]!.med >= turnos[1]!.med * 1.2) {
    out.push(
      rec({
        id: "horario",
        titulo: `Publicações à ${turnos[0]!.t} tiveram mais alcance`,
        observado: `A mediana de alcance das publicações feitas à ${turnos[0]!.t} foi a maior.`,
        dados: turnos.map((x) => `${x.t}: mediana ${fmtNum(x.med)} (n=${x.n})`).join("; "),
        hipotese:
          "Pode ser o horário em que o público está mais ativo, mas o conteúdo de cada publicação também pesa: isto é uma estimativa, não uma certeza.",
        acao: `Testar as próximas publicações à ${turnos[0]!.t} por 2 semanas e comparar.`,
        indicador: "Mediana de alcance por turno nas próximas 2 semanas.",
        confianca: conf(Math.min(turnos[0]!.n, turnos[1]!.n)),
        impacto: 2,
        esforco: 1,
        urgencia: 1,
      }),
    );
  }

  // 6. Account reach trend (last 7 days vs previous 7)
  const reachDay = new Map(
    opts.daily
      .filter((d) => d.metrica === "reach" && d.valor != null)
      .map((d) => [d.dia, d.valor!]),
  );
  const dias = [...reachDay.keys()].sort();
  if (dias.length >= 14) {
    const last = dias.slice(-7);
    const prev = dias.slice(-14, -7);
    const sLast = last.reduce((a, d) => a + reachDay.get(d)!, 0);
    const sPrev = prev.reduce((a, d) => a + reachDay.get(d)!, 0);
    const v = variacao(sLast, sPrev);
    if (v != null && v <= -30 && sPrev >= 50) {
      out.push(
        rec({
          id: "queda-alcance",
          titulo: "Queda relevante de alcance na última semana",
          observado:
            "O alcance diário somado dos últimos 7 dias caiu em relação aos 7 dias anteriores.",
          dados: `Últimos 7 dias: ${fmtNum(sLast)}; 7 dias anteriores: ${fmtNum(sPrev)} (${fmtPct(v)}).`,
          hipotese:
            "Menos publicações no período, conteúdos com menos apelo ou mudança de distribuição da Meta.",
          acao: "Conferir a frequência de publicação da semana e retomar o formato com melhor alcance.",
          indicador: "Alcance diário somado da próxima semana.",
          confianca: "média",
          impacto: 3,
          esforco: 1,
          urgencia: 3,
        }),
      );
    }
  } else {
    avisos.push(
      `Há ${dias.length} dia(s) de alcance diário coletados; a comparação semanal começa com 14 dias.`,
    );
  }

  // 7. Followers
  const seg = opts.daily
    .filter((d) => d.metrica === "followers_count" && d.valor != null)
    .sort((a, b) => a.dia.localeCompare(b.dia));
  if (seg.length >= 7) {
    const ini = seg[Math.max(0, seg.length - 14)]!;
    const fim = seg[seg.length - 1]!;
    const g = variacao(fim.valor, ini.valor);
    if (g != null && g <= 0) {
      out.push(
        rec({
          id: "seguidores",
          titulo: "Número de seguidores estagnado ou em queda",
          observado: `Os seguidores foram de ${fmtNum(ini.valor)} (${ini.dia}) para ${fmtNum(fim.valor)} (${fim.dia}).`,
          dados: `Variação: ${fmtPct(g)} em ${seg.length >= 14 ? 14 : seg.length} dias.`,
          hipotese:
            "O conteúdo está alcançando sobretudo quem já segue, ou falta uma chamada clara para seguir.",
          acao: "Incluir chamada para seguir nas publicações de maior alcance e priorizar formatos que chegam a não seguidores (Reels).",
          indicador: "Seguidores ao fim das próximas 2 semanas.",
          confianca: "média",
          impacto: 2,
          esforco: 1,
          urgencia: 2,
        }),
      );
    }
  }

  // 8. Frequency versus the brand's plan
  if (opts.frequenciaSemanal) {
    const semana = feed.filter(
      (m) => hoje.getTime() - new Date(m.publicado_em!).getTime() <= 7 * 86_400_000,
    ).length;
    if (semana < opts.frequenciaSemanal) {
      out.push(
        rec({
          id: "frequencia",
          titulo: "Frequência abaixo do planejado",
          observado: `Foram ${semana} publicação(ões) no feed nos últimos 7 dias; o planejado para a marca é ${opts.frequenciaSemanal} por semana.`,
          dados: `Planejado: ${opts.frequenciaSemanal}/semana. Realizado: ${semana}.`,
          hipotese: "Com menos publicações, a conta aparece menos para o público.",
          acao: "Completar o calendário da próxima semana até a frequência planejada.",
          indicador: "Publicações por semana e alcance semanal.",
          confianca: "alta",
          impacto: 2,
          esforco: 2,
          urgencia: 2,
        }),
      );
    }
  }

  return {
    recomendacoes: out.sort((a, b) => b.prioridade - a.prioridade),
    avisos,
    melhoresHorarios,
  };
}
