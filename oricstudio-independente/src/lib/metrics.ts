// Metric catalog and calculations shared by the server (collector, reports) and the UI.
// Values returned by Meta are stored as-is; everything here that is "calculado" is derived by the system.

export type MetricDef = {
  label: string;
  definicao: string;
  origem: "meta" | "calculado";
  limitacoes?: string;
};

export const ACCOUNT_METRICS: Record<string, MetricDef> = {
  reach: {
    label: "Alcance",
    definicao: "Contas únicas que viram algum conteúdo da conta no dia.",
    origem: "meta",
    limitacoes:
      "Somar o alcance de vários dias conta a mesma pessoa mais de uma vez: é um indicador de volume, não de pessoas únicas no período.",
  },
  views: {
    label: "Visualizações",
    definicao:
      "Vezes que o conteúdo foi exibido ou reproduzido (substitui “impressões”, descontinuada pela Meta em 2025).",
    origem: "meta",
  },
  accounts_engaged: {
    label: "Contas engajadas",
    definicao: "Contas que interagiram com o conteúdo no dia.",
    origem: "meta",
  },
  total_interactions: {
    label: "Interações",
    definicao:
      "Curtidas, comentários, compartilhamentos, salvamentos, respostas e republicações, somados pela Meta.",
    origem: "meta",
  },
  likes: { label: "Curtidas", definicao: "Curtidas recebidas no dia.", origem: "meta" },
  comments: { label: "Comentários", definicao: "Comentários recebidos no dia.", origem: "meta" },
  shares: { label: "Compartilhamentos", definicao: "Compartilhamentos no dia.", origem: "meta" },
  saves: { label: "Salvamentos", definicao: "Salvamentos no dia.", origem: "meta" },
  replies: {
    label: "Respostas",
    definicao: "Respostas a stories no dia.",
    origem: "meta",
    limitacoes: "A Meta retorna 0 para contas da Europa e do Japão.",
  },
  profile_links_taps: {
    label: "Toques em links do perfil",
    definicao: "Toques nos botões de contato e links do perfil (ex.: WhatsApp).",
    origem: "meta",
  },
  follows_and_unfollows: {
    label: "Seguiu/deixou de seguir",
    definicao: "Saldo de novos seguidores menos quem deixou de seguir no dia.",
    origem: "meta",
    limitacoes: "Indisponível para contas com menos de 100 seguidores.",
  },
  followers_count: {
    label: "Seguidores",
    definicao: "Total de seguidores no momento da coleta (perfil).",
    origem: "meta",
    limitacoes: "O histórico começa no primeiro dia de coleta deste sistema.",
  },
};

export const MEDIA_METRICS: Record<string, MetricDef> = {
  reach: { label: "Alcance", definicao: "Contas únicas que viram a publicação.", origem: "meta" },
  views: {
    label: "Visualizações",
    definicao: "Exibições ou reproduções da publicação.",
    origem: "meta",
  },
  likes: { label: "Curtidas", definicao: "Curtidas na publicação.", origem: "meta" },
  comments: { label: "Comentários", definicao: "Comentários na publicação.", origem: "meta" },
  shares: {
    label: "Compartilhamentos",
    definicao: "Compartilhamentos da publicação.",
    origem: "meta",
  },
  saved: { label: "Salvamentos", definicao: "Vezes que a publicação foi salva.", origem: "meta" },
  total_interactions: {
    label: "Interações",
    definicao: "Interações somadas pela Meta.",
    origem: "meta",
  },
  profile_visits: {
    label: "Visitas ao perfil",
    definicao: "Visitas ao perfil a partir da publicação.",
    origem: "meta",
  },
  follows: {
    label: "Novos seguidores",
    definicao: "Pessoas que passaram a seguir a partir da publicação.",
    origem: "meta",
  },
  ig_reels_avg_watch_time: {
    label: "Tempo médio assistido (ms)",
    definicao: "Tempo médio que cada reprodução do Reels durou.",
    origem: "meta",
    limitacoes: "Métrica marcada pela Meta como em desenvolvimento.",
  },
  ig_reels_video_view_total_time: {
    label: "Tempo total assistido (ms)",
    definicao: "Soma do tempo assistido em todas as reproduções.",
    origem: "meta",
    limitacoes: "Métrica marcada pela Meta como em desenvolvimento.",
  },
  replies: { label: "Respostas", definicao: "Respostas ao story.", origem: "meta" },
  navigation: {
    label: "Navegação",
    definicao: "Avanços, voltas e saídas no story.",
    origem: "meta",
  },
};

export const CALCULATED: Record<string, MetricDef> = {
  taxa_interacao: {
    label: "Taxa de interação",
    definicao:
      "Interações ÷ alcance × 100. Interações = total_interactions da Meta (curtidas, comentários, compartilhamentos, salvamentos, respostas e republicações).",
    origem: "calculado",
    limitacoes: "Não é calculada quando o alcance é zero ou não está disponível.",
  },
  crescimento_seguidores: {
    label: "Crescimento de seguidores",
    definicao: "(Seguidores no fim − seguidores no início) ÷ seguidores no início × 100.",
    origem: "calculado",
    limitacoes: "Não é calculado quando o número inicial é zero ou não existe no histórico.",
  },
  variacao: {
    label: "Variação",
    definicao:
      "(Valor atual − valor anterior) ÷ valor anterior × 100, sempre entre períodos de mesma duração.",
    origem: "calculado",
    limitacoes: "Não é calculada quando o valor anterior é zero.",
  },
};

/** Metrics requested per media kind (Meta rejects the whole call if one metric is invalid for the type). */
export function mediaMetricsFor(productType: string | null, mediaType: string | null): string[] {
  if (productType === "STORY")
    return [
      "reach",
      "views",
      "shares",
      "total_interactions",
      "replies",
      "navigation",
      "follows",
      "profile_visits",
    ];
  if (productType === "REELS")
    return [
      "reach",
      "views",
      "likes",
      "comments",
      "shares",
      "saved",
      "total_interactions",
      "ig_reels_avg_watch_time",
      "ig_reels_video_view_total_time",
    ];
  void mediaType;
  return [
    "reach",
    "views",
    "likes",
    "comments",
    "shares",
    "saved",
    "total_interactions",
    "profile_visits",
    "follows",
  ];
}

export const CORE_MEDIA_METRICS = [
  "reach",
  "likes",
  "comments",
  "shares",
  "saved",
  "total_interactions",
];

export function taxaInteracao(
  interacoes: number | null | undefined,
  alcance: number | null | undefined,
): number | null {
  if (interacoes == null || alcance == null || alcance <= 0) return null;
  return (interacoes / alcance) * 100;
}

export function variacao(
  atual: number | null | undefined,
  anterior: number | null | undefined,
): number | null {
  if (atual == null || anterior == null || anterior === 0) return null;
  return ((atual - anterior) / anterior) * 100;
}

export const crescimento = variacao;

export function fmtNum(v: number | null | undefined) {
  return v == null ? "não disponível" : Math.round(v).toLocaleString("pt-BR");
}

export function fmtPct(v: number | null | undefined, digits = 1) {
  return v == null
    ? "não calculável"
    : `${v >= 0 && v !== 0 ? "+" : ""}${v.toFixed(digits).replace(".", ",")}%`;
}

export function fmtRate(v: number | null | undefined) {
  return v == null ? "não calculável" : `${v.toFixed(2).replace(".", ",")}%`;
}

/** yyyy-mm-dd for a moment, in Brasília time. */
export function diaBrasilia(d: Date) {
  return new Date(d.getTime() - 3 * 3600_000).toISOString().slice(0, 10);
}

export function formatoDe(productType: string | null, mediaType: string | null): string {
  if (productType === "REELS") return "Reels";
  if (productType === "STORY") return "Story";
  if (mediaType === "CAROUSEL_ALBUM") return "Carrossel";
  if (mediaType === "VIDEO") return "Vídeo";
  return "Imagem";
}
