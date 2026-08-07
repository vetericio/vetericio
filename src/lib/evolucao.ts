import {
  OPCOES,
  carregarPlantoes,
  chaveAnimal,
  faixaDe,
  paraNumero,
  type ChaveNumerica,
  type Especie,
  type Registro,
} from "./ficha";

export type AnimalEvolucao = {
  chave: string;
  nome: string;
  especie: Especie;
  rotulo: string;
  registros: Registro[];
};

export type PontoNumerico = { rotuloX: string; valor: number };
export type SerieNumerica = {
  chave: ChaveNumerica;
  rotulo: string;
  unidade: string;
  pontos: PontoNumerico[];
  faixa: [number, number] | null;
};

export type PontoCategoria = { rotuloX: string; opcao: string };
export type SerieCategoria = {
  chave: keyof typeof OPCOES;
  rotulo: string;
  pontos: PontoCategoria[];
  opcoes: string[];
};

export const NUMERICOS: { chave: ChaveNumerica; rotulo: string; unidade: string }[] = [
  { chave: "temperatura", rotulo: "Temperatura", unidade: "°C" },
  { chave: "fc", rotulo: "FC", unidade: "bpm" },
  { chave: "fr", rotulo: "FR", unidade: "irpm" },
  { chave: "pas", rotulo: "PAS", unidade: "mmHg" },
  { chave: "glicemia", rotulo: "Glicemia", unidade: "mg/dL" },
];

export const CATEGORICOS: { chave: keyof typeof OPCOES; rotulo: string }[] = [
  { chave: "alimentacao", rotulo: "Alimentação" },
  { chave: "comportamento", rotulo: "Comportamento" },
  { chave: "fezes", rotulo: "Fezes" },
  { chave: "mucosas", rotulo: "Mucosas" },
  { chave: "urina", rotulo: "Urina" },
  { chave: "vomito", rotulo: "Vômito" },
];

function quando(r: Registro, indice: number): string {
  if (r.criadoEm) {
    const d = new Date(r.criadoEm);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
  }
  return `#${indice + 1}`;
}

function ordem(r: Registro): number {
  const t = r.criadoEm ? new Date(r.criadoEm).getTime() : NaN;
  return Number.isNaN(t) ? 0 : t;
}

/** Junta a lista atual com todos os plantões salvos e agrupa por animal. */
export function agruparAnimais(atuais: Registro[]): AnimalEvolucao[] {
  const dosPlantoes = carregarPlantoes().flatMap((p) => p.registros);
  const todos = [...dosPlantoes, ...atuais];

  const vistos = new Set<string>();
  const unicos = todos.filter((r) => {
    if (!r.animal.trim()) return false;
    if (vistos.has(r.id)) return false;
    vistos.add(r.id);
    return true;
  });

  const mapa = new Map<string, AnimalEvolucao>();
  for (const r of unicos) {
    const chave = chaveAnimal(r);
    const atual = mapa.get(chave);
    if (atual) {
      atual.registros.push(r);
      continue;
    }
    const nome = r.animal.trim();
    const especie = (r.especie ?? "") as Especie;
    mapa.set(chave, {
      chave,
      nome,
      especie,
      rotulo: especie ? `${nome} (${especie})` : nome,
      registros: [r],
    });
  }

  const animais = [...mapa.values()];
  for (const a of animais) a.registros.sort((x, y) => ordem(x) - ordem(y));
  animais.sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR"));
  return animais;
}

export function seriesNumericas(animal: AnimalEvolucao): SerieNumerica[] {
  return NUMERICOS.map(({ chave, rotulo, unidade }) => {
    const pontos: PontoNumerico[] = [];
    animal.registros.forEach((r, i) => {
      const n = paraNumero(r[chave]);
      if (Number.isFinite(n)) pontos.push({ rotuloX: quando(r, i), valor: n });
    });
    return { chave, rotulo, unidade, pontos, faixa: faixaDe(animal.especie, chave) };
  }).filter((s) => s.pontos.length > 0);
}

export function seriesCategoricas(animal: AnimalEvolucao): SerieCategoria[] {
  return CATEGORICOS.map(({ chave, rotulo }) => {
    const pontos: PontoCategoria[] = [];
    animal.registros.forEach((r, i) => {
      const v = (r[chave] ?? "").trim();
      if (v) pontos.push({ rotuloX: quando(r, i), opcao: v });
    });
    const opcoes = [...new Set(pontos.map((p) => p.opcao))].sort((a, b) => {
      const lista = OPCOES[chave] as readonly string[];
      return lista.indexOf(a) - lista.indexOf(b);
    });
    return { chave, rotulo, pontos, opcoes };
  }).filter((s) => s.pontos.length > 0);
}

/** Cor estável por opção, usando os tokens de gráfico do design system. */
export function corDaOpcao(chave: keyof typeof OPCOES, opcao: string): string {
  const lista = OPCOES[chave] as readonly string[];
  const idx = Math.max(0, lista.indexOf(opcao));
  return `var(--chart-${(idx % 5) + 1})`;
}
