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

/* ---------- regras de alerta ---------- */

export type ChaveAlerta = "temperatura" | "pas" | "glicemia";

export type RegraAlerta = {
  chave: ChaveAlerta;
  /** "abaixo" dispara quando o valor for menor que o limite. */
  lado: "abaixo" | "acima";
  pergunta: string;
  /** Item criado quando o usuário confirma. */
  itemNome: string;
  itemCategoria: CategoriaPendencia;
  /** Limite padrão, usado quando o usuário não configurou nada. */
  limitePadrao: number;
};

export const REGRAS_ALERTA: RegraAlerta[] = [
  {
    chave: "temperatura",
    lado: "abaixo",
    pergunta: "Animal apresentou temperatura baixa. Foi para o aquecimento?",
    itemNome: "Aquecimento",
    itemCategoria: "procedimento",
    limitePadrao: 37.5,
  },
  {
    chave: "pas",
    lado: "abaixo",
    pergunta: "PAS baixa. Foi iniciada norepinefrina?",
    itemNome: "Norepinefrina",
    itemCategoria: "medicamento",
    limitePadrao: 90,
  },
];

export type LimitesAlerta = Partial<Record<ChaveAlerta, number>>;

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

export function salvarLimites(limites: LimitesAlerta) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CHAVE_ALERTAS, JSON.stringify(limites));
  } catch {
    /* armazenamento indisponível */
  }
}

export function limiteDaRegra(regra: RegraAlerta, limites: LimitesAlerta): number {
  const salvo = limites[regra.chave];
  return typeof salvo === "number" && Number.isFinite(salvo) ? salvo : regra.limitePadrao;
}

/** Regra disparada por um valor digitado, ou null. */
export function regraDisparada(
  chave: string,
  valor: string,
  limites: LimitesAlerta,
): RegraAlerta | null {
  const regra = REGRAS_ALERTA.find((r) => r.chave === chave);
  if (!regra) return null;
  // Em campos com histórico ("35,8 / 38,1") vale o último valor digitado.
  const ultimo = valor.split("/").pop() ?? "";
  const n = Number(ultimo.replace(",", ".").trim());
  if (!Number.isFinite(n) || !ultimo.trim()) return null;
  const limite = limiteDaRegra(regra, limites);
  if (regra.lado === "abaixo" ? n < limite : n > limite) return regra;
  return null;
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
