/**
 * Módulo Pendências: tudo que precisa de acompanhamento ou de cobrança ao tutor.
 * Guarda os dados separados da ficha (o PDF clínico não usa nada daqui).
 */

export const CHAVE_PENDENCIAS = "veterico-pendencias-v1";
export const CHAVE_ALERTAS = "veterico-alertas-v1";

export type CategoriaPendencia = "pendencia" | "medicamento" | "procedimento";

export type StatusPendencia = "pendente" | "realizado" | "cancelado";

export type Ocorrencia = {
  id: string;
  /** ISO do momento em que foi realizada. */
  em: string;
  observacao?: string;
};

export type ItemPendencia = {
  id: string;
  /** Identidade do animal (nome normalizado). Vazio = internação em geral. */
  animalChave: string;
  animalNome: string;
  especie?: string;
  categoria: CategoriaPendencia;
  nome: string;
  unidade?: string;
  dose?: string;
  via?: string;
  observacao?: string;
  status: StatusPendencia;
  ocorrencias: Ocorrencia[];
  /** "anamnese" quando o item nasceu da anamnese do animal. */
  origem?: "anamnese";
  /** id da pendência da anamnese, para não duplicar ao espelhar. */
  origemId?: string;
  criadoEm: string;
  atualizadoEm: string;
};

export const ROTULO_CATEGORIA: Record<CategoriaPendencia, string> = {
  pendencia: "Pendência",
  medicamento: "Medicamento especial",
  procedimento: "Procedimento especial",
};

/** Procedimentos sugeridos no lançamento rápido. */
export const PROCEDIMENTOS_PADRAO = ["Glicose", "Oxigênio", "Aquecimento"] as const;

export const ANIMAL_GERAL = "Internação (geral)";

export function novoId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `pen-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function chaveDoAnimal(nome: string): string {
  return nome
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function itemVazio(categoria: CategoriaPendencia): ItemPendencia {
  const agora = new Date().toISOString();
  return {
    id: novoId(),
    animalChave: "",
    animalNome: "",
    especie: "",
    categoria,
    nome: "",
    unidade: "",
    dose: "",
    via: "",
    observacao: "",
    status: "pendente",
    ocorrencias: [],
    criadoEm: agora,
    atualizadoEm: agora,
  };
}

export function totalOcorrencias(item: ItemPendencia): number {
  return item.ocorrencias.length;
}

export function registrarOcorrencia(item: ItemPendencia, observacao = ""): ItemPendencia {
  const agora = new Date().toISOString();
  return {
    ...item,
    ocorrencias: [
      ...item.ocorrencias,
      { id: novoId(), em: agora, ...(observacao.trim() ? { observacao: observacao.trim() } : {}) },
    ],
    atualizadoEm: agora,
  };
}

export function removerOcorrencia(item: ItemPendencia, ocorrenciaId: string): ItemPendencia {
  return {
    ...item,
    ocorrencias: item.ocorrencias.filter((o) => o.id !== ocorrenciaId),
    atualizadoEm: new Date().toISOString(),
  };
}

export type GrupoAnimal = {
  chave: string;
  nome: string;
  itens: ItemPendencia[];
  abertas: number;
  feitas: number;
  cobrancas: number;
};

/** Agrupa por animal, em ordem alfabética, com os contadores prontos. */
export function agruparPorAnimal(lista: ItemPendencia[]): GrupoAnimal[] {
  const mapa = new Map<string, GrupoAnimal>();
  for (const item of lista) {
    const chave = item.animalChave;
    const atual =
      mapa.get(chave) ??
      ({
        chave,
        nome: item.animalNome.trim() || ANIMAL_GERAL,
        itens: [],
        abertas: 0,
        feitas: 0,
        cobrancas: 0,
      } satisfies GrupoAnimal);
    atual.itens.push(item);
    if (item.status === "pendente") atual.abertas += 1;
    if (item.status === "realizado") atual.feitas += 1;
    atual.cobrancas += totalOcorrencias(item);
    mapa.set(chave, atual);
  }
  return [...mapa.values()].sort((a, b) => {
    if (!a.chave) return -1;
    if (!b.chave) return 1;
    return a.nome.localeCompare(b.nome, "pt-BR");
  });
}

/** "09/09 20:14" */
export function quandoCurto(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ---------- regras de alerta (cadastradas pelo usuário) ---------- */

export const CHAVE_REGRAS = "veterico-regras-alerta-v1";

export type ParametroAlerta = "temperatura" | "fc" | "fr" | "pas" | "glicemia";

export type CondicaoAlerta = "sempre" | "abaixo" | "acima";

export type RegraAlerta = {
  id: string;
  parametro: ParametroAlerta;
  /** "sempre" pergunta a cada valor preenchido. */
  condicao: CondicaoAlerta;
  limite?: number;
  pergunta: string;
  itemNome: string;
  itemCategoria: CategoriaPendencia;
  ativo: boolean;
};

export const ROTULO_PARAMETRO: Record<ParametroAlerta, string> = {
  temperatura: "Temperatura (°C)",
  fc: "FC (bpm)",
  fr: "FR (mpm)",
  pas: "PAS (mmHg)",
  glicemia: "Glicemia (mg/dL)",
};

export const ROTULO_CONDICAO: Record<CondicaoAlerta, string> = {
  sempre: "Sempre que eu preencher",
  abaixo: "Abaixo de",
  acima: "Acima de",
};

export const PARAMETROS_ALERTA: ParametroAlerta[] = [
  "temperatura",
  "fc",
  "fr",
  "pas",
  "glicemia",
];

export function regraVazia(): RegraAlerta {
  return {
    id: novoId(),
    parametro: "glicemia",
    condicao: "sempre",
    pergunta: "Registrar para cobrança?",
    itemNome: "",
    itemCategoria: "procedimento",
    ativo: true,
  };
}

/** Regras que já vêm prontas (o usuário pode editar todas). */
export function regrasIniciais(limites: LimitesAlerta = {}): RegraAlerta[] {
  return [
    {
      id: novoId(),
      parametro: "glicemia",
      condicao: "sempre",
      pergunta: "Registrar a glicemia para cobrança?",
      itemNome: "Glicose",
      itemCategoria: "procedimento",
      ativo: true,
    },
    {
      id: novoId(),
      parametro: "pas",
      condicao: "abaixo",
      limite: typeof limites.pas === "number" ? limites.pas : 90,
      pergunta: "PAS baixa. Foi iniciada norepinefrina?",
      itemNome: "Norepinefrina",
      itemCategoria: "medicamento",
      ativo: true,
    },
    {
      id: novoId(),
      parametro: "temperatura",
      condicao: "abaixo",
      limite: typeof limites.temperatura === "number" ? limites.temperatura : 37.5,
      pergunta: "Animal apresentou temperatura baixa. Foi para o aquecimento?",
      itemNome: "Aquecimento",
      itemCategoria: "procedimento",
      ativo: true,
    },
  ];
}

export type LimitesAlerta = Partial<Record<ParametroAlerta, number>>;

/** Limites da versão anterior — usados só para migrar. */
export function carregarLimites(): LimitesAlerta {
  if (typeof window === "undefined") return {};
  try {
    const bruto = window.localStorage.getItem(CHAVE_ALERTAS);
    if (!bruto) return {};
    const dados = JSON.parse(bruto);
    return dados && typeof dados === "object" && !Array.isArray(dados)
      ? (dados as LimitesAlerta)
      : {};
  } catch {
    return {};
  }
}

export function salvarRegras(regras: RegraAlerta[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CHAVE_REGRAS, JSON.stringify(regras));
  } catch {
    /* armazenamento indisponível */
  }
}

/** Lê as regras salvas; na primeira vez semeia as prontas migrando os limites antigos. */
export function carregarRegras(): RegraAlerta[] {
  if (typeof window === "undefined") return [];
  try {
    const bruto = window.localStorage.getItem(CHAVE_REGRAS);
    if (bruto) {
      const lista = JSON.parse(bruto);
      if (Array.isArray(lista)) {
        return (lista as RegraAlerta[])
          .filter((r) => r && r.id && r.parametro)
          .map((r) => ({ ...r, ativo: r.ativo !== false }));
      }
    }
  } catch {
    /* conteúdo inválido: recomeça */
  }
  const iniciais = regrasIniciais(carregarLimites());
  salvarRegras(iniciais);
  return iniciais;
}

/** Todas as regras ativas disparadas por um valor digitado. */
export function regrasDisparadas(
  parametro: string,
  valor: string,
  regras: RegraAlerta[],
): RegraAlerta[] {
  // Em campos com histórico ("35,8 / 38,1") vale o último valor digitado.
  const ultimo = valor.split("/").pop() ?? "";
  if (!ultimo.trim()) return [];
  const n = Number(ultimo.replace(",", ".").trim());
  if (!Number.isFinite(n)) return [];
  return regras.filter((r) => {
    if (!r.ativo || r.parametro !== parametro) return false;
    if (r.condicao === "sempre") return true;
    if (typeof r.limite !== "number" || !Number.isFinite(r.limite)) return false;
    return r.condicao === "abaixo" ? n < r.limite : n > r.limite;
  });
}

/* ---------- persistência ---------- */

export function carregarPendencias(): ItemPendencia[] {
  if (typeof window === "undefined") return [];
  try {
    const bruto = window.localStorage.getItem(CHAVE_PENDENCIAS);
    if (!bruto) return [];
    const lista = JSON.parse(bruto);
    if (!Array.isArray(lista)) return [];
    return (lista as ItemPendencia[]).map((i) => ({
      ...i,
      ocorrencias: Array.isArray(i.ocorrencias) ? i.ocorrencias : [],
    }));
  } catch {
    return [];
  }
}

export function salvarPendencias(lista: ItemPendencia[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CHAVE_PENDENCIAS, JSON.stringify(lista));
  } catch {
    /* armazenamento cheio */
  }
}
