import type { Especie } from "./ficha";

export type Pendencia = { id: string; texto: string; feito: boolean };

export type Anamnese = {
  id: string;
  animal: string;
  especie: Especie;
  queixa: string;
  relato: string;
  exames: string;
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
  queixa: "",
  relato: "",
  exames: "",
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

export function salvarAnamneses(lista: Anamnese[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CHAVE, JSON.stringify(lista));
  } catch {
    /* espaço cheio: ignora */
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
