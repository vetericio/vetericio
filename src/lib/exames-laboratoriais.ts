import type { ExameAnamnese } from "./anamnese";
import type { Especie } from "./ficha";

export type GrupoExames = "hemograma" | "bioquimico" | "outrosExames";
export type ExamesAnamnese = Record<GrupoExames, ExameAnamnese[]>;
export type ReferenciasExames = Record<"Cachorro" | "Gato", Record<string, string>>;
export const CHAVE_REFERENCIAS_EXAMES = "veterico-referencias-exames-v2";
export const GRUPOS_EXAMES: GrupoExames[] = ["hemograma", "bioquimico", "outrosExames"];

// Parâmetros do hemograma/bioquímico transcritos do laudo canino enviado em 22/09/2026.
// As referências continuam editáveis no app. Para Gato, permanecem em branco.
const PADRAO: ExamesAnamnese = {
  hemograma: [
    // Já existiam no app
    { id: "hematocrito", nome: "VG (Hematócrito)", unidade: "%", valor: "", referencia: "" },
    { id: "plaquetas", nome: "Plaquetas", unidade: "/µL", valor: "", referencia: "" },
    { id: "leucocitos", nome: "Leucócitos totais", unidade: "/µL", valor: "", referencia: "" },

    // Novos — ordem alfabética
    { id: "basofilo", nome: "Basófilo", unidade: "%", valor: "", referencia: "" },
    { id: "bastonete", nome: "Bastonete", unidade: "%", valor: "", referencia: "" },
    { id: "chcm", nome: "CHCM (Concentração de Hemoglobina Corpuscular Média)", unidade: "g/dL", valor: "", referencia: "" },
    { id: "eosinofilo", nome: "Eosinófilo", unidade: "%", valor: "", referencia: "" },
    { id: "eritrocitos", nome: "Eritrócitos", unidade: "milhões/µL", valor: "", referencia: "" },
    { id: "hcm", nome: "HCM (Hemoglobina Corpuscular Média)", unidade: "pg", valor: "", referencia: "" },
    { id: "hemoglobina", nome: "Hemoglobina", unidade: "g/dL", valor: "", referencia: "" },
    { id: "leucocitos-corrigido", nome: "Leucócitos corrigido", unidade: "/µL", valor: "", referencia: "" },
    { id: "linfocito", nome: "Linfócito", unidade: "%", valor: "", referencia: "" },
    { id: "metamielocito", nome: "Metamielócito", unidade: "%", valor: "", referencia: "" },
    { id: "monocito", nome: "Monócito", unidade: "%", valor: "", referencia: "" },
    { id: "rdw-cv", nome: "RDW (Variação do tamanho das hemácias)", unidade: "%", valor: "", referencia: "" },
    { id: "segmentado", nome: "Segmentado", unidade: "%", valor: "", referencia: "" },
    { id: "vcm", nome: "VCM (Volume Corpuscular Médio)", unidade: "fL", valor: "", referencia: "" },
  ],
  bioquimico: [
    // Já existiam no app
    { id: "creatinina", nome: "Creatinina", unidade: "mg/dL", valor: "", referencia: "" },
    { id: "ureia", nome: "Uréia", unidade: "mg/dL", valor: "", referencia: "" },
    { id: "tgp", nome: "TGP/ALT (Alanina aminotransferase)", unidade: "U/L", valor: "", referencia: "" },

    // Novos — ordem alfabética
    { id: "albumina", nome: "Albumina", unidade: "g/dL", valor: "", referencia: "" },
    { id: "fosforo", nome: "Fósforo", unidade: "mg/dL", valor: "", referencia: "" },
    { id: "globulina", nome: "Globulina", unidade: "g/dL", valor: "", referencia: "" },
    { id: "proteina-total", nome: "Proteína total", unidade: "g/dL", valor: "", referencia: "" },
    { id: "relacao-ag", nome: "Relação A/G (Albumina/Globulina)", unidade: "", valor: "", referencia: "" },
  ],
  outrosExames: [],
};

const REFERENCIAS_CACHORRO_PADRAO: Record<string, string> = {
  // Faixas caninas do laudo LabNet enviado em 26/09/2026.
  // Contagens são armazenadas em valores absolutos: ex. 175 mil/µL = 175000/µL.
  "eritrocitos|milhoes/µl": "5,5 – 8,5",
  "hemoglobina|g/dl": "12 – 18",
  "hematocrito|%": "37 – 55",
  "vcm (volume corpuscular medio)|fl": "60 – 77",
  "hcm (hemoglobina corpuscular media)|pg": "19,5 – 24,5",
  "chcm (concentracao de hemoglobina corpuscular media)|g/dl": "32 – 36",
  "rdw (variacao do tamanho das hemacias)|%": "12 – 16",
  "leucocitos totais|/µl": "6000 – 17000",
  "leucocitos corrigido|/µl": "6000 – 17000",
  "metamielocito|%": "0",
  "bastonete|%": "0 – 1,8",
  "segmentado|%": "50 – 80",
  "eosinofilo|%": "2 – 10",
  "linfocito|%": "12 – 30",
  "monocito|%": "3 – 8",
  "basofilo|%": "0",
  "plaquetas|/µl": "175000 – 500000",
  "ureia|mg/dl": "20 – 60",
  "creatinina|mg/dl": "0,50 – 1,50",
  "tgp/alt (alanina aminotransferase)|u/l": "21 – 102",
  "fosforo|mg/dl": "2,9 – 5,3",
  "proteina total|g/dl": "5,4 – 7,5",
  "albumina|g/dl": "2,3 – 3,1",
  "globulina|g/dl": "2,3 – 5,2",
  "relacao a/g (albumina/globulina)|": "0,6 – 1,1",
};port type { ExameAnamnese } from "./anamnese";
import type { Especie } from "./ficha";

export type GrupoExames = "hemograma" | "bioquimico" | "outrosExames";
export type ExamesAnamnese = Record<GrupoExames, ExameAnamnese[]>;
export type ReferenciasExames = Record<"Cachorro" | "Gato", Record<string, string>>;
export const CHAVE_REFERENCIAS_EXAMES = "veterico-referencias-exames-v2";
export const GRUPOS_EXAMES: GrupoExames[] = ["hemograma", "bioquimico", "outrosExames"];

// Parâmetros do hemograma/bioquímico transcritos do laudo canino enviado em 22/09/2026.
// As referências continuam editáveis no app. Para Gato, permanecem em branco.
const PADRAO: ExamesAnamnese = {
  hemograma: [
    // Já existiam no app
    { id: "hematocrito", nome: "VG (Hematócrito)", unidade: "%", valor: "", referencia: "" },
    { id: "plaquetas", nome: "Plaquetas", unidade: "/µL", valor: "", referencia: "" },
    { id: "leucocitos", nome: "Leucócitos totais", unidade: "/µL", valor: "", referencia: "" },

    // Novos — ordem alfabética
    { id: "basofilo", nome: "Basófilo", unidade: "%", valor: "", referencia: "" },
    { id: "bastonete", nome: "Bastonete", unidade: "%", valor: "", referencia: "" },
    { id: "chcm", nome: "CHCM (Concentração de Hemoglobina Corpuscular Média)", unidade: "g/dL", valor: "", referencia: "" },
    { id: "eosinofilo", nome: "Eosinófilo", unidade: "%", valor: "", referencia: "" },
    { id: "eritrocitos", nome: "Eritrócitos", unidade: "milhões/µL", valor: "", referencia: "" },
    { id: "hcm", nome: "HCM (Hemoglobina Corpuscular Média)", unidade: "pg", valor: "", referencia: "" },
    { id: "hemoglobina", nome: "Hemoglobina", unidade: "g/dL", valor: "", referencia: "" },
    { id: "leucocitos-corrigido", nome: "Leucócitos corrigido", unidade: "/µL", valor: "", referencia: "" },
    { id: "linfocito", nome: "Linfócito", unidade: "%", valor: "", referencia: "" },
    { id: "metamielocito", nome: "Metamielócito", unidade: "%", valor: "", referencia: "" },
    { id: "monocito", nome: "Monócito", unidade: "%", valor: "", referencia: "" },
    { id: "rdw-cv", nome: "RDW (Variação do tamanho das hemácias)", unidade: "%", valor: "", referencia: "" },
    { id: "segmentado", nome: "Segmentado", unidade: "%", valor: "", referencia: "" },
    { id: "vcm", nome: "VCM (Volume Corpuscular Médio)", unidade: "fL", valor: "", referencia: "" },
  ],
  bioquimico: [
    // Já existiam no app
    { id: "creatinina", nome: "Creatinina", unidade: "mg/dL", valor: "", referencia: "" },
    { id: "ureia", nome: "Uréia", unidade: "mg/dL", valor: "", referencia: "" },
    { id: "tgp", nome: "TGP/ALT (Alanina aminotransferase)", unidade: "U/L", valor: "", referencia: "" },

    // Novos — ordem alfabética
    { id: "albumina", nome: "Albumina", unidade: "g/dL", valor: "", referencia: "" },
    { id: "fosforo", nome: "Fósforo", unidade: "mg/dL", valor: "", referencia: "" },
    { id: "globulina", nome: "Globulina", unidade: "g/dL", valor: "", referencia: "" },
    { id: "proteina-total", nome: "Proteína total", unidade: "g/dL", valor: "", referencia: "" },
    { id: "relacao-ag", nome: "Relação A/G (Albumina/Globulina)", unidade: "", valor: "", referencia: "" },
  ],
  outrosExames: [],
};

const REFERENCIAS_CACHORRO_PADRAO: Record<string, string> = {
  "eritrocitos|milhoes/µl": "5,50 – 8,50",
  "hemoglobina|g/dl": "12,00 – 18,00",
  "hematocrito|%": "37,00 – 55,00",
  "v.c.m.|fl": "60,00 – 77,00",
  "h.c.m.|pg": "19,50 – 24,50",
  "c.h.c.m.|g/dl": "30,00 – 36,00",
  "rdw-cv|%": "12,00 – 15,00",
  "leucocitos totais|/µl": "6000 – 17000",
  "leucocitos corrigido|/µl": "6000 – 17000",
  "metamielocito|%": "0 – 1",
  "bastonete|%": "0 – 2",
  "segmentado|%": "50 – 68",
  "eosinofilo|%": "2 – 7",
  "linfocito|%": "17 – 28",
  "monocito|%": "3 – 8",
  "basofilo|%": "0",
  "plaquetas|mil/µl": "150 – 500",
  "ureia|mg/dl": "20 – 55",
  "creatinina|mg/dl": "0,5 – 1,5",
  "tgp|u/l": "21 – 102",
  "fosforo|mg/dl": "2,9 – 5,3",
  "proteina total|g/dl": "5,4 – 7,5",
  "albumina|g/dl": "2,3 – 3,1",
  "globulina|g/dl": "2,3 – 5,2",
  "relacao albumina/globulina|": "0,6 – 1,1",
};

function normalizar(texto: string) {
  return texto.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function nomeChave(nome: string) {
  const chave = normalizar(nome);
  return ["vg", "hematocrito", "hematocrito (vg)"].includes(chave) ? "hematocrito" : chave;
}

function chaveExame(exame: Pick<ExameAnamnese, "nome" | "unidade">) {
  return `${nomeChave(exame.nome)}|${normalizar(exame.unidade ?? "")}`;
}

export function referenciasVazias(): ReferenciasExames {
  return { Cachorro: { ...REFERENCIAS_CACHORRO_PADRAO }, Gato: {} };
}

export function criarExamesPadrao(): ExamesAnamnese {
  return {
    hemograma: PADRAO.hemograma.map((x) => ({ ...x })),
    bioquimico: PADRAO.bioquimico.map((x) => ({ ...x })),
    outrosExames: [],
  };
}

/** Enriquecer fichas antigas não altera valores, nomes ou referências registrados. */
export function normalizarExames(exames: Partial<ExamesAnamnese>): ExamesAnamnese {
  const grupo = (nome: GrupoExames) => (exames[nome] ?? PADRAO[nome]).map((exame) => {
    const padrao = PADRAO[nome].find((x) => nomeChave(x.nome) === nomeChave(exame.nome));
    return {
      ...exame,
      unidade: exame.unidade ?? padrao?.unidade ?? "",
      personalizado: exame.personalizado ?? !padrao,
    };
  });
  return { hemograma: grupo("hemograma"), bioquimico: grupo("bioquimico"), outrosExames: grupo("outrosExames") };
}

function mapaValido(bruto: unknown): Record<string, string> {
  if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) return {};
  return Object.fromEntries(Object.entries(bruto).filter(([chave, valor]) =>
    !["__proto__", "constructor", "prototype"].includes(chave) && typeof valor === "string",
  ));
}

export function carregarReferenciasExames(): ReferenciasExames {
  try {
    if (typeof window === "undefined") return referenciasVazias();
    const bruto: unknown = JSON.parse(window.localStorage.getItem(CHAVE_REFERENCIAS_EXAMES) ?? "{}");
    if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) return referenciasVazias();
    const objeto = bruto as Record<string, unknown>;
    return {
      Cachorro: { ...REFERENCIAS_CACHORRO_PADRAO, ...mapaValido(objeto["Cachorro"]) },
      Gato: mapaValido(objeto["Gato"]),
    };
  } catch {
    return referenciasVazias();
  }
}

export function salvarReferenciasExames(referencias: ReferenciasExames): boolean {
  try {
    if (typeof window === "undefined") return false;
    window.localStorage.setItem(CHAVE_REFERENCIAS_EXAMES, JSON.stringify(referencias));
    return true;
  } catch {
    return false;
  }
}

export function referenciaCadastrada(exame: ExameAnamnese, especie: Especie, referencias: ReferenciasExames): string {
  if (!especie) return "";
  const mapa = referencias[especie];
  const chave = chaveExame(exame);
  if (Object.hasOwn(mapa, chave)) return mapa[chave] ?? "";
  // Compatibilidade com cadastros v2 antigos, que usavam somente o nome.
  const nomes = nomeChave(exame.nome) === "hematocrito"
    ? [exame.nome.trim(), "VG", "Hematócrito", "Hematócrito (VG)"] : [exame.nome.trim()];
  const padrao = [...PADRAO.hemograma, ...PADRAO.bioquimico].find((x) => nomeChave(x.nome) === nomeChave(exame.nome));
  const unidadeCompativel = !exame.unidade || (padrao && normalizar(exame.unidade) === normalizar(padrao.unidade ?? ""));
  if (unidadeCompativel) {
    for (const nome of nomes) if (Object.hasOwn(mapa, nome)) return mapa[nome] ?? "";
  }
  return "";
}

/** A ficha salva mantém a referência usada naquele exame, mesmo após editar o cadastro. */
export function referenciaDoExame(exame: ExameAnamnese, especie: Especie, referencias: ReferenciasExames): string {
  if (exame.referenciaEspecie !== undefined) {
    if (exame.referenciaEspecie === especie) return exame.referencia;
    return referenciaCadastrada(exame, especie, referencias);
  }
  return exame.referencia || referenciaCadastrada(exame, especie, referencias);
}

export function atualizarReferenciaExame(referencias: ReferenciasExames, especie: Especie, exame: ExameAnamnese): ReferenciasExames {
  if (!especie || !exame.nome.trim()) return referencias;
  return { ...referencias, [especie]: { ...referencias[especie], [chaveExame(exame)]: exame.referencia } };
}

export function prepararExamesParaSalvar(exames: Partial<ExamesAnamnese>, especie: Especie, referencias: ReferenciasExames): ExamesAnamnese {
  const listas = normalizarExames(exames);
  const preparar = (grupo: GrupoExames) => listas[grupo].map((exame) => ({
    ...exame, referencia: referenciaDoExame(exame, especie, referencias), referenciaEspecie: especie,
  }));
  return { hemograma: preparar("hemograma"), bioquimico: preparar("bioquimico"), outrosExames: preparar("outrosExames") };
}

export function trocarEspecieDosExames(exames: Partial<ExamesAnamnese>, especie: Especie, referencias: ReferenciasExames): ExamesAnamnese {
  const listas = normalizarExames(exames);
  const trocar = (grupo: GrupoExames) => listas[grupo].map((exame) => ({
    ...exame, referencia: referenciaCadastrada(exame, especie, referencias), referenciaEspecie: especie,
  }));
  return { hemograma: trocar("hemograma"), bioquimico: trocar("bioquimico"), outrosExames: trocar("outrosExames") };
}

/** Texto livre permanece texto: vazio, desigualdades e laudos não viram zero. */
export function numeroExame(texto: string): number | null {
  const limpo = texto.trim();
  if (!/^[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(limpo)) return null;
  const valor = Number(limpo.replace(",", "."));
  return Number.isFinite(valor) ? valor : null;
}

export type SituacaoExame = "neutro" | "dentro" | "abaixo" | "acima";

/** Só compara intervalos explícitos e válidos, nunca números soltos em um laudo. */
export function avaliarExame(valor: string, referencia: string): SituacaoExame {
  const atual = numeroExame(valor);
  if (atual === null) return "neutro";
  const numero = "([+-]?(?:\\d+(?:[.,]\\d+)?|[.,]\\d+))";
  const faixa = referencia.match(new RegExp(`^\\s*${numero}\\s*(?:–|—|-|a|até)\\s*${numero}\\s*$`, "i"));
  if (faixa) {
    const minimo = numeroExame(faixa[1] ?? "");
    const maximo = numeroExame(faixa[2] ?? "");
    if (minimo === null || maximo === null || minimo > maximo) return "neutro";
    return atual < minimo ? "abaixo" : atual > maximo ? "acima" : "dentro";
  }
  const limite = referencia.match(new RegExp(`^\\s*(<=|>=|<|>|≤|≥)\\s*${numero}\\s*$`));
  if (!limite) return "neutro";
  const n = numeroExame(limite[2] ?? "");
  if (n === null) return "neutro";
  switch (limite[1]) {
    case "<": return atual < n ? "dentro" : "acima";
    case "<=": case "≤": return atual <= n ? "dentro" : "acima";
    case ">": return atual > n ? "dentro" : "abaixo";
    case ">=": case "≥": return atual >= n ? "dentro" : "abaixo";
    default: return "neutro";
  }
}
