/**
 * Medicamentos cadastrados pelo usuário + cálculo de dose.
 * O app NUNCA sugere, busca ou altera doses: apenas guarda o que foi digitado
 * e faz a matemática.
 */

export const CHAVE_MEDICAMENTOS = "veterico-medicamentos-v1";

export type Especie = "cao" | "gato";

/** Vias de administração, sempre nesta ordem. */
export const VIAS = ["IV", "IM", "SC", "VO", "OF", "OT"] as const;
export type Via = (typeof VIAS)[number];

/** Lê as vias de um medicamento salvo antes deste campo existir. */
export function viasDe(m: Medicamento): Via[] {
  const brutas = Array.isArray(m.vias) ? m.vias : [];
  return VIAS.filter((v) => brutas.includes(v));
}

export type DoseEspecie = {
  /** Campo antigo (dose única). Mantido para ler cadastros anteriores. */
  dose?: string;
  /** dose mínima — texto livre para aceitar vírgula */
  doseMin?: string;
  /** dose máxima — opcional */
  doseMax?: string;
  /** true = dose fixa por animal (não multiplica pelo peso) */
  porAnimal?: boolean;
  /** horas */
  intervalo: string;
};

/** Lê a faixa de dose, tolerando cadastros antigos que só tinham `dose`. */
export function faixaDe(d: DoseEspecie): {
  min: string;
  max: string;
  porAnimal: boolean;
  unidade: string;
} {
  const min = (d.doseMin ?? d.dose ?? "").trim();
  const max = (d.doseMax ?? "").trim();
  const porAnimal = d.porAnimal === true;
  return { min, max, porAnimal, unidade: porAnimal ? "mg/animal" : "mg/kg" };
}

/** Texto da dose cadastrada, ex.: "20 – 25 mg/kg". */
export function referenciaDose(d: DoseEspecie): string {
  const f = faixaDe(d);
  if (!f.min && !f.max) return "";
  const valores = f.max && f.max !== f.min ? `${f.min} – ${f.max}` : f.min;
  return `${valores} ${f.unidade}`;
}


export type Medicamento = {
  id: string;
  nome: string;
  concentracaoValor: string;
  concentracaoUnidade: string;
  resumo: string;
  classificacao: string;
  vias: Via[];
  cao: DoseEspecie;
  gato: DoseEspecie;
  teste?: boolean;
};

export const UNIDADES_CONCENTRACAO = [
  "mg/mL",
  "mg/comprimido",
  "mg/cápsula",
  "mg/gota",
  "mg/10 mL",
  "%",
] as const;

export const UNIDADES_DOSE = ["mg/kg", "mL/kg", "UI/kg", "mcg/kg"] as const;

export function medicamentoVazio(): Medicamento {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `med-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    nome: "",
    concentracaoValor: "",
    concentracaoUnidade: "mg/mL",
    resumo: "",
    classificacao: "",
    vias: [],
    cao: { doseMin: "", doseMax: "", porAnimal: false, intervalo: "" },
    gato: { doseMin: "", doseMax: "", porAnimal: false, intervalo: "" },

  };
}

/* ---------- números ---------- */

export function numero(valor: string): number | null {
  const limpo = valor.replace(/\s/g, "").replace(",", ".");
  if (!limpo) return null;
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}

function arredondar(valor: number, casas: number): string {
  const fator = 10 ** casas;
  const n = Math.round(valor * fator) / fator;
  return String(n).replace(".", ",");
}

/* ---------- concentração ---------- */

export type FormaConcentracao = {
  /** quantos mg existem em 1 unidade de administração */
  mgPorUnidade: number;
  /** mL, comprimido, cápsula, gota */
  unidade: string;
};

/** Interpreta valor + unidade. Devolve null quando não dá para calcular com segurança. */
export function interpretarConcentracao(
  valor: string,
  unidade: string,
): FormaConcentracao | null {
  const n = numero(valor);
  if (n === null || n <= 0) return null;
  const u = unidade.trim().toLowerCase();

  if (!u) return null;
  if (u === "%") return { mgPorUnidade: n * 10, unidade: "mL" };

  // mg/10 mL, mg/5ml, mg/mL...
  const porVolume = u.match(/^mg\s*\/\s*([\d.,]*)\s*ml$/);
  if (porVolume) {
    const divisor = numero(porVolume[1] ?? "") ?? 1;
    if (divisor <= 0) return null;
    return { mgPorUnidade: n / divisor, unidade: "mL" };
  }

  const porForma = u.match(/^mg\s*\/\s*(comprimido|cápsula|capsula|gota|cp)$/);
  if (porForma) {
    const bruto = porForma[1] ?? "";
    const nome =
      bruto === "cp"
        ? "comprimido"
        : bruto === "capsula"
          ? "cápsula"
          : bruto;
    return { mgPorUnidade: n, unidade: nome };
  }

  return null;
}

export const AVISO_SEM_CALCULO =
  "Informação insuficiente para calcular o volume. Confira a concentração e a unidade informadas.";

/* ---------- cálculo ---------- */

export type ResultadoDose =
  | {
      ok: true;
      doseTotal: number;
      doseTotalTexto: string;
      volume: number;
      volumeTexto: string;
      unidade: string;
      contaDose: string;
      contaVolume: string;
    }
  | { ok: false; motivo: string };

function plural(unidade: string, valor: number): string {
  if (unidade === "mL") return "mL";
  if (valor === 1) return unidade;
  if (unidade === "gota") return "gotas";
  return `${unidade}s`;
}

function casas(unidade: string): number {
  return unidade === "gota" ? 0 : 2;
}

/**
 * peso (kg) × dose (mg/kg) = dose total (mg)
 * dose total (mg) ÷ concentração (mg/unidade) = volume
 */
export function calcularDose(params: {
  peso: string;
  dose: string;
  concentracaoValor: string;
  concentracaoUnidade: string;
}): ResultadoDose {
  const peso = numero(params.peso);
  const dose = numero(params.dose);
  if (peso === null || peso <= 0) return { ok: false, motivo: "Informe o peso do animal." };
  if (dose === null || dose <= 0)
    return { ok: false, motivo: "Nenhuma dose cadastrada para esta espécie." };

  const forma = interpretarConcentracao(params.concentracaoValor, params.concentracaoUnidade);
  const doseTotal = peso * dose;
  const doseTotalTexto = arredondar(doseTotal, 2);
  const contaDose = `${arredondar(peso, 3)} × ${arredondar(dose, 3)} = ${doseTotalTexto} mg`;

  if (!forma) return { ok: false, motivo: AVISO_SEM_CALCULO };

  const volume = doseTotal / forma.mgPorUnidade;
  const unidade = plural(forma.unidade, volume);
  const volumeTexto = arredondar(volume, casas(forma.unidade));
  return {
    ok: true,
    doseTotal,
    doseTotalTexto,
    volume,
    volumeTexto,
    unidade,
    contaDose,
    contaVolume: `${doseTotalTexto} ÷ ${arredondar(forma.mgPorUnidade, 3)} = ${volumeTexto} ${unidade}`,
  };
}

export function doseDaEspecie(m: Medicamento, especie: Especie): DoseEspecie {
  return especie === "cao" ? m.cao : m.gato;
}

/* ---------- cálculo com faixa (mínima/máxima) ---------- */

export type ResultadoFaixa =
  | {
      ok: true;
      /** ex.: "72 – 90 mg" */
      doseTexto: string;
      /** ex.: "20 – 25 mg/kg" */
      referencia: string;
      /** ex.: "0,14 – 0,18" (null quando não dá para converter) */
      volumeTexto: string | null;
      unidade: string | null;
      motivoVolume?: string;
    }
  | { ok: false; motivo: string };

/**
 * Calcula dose total e volume para a faixa cadastrada.
 * Em mg/animal a dose não é multiplicada pelo peso.
 */
export function calcularFaixaDose(params: {
  peso: string;
  dose: DoseEspecie;
  concentracaoValor: string;
  concentracaoUnidade: string;
}): ResultadoFaixa {
  const f = faixaDe(params.dose);
  const min = numero(f.min);
  const max = numero(f.max);
  if (min === null || min <= 0) return { ok: false, motivo: "Nenhuma dose cadastrada para esta espécie." };

  const peso = numero(params.peso);
  if (!f.porAnimal && (peso === null || peso <= 0))
    return { ok: false, motivo: "Informe o peso do animal." };

  const fator = f.porAnimal ? 1 : (peso as number);
  const totalMin = min * fator;
  const totalMax = max !== null && max > min ? max * fator : null;

  const doseTexto =
    totalMax !== null
      ? `${arredondar(totalMin, 2)} – ${arredondar(totalMax, 2)} mg`
      : `${arredondar(totalMin, 2)} mg`;

  const forma = interpretarConcentracao(params.concentracaoValor, params.concentracaoUnidade);
  if (!forma)
    return {
      ok: true,
      doseTexto,
      referencia: referenciaDose(params.dose),
      volumeTexto: null,
      unidade: null,
      motivoVolume: AVISO_SEM_CALCULO,
    };

  const volMin = totalMin / forma.mgPorUnidade;
  const volMax = totalMax !== null ? totalMax / forma.mgPorUnidade : null;
  const referenciaVolume = volMax ?? volMin;
  const volumeTexto =
    volMax !== null
      ? `${arredondar(volMin, casas(forma.unidade))} – ${arredondar(volMax, casas(forma.unidade))}`
      : arredondar(volMin, casas(forma.unidade));

  return {
    ok: true,
    doseTexto,
    referencia: referenciaDose(params.dose),
    volumeTexto,
    unidade: plural(forma.unidade, referenciaVolume),
  };
}


/* ---------- persistência ---------- */

const TESTE: Medicamento[] = [
  {
    id: "teste-a",
    nome: "Teste A (exemplo)",
    concentracaoValor: "50",
    concentracaoUnidade: "mg/mL",
    resumo: "Medicamento fictício apenas para testar o cálculo.",
    classificacao: "Dados de teste",
    vias: ["IV"],
    cao: { doseMin: "3", doseMax: "5", porAnimal: false, intervalo: "12" },
    gato: { doseMin: "2", doseMax: "", porAnimal: false, intervalo: "24" },
    teste: true,
  },
  {
    id: "teste-b",
    nome: "Teste B (exemplo)",
    concentracaoValor: "250",
    concentracaoUnidade: "mg/comprimido",
    resumo: "Medicamento fictício apenas para testar o cálculo.",
    classificacao: "Dados de teste",
    vias: ["VO"],
    cao: { doseMin: "10", doseMax: "20", porAnimal: false, intervalo: "8" },
    gato: { doseMin: "5", doseMax: "", porAnimal: false, intervalo: "12" },
    teste: true,
  },
  {
    id: "teste-c",
    nome: "Teste C (exemplo)",
    concentracaoValor: "40",
    concentracaoUnidade: "mg/10 mL",
    resumo: "Medicamento fictício apenas para testar o cálculo.",
    classificacao: "Dados de teste",
    vias: ["SC", "IM"],
    cao: { doseMin: "1", doseMax: "", porAnimal: false, intervalo: "24" },
    gato: { doseMin: "1", doseMax: "", porAnimal: false, intervalo: "24" },
    teste: true,
  },
];

export function medicamentosDeTeste(): Medicamento[] {
  return TESTE.map((m) => ({ ...m, vias: [...m.vias], cao: { ...m.cao }, gato: { ...m.gato } }));
}

export function carregarMedicamentos(): Medicamento[] {
  if (typeof window === "undefined") return [];
  try {
    const bruto = window.localStorage.getItem(CHAVE_MEDICAMENTOS);
    if (!bruto) return medicamentosDeTeste();
    const lido = JSON.parse(bruto);
    return Array.isArray(lido) ? (lido as Medicamento[]) : [];
  } catch {
    return [];
  }
}

export function salvarMedicamentos(lista: Medicamento[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CHAVE_MEDICAMENTOS, JSON.stringify(lista));
  } catch {
    /* armazenamento indisponível */
  }
}

export function ordenarMedicamentos(lista: Medicamento[]): Medicamento[] {
  return [...lista].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
