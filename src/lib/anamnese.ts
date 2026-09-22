import type { Especie } from "./ficha";
import { criarExamesPadrao } from "./exames-laboratoriais";

export type Pendencia = { id: string; texto: string; feito: boolean };
export type ExameAnamnese = {
  id?: string;
  nome: string;
  unidade?: string;
  valor: string;
  referencia: string;
  referenciaEspecie?: Especie;
  personalizado?: boolean;
};

export type Anamnese = {
  id: string;
  animal: string;
  especie: Especie;
  /** Peso do animal em kg, informado na anamnese. */
  peso: string;
  queixa: string;
  relato: string;
  exames: string;
  /** Resultados laboratoriais estruturados. */
  hemograma?: ExameAnamnese[];
  bioquimico?: ExameAnamnese[];
  outrosExames?: ExameAnamnese[];
  pendencias: Pendencia[];
  /** Conduta / plano terapêutico (opcional, compacto). */
  conduta: string;
  /** Atenção para o próximo plantão (opcional). */
  atencao: string;
  atualizadoEm: string;
};

const CHAVE = "veterico-anamneses";

export const ANAMNESE_VAZIA: Omit<Anamnese, "id" | "atualizadoEm"> = {
  animal: "",
  especie: "",
  peso: "",
  queixa: "",
  relato: "",
  exames: "",
  ...criarExamesPadrao(),
  pendencias: [],
  conduta: "",
  atencao: "",
};

export function carregarAnamneses(): Anamnese[] {
  if (typeof window === "undefined") return [];
  try {
    const bruto = window.localStorage.getItem(CHAVE);
    if (!bruto) return [];
    const lista = JSON.parse(bruto);
    return Array.isArray(lista) ? (lista as Anamnese[]) : [];
  } catch {
    return [];
  }
}

export function salvarAnamneses(lista: Anamnese[]): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(CHAVE, JSON.stringify(lista));
    return true;
  } catch {
    return false;
  }
}

export function normalizarNome(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Anamneses cujo nome combina com o que está sendo digitado. */
export function sugerirAnamneses(lista: Anamnese[], termo: string, limite = 5): Anamnese[] {
  const t = normalizarNome(termo);
  if (!t) return [];
  return lista
    .filter((a) => a.animal.trim() && normalizarNome(a.animal).includes(t))
    .slice(0, limite);
}

export function emojiEspecie(especie: Especie): string {
  if (especie === "Cachorro") return "🐶";
  if (especie === "Gato") return "🐱";
  return "";
}

export function quandoCurto(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
