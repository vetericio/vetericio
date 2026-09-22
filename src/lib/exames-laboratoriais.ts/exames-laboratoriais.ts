import type { ExameAnamnese } from "./anamnese";
import type { Especie } from "./ficha";

export type GrupoExames = "hemograma" | "bioquimico" | "outrosExames";
export type ExamesAnamnese = Record<GrupoExames, ExameAnamnese[]>;
export type ReferenciasExames = Record<"Cachorro" | "Gato", Record<string, string>>;
export const CHAVE_REFERENCIAS_EXAMES = "veterico-referencias-exames-v2";
export const GRUPOS_EXAMES: GrupoExames[] = ["hemograma", "bioquimico", "outrosExames"];

// A imagem é uma referência de layout, não uma fonte de intervalos clínicos.
// Os intervalos são cadastrados pelo profissional, com a unidade do laboratório.
const PADRAO: ExamesAnamnese = {
  hemograma: [
    { id: "hematocrito", nome: "Hematócrito (VG)", unidade: "%", valor: "", referencia: "" },
    { id: "plaquetas", nome: "Plaquetas", unidade: "mil/µL", valor: "", referencia: "" },
    { id: "leucocitos", nome: "Leucócitos", unidade: "mil/µL", valor: "", referencia: "" },
  ],
  bioquimico: [
    { id: "creatinina", nome: "Creatinina", unidade: "mg/dL", valor: "", referencia: "" },
    { id: "ureia", nome: "Uréia", unidade: "mg/dL", valor: "", referencia: "" },
    { id: "tgp", nome: "TGP", unidade: "U/L", valor: "", referencia: "" },
  ],
  outrosExames: [],
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
  return { Cachorro: {}, Gato: {} };
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
    return { Cachorro: mapaValido(objeto["Cachorro"]), Gato: mapaValido(objeto["Gato"]) };
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
