/**
 * Medicamentos cadastrados pelo usuário + cálculo de dose.
 * O app NUNCA sugere, busca ou altera doses: apenas guarda o que foi digitado
 * e faz a matemática — e só faz a conta quando as unidades são compatíveis.
 */

export const CHAVE_MEDICAMENTOS = "veterico-medicamentos-v1";

export type Especie = "cao" | "gato";

/** Vias de administração, sempre nesta ordem. */
export const VIAS = [
  "IV",
  "IM",
  "SC",
  "VO",
  "SL",
  "ID",
  "IO",
  "IP",
  "IC",
  "IT",
  "IN",
  "OF",
  "OT",
  "TOP",
  "TD",
  "BUC",
  "RET",
  "VAG",
] as const;
export type Via = (typeof VIAS)[number];

/** Nome completo de cada via. */
export const NOME_VIA: Record<Via, string> = {
  IV: "intravenosa",
  IM: "intramuscular",
  SC: "subcutânea",
  VO: "via oral",
  SL: "sublingual",
  ID: "intradérmica",
  IO: "intraóssea",
  IP: "intraperitoneal",
  IC: "intracardíaca",
  IT: "intratraqueal",
  IN: "intranasal",
  OF: "Oftálmica",
  OT: "Otológica",
  TOP: "Tópica",
  TD: "Transdérmica",
  BUC: "Bucal",
  RET: "Retal",
  VAG: "Vaginal",
};

/** Rótulo curto mostrado nos cards. */
export const ROTULO_VIA: Record<Via, string> = {
  IV: "IV",
  IM: "IM",
  SC: "SC",
  VO: "VO",
  SL: "SL",
  ID: "ID",
  IO: "IO",
  IP: "IP",
  IC: "IC",
  IT: "IT",
  IN: "IN",
  OF: "Oftálmica",
  OT: "Otológica",
  TOP: "Tópica",
  TD: "Transdérmica",
  BUC: "Bucal",
  RET: "Retal",
  VAG: "Vaginal",
};

/** Vias que compartilham o ícone de seringa. */
export const VIAS_SERINGA: Via[] = ["IV", "IM", "SC"];

/** Lê as vias de um medicamento salvo antes deste campo existir (OF/OT antigos continuam válidos). */
export function viasDe(m: Medicamento): Via[] {
  const brutas = Array.isArray(m.vias) ? m.vias.map((v) => String(v).trim().toUpperCase()) : [];
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
  /** unidade da dose, ex.: "mg/kg", "UI/kg", "mcg/animal". Ausente = mg/kg (ou mg/animal). */
  unidade?: string;
  /** horas */
  intervalo: string;
  /** true = medicamento não pode ser ministrado nesta espécie */
  proibido?: boolean;
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
  const unidadeSalva = (d.unidade ?? "").trim();
  if (unidadeSalva) {
    return { min, max, porAnimal: /animal\s*$/i.test(unidadeSalva), unidade: unidadeSalva };
  }
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
  /** true = mesma dose para cão e gato (bloco único no cadastro) */
  doseUnificada?: boolean;
  teste?: boolean;
};

export const UNIDADES_CONCENTRACAO = [
  // massa por volume
  "mg/mL",
  "mg/5 mL",
  "mg/10 mL",
  "mg/100 mL",
  "mcg/mL",
  "mcg/5 mL",
  "mcg/10 mL",
  "mcg/100 mL",
  "g/mL",
  "g/5 mL",
  "g/10 mL",
  "g/100 mL",
  // massa por massa
  "mg/g",
  "mg/kg",
  "mcg/g",
  "mcg/kg",
  "g/g",
  "g/kg",
  // massa por unidade
  "mg/comprimido",
  "mg/cápsula",
  "mg/gota",
  "mcg/comprimido",
  "mcg/cápsula",
  "mcg/gota",
  "g/comprimido",
  "g/cápsula",
  // unidades internacionais
  "UI/mL",
  "UI/5 mL",
  "UI/10 mL",
  "UI/100 mL",
  "UI/g",
  "UI/kg",
  "UI/comprimido",
  "UI/cápsula",
  "UI/gota",
  // percentual
  "%",
] as const;

export const UNIDADES_DOSE = [
  "mg/kg",
  "mg/animal",
  "mcg/kg",
  "mcg/animal",
  "UI/kg",
  "UI/animal",
  "g/kg",
  "g/animal",
  "mL/kg",
  "mL/animal",
] as const;

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
    cao: { doseMin: "", doseMax: "", porAnimal: false, unidade: "mg/kg", intervalo: "" },
    gato: { doseMin: "", doseMax: "", porAnimal: false, unidade: "mg/kg", intervalo: "" },
    doseUnificada: true,
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

/* ---------- grandezas ---------- */

/** Tipo físico da quantidade: massa (mg), unidade internacional (UI) ou volume (mL). */
export type Grandeza = "massa" | "ui" | "volume";

/** Fator para a unidade base da grandeza: massa → mg, ui → UI, volume → mL. */
const NUMERADORES: Record<string, { grandeza: Grandeza; fator: number }> = {
  mg: { grandeza: "massa", fator: 1 },
  mcg: { grandeza: "massa", fator: 0.001 },
  µg: { grandeza: "massa", fator: 0.001 },
  ug: { grandeza: "massa", fator: 0.001 },
  g: { grandeza: "massa", fator: 1000 },
  ui: { grandeza: "ui", fator: 1 },
  ml: { grandeza: "volume", fator: 1 },
};

const ROTULO_GRANDEZA: Record<Grandeza, string> = {
  massa: "massa (mg)",
  ui: "unidades internacionais (UI)",
  volume: "volume (mL)",
};

/** Nome canônico da forma sólida/por unidade. */
function nomeForma(bruto: string): string {
  const b = bruto.trim().toLowerCase();
  if (b === "cp" || b === "comprimido" || b === "comprimidos") return "comprimido";
  if (b === "capsula" || b === "cápsula" || b === "capsulas" || b === "cápsulas") return "cápsula";
  if (b === "gota" || b === "gotas") return "gota";
  return b;
}

/* ---------- concentração ---------- */

export type FormaConcentracao = {
  /** quantos mg existem em 1 unidade de administração (compatibilidade) */
  mgPorUnidade: number;
  /** quanto da grandeza (mg, UI) existe em 1 unidade de administração */
  porUnidade: number;
  /** grandeza do numerador da concentração */
  grandeza: Grandeza;
  /** mL, g, comprimido, cápsula, gota */
  unidade: string;
};

/**
 * Interpreta valor + unidade da concentração.
 * Devolve null quando a apresentação não permite cálculo seguro.
 */
export function interpretarConcentracao(
  valor: string,
  unidade: string,
): FormaConcentracao | null {
  const n = numero(valor);
  if (n === null || n <= 0) return null;
  const u = unidade.trim().toLowerCase().replace(/\s+/g, " ");
  if (!u) return null;

  // Percentual: só faz sentido em apresentação líquida (1% = 10 mg/mL).
  if (u === "%" || u === "% p/v" || u === "%p/v") {
    return { mgPorUnidade: n * 10, porUnidade: n * 10, grandeza: "massa", unidade: "mL" };
  }

  const partes = u.match(/^([a-zµ]+)\s*\/\s*(.+)$/);
  if (!partes) return null;
  const num = NUMERADORES[partes[1] ?? ""];
  if (!num || num.grandeza === "volume") return null;
  const den = (partes[2] ?? "").trim();

  // por volume: mL, 5 mL, 10 mL, 100 mL
  const porVolume = den.match(/^([\d.,]*)\s*ml$/);
  if (porVolume) {
    const divisor = numero(porVolume[1] ?? "") ?? 1;
    if (divisor <= 0) return null;
    const porUnidade = (n * num.fator) / divisor;
    return {
      mgPorUnidade: num.grandeza === "massa" ? porUnidade : 0,
      porUnidade,
      grandeza: num.grandeza,
      unidade: "mL",
    };
  }

  // por massa: g ou kg → resultado sai em gramas
  if (den === "g" || den === "kg") {
    const porGrama = den === "kg" ? (n * num.fator) / 1000 : n * num.fator;
    return {
      mgPorUnidade: num.grandeza === "massa" ? porGrama : 0,
      porUnidade: porGrama,
      grandeza: num.grandeza,
      unidade: "g",
    };
  }

  // por unidade: comprimido, cápsula, gota
  const forma = nomeForma(den);
  if (forma === "comprimido" || forma === "cápsula" || forma === "gota") {
    const porUnidade = n * num.fator;
    return {
      mgPorUnidade: num.grandeza === "massa" ? porUnidade : 0,
      porUnidade,
      grandeza: num.grandeza,
      unidade: forma,
    };
  }

  return null;
}

/* ---------- unidade da dose ---------- */

export type FormaDose = {
  /** grandeza da dose */
  grandeza: Grandeza;
  /** fator para a unidade base (mg, UI, mL) */
  fator: number;
  /** rótulo do numerador como foi digitado, ex.: "mcg" */
  numerador: string;
  /** true = dose fixa por animal */
  porAnimal: boolean;
};

/** Interpreta "mg/kg", "UI/animal", "mL/kg"... Devolve null se não reconhecer. */
export function interpretarUnidadeDose(unidade: string): FormaDose | null {
  const u = unidade.trim().toLowerCase().replace(/\s+/g, "");
  const partes = u.match(/^([a-zµ]+)\/(kg|animal)$/);
  if (!partes) return null;
  const chave = partes[1] ?? "";
  const num = NUMERADORES[chave];
  if (!num) return null;
  const rotulo = chave === "ui" ? "UI" : chave === "ml" ? "mL" : chave;
  return {
    grandeza: num.grandeza,
    fator: num.fator,
    numerador: rotulo,
    porAnimal: partes[2] === "animal",
  };
}

export const AVISO_SEM_CALCULO =
  "Informação insuficiente para calcular o volume. Confira a concentração e a unidade informadas.";

export const AVISO_INCOMPATIVEL =
  "Não é possível calcular automaticamente com essas unidades. Confira a apresentação e a dose.";

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
  if (unidade === "mL" || unidade === "g") return unidade;
  if (valor === 1) return unidade;
  if (unidade === "gota") return "gotas";
  return `${unidade}s`;
}

function casas(unidade: string): number {
  return unidade === "gota" ? 0 : 2;
}

/**
 * peso (kg) × dose (por kg) = dose total
 * dose total ÷ concentração (por unidade) = quantidade a ministrar
 * Só divide quando as grandezas (massa / UI) coincidem.
 */
export function calcularDose(params: {
  peso: string;
  dose: string;
  concentracaoValor: string;
  concentracaoUnidade: string;
  unidadeDose?: string;
}): ResultadoDose {
  const peso = numero(params.peso);
  const dose = numero(params.dose);
  const formaDose = interpretarUnidadeDose(params.unidadeDose ?? "mg/kg");
  if (!formaDose) return { ok: false, motivo: AVISO_INCOMPATIVEL };
  if (!formaDose.porAnimal && (peso === null || peso <= 0))
    return { ok: false, motivo: "Informe o peso do animal." };
  if (dose === null || dose <= 0)
    return { ok: false, motivo: "Nenhuma dose cadastrada para esta espécie." };

  const fator = formaDose.porAnimal ? 1 : (peso as number);
  const doseTotal = dose * fator;
  const doseTotalTexto = `${arredondar(doseTotal, 2)} ${formaDose.numerador}`;
  const contaDose = `${arredondar(fator, 3)} × ${arredondar(dose, 3)} = ${doseTotalTexto}`;

  // Dose já em volume: nada a converter.
  if (formaDose.grandeza === "volume") {
    const volumeTexto = arredondar(doseTotal, 2);
    return {
      ok: true,
      doseTotal,
      doseTotalTexto,
      volume: doseTotal,
      volumeTexto,
      unidade: "mL",
      contaDose,
      contaVolume: `${volumeTexto} mL a ministrar`,
    };
  }

  const forma = interpretarConcentracao(params.concentracaoValor, params.concentracaoUnidade);
  if (!forma) return { ok: false, motivo: AVISO_SEM_CALCULO };
  if (forma.grandeza !== formaDose.grandeza) return { ok: false, motivo: AVISO_INCOMPATIVEL };

  const volume = (doseTotal * formaDose.fator) / forma.porUnidade;
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
    contaVolume: `${arredondar(doseTotal * formaDose.fator, 3)} ÷ ${arredondar(forma.porUnidade, 3)} = ${volumeTexto} ${unidade}`,
  };
}

/** true quando o cadastro marcou a espécie como proibida. */
export function especieBloqueada(m: Medicamento, especie: Especie): boolean {
  if (m.doseUnificada) return false;
  return doseDaEspecie(m, especie).proibido === true;
}

export const NOME_ESPECIE: Record<Especie, string> = { cao: "cão", gato: "gato" };

export function doseDaEspecie(m: Medicamento, especie: Especie): DoseEspecie {
  return especie === "cao" ? m.cao : m.gato;
}

/* ---------- formatação de quantidade ---------- */

/** Líquidos: 2 casas (0,28 mL); abaixo de 0,1 usa 3 casas (0,125 mL). */
export function formatarVolume(valor: number): string {
  return arredondar(valor, valor > 0 && valor < 0.1 ? 3 : 2);
}

const FRACOES: { valor: number; texto: string }[] = [
  { valor: 0, texto: "" },
  { valor: 1 / 4, texto: "¼" },
  { valor: 1 / 3, texto: "⅓" },
  { valor: 1 / 2, texto: "½" },
  { valor: 2 / 3, texto: "⅔" },
  { valor: 3 / 4, texto: "¾" },
];

/**
 * Converte 0,56 comprimido em "½", 1,3 em "1⅓" etc.
 * Nunca devolve decimais: comprimido é administrado em fração prática.
 */
export function fracaoComprimido(valor: number): string {
  if (valor <= 0) return "0";
  const inteiro = Math.floor(valor);
  const resto = valor - inteiro;
  let melhor = FRACOES[0]!;
  for (const f of FRACOES) {
    if (Math.abs(resto - f.valor) < Math.abs(resto - melhor.valor)) melhor = f;
  }
  // Resto muito próximo de 1: sobe para o inteiro seguinte.
  if (Math.abs(resto - 1) < Math.abs(resto - melhor.valor)) return String(inteiro + 1);
  if (inteiro === 0) return melhor.texto || "¼";
  return `${inteiro}${melhor.texto}`;
}

/** true quando a apresentação é sólida (comprimido/cápsula) e usa fração. */
export function usaFracao(unidade: string): boolean {
  return unidade === "comprimido" || unidade === "cápsula";
}

/** Texto da quantidade a ministrar, já no formato certo para a forma. */
export function textoQuantidade(valor: number, unidade: string): string {
  if (usaFracao(unidade)) return fracaoComprimido(valor);
  if (unidade === "gota") return arredondar(valor, 0);
  return formatarVolume(valor);
}

/* ---------- cálculo com faixa (mínima/máxima) ---------- */

export type ResultadoFaixa =
  | {
      ok: true;
      /** ex.: "72 – 90 mg" */
      doseTexto: string;
      /** ex.: "20 – 25 mg/kg" */
      referencia: string;
      /** ex.: "0,28 – 0,56" ou "½ – 1" (null quando não dá para converter) */
      volumeTexto: string | null;
      unidade: string | null;
      /** forma base: mL, g, comprimido, cápsula, gota */
      forma: string | null;
      /** valores numéricos da faixa de volume, para pré-preencher a quantidade */
      volMin: number | null;
      volMax: number | null;
      /** valor decimal exato, para conferência de comprimidos */
      exatoTexto: string | null;
      motivoVolume?: string;
    }
  | { ok: false; motivo: string };

/**
 * Calcula dose total e quantidade a ministrar para a faixa cadastrada.
 * A unidade da dose é comparada com a da concentração antes de qualquer divisão.
 */
export function calcularFaixaDose(params: {
  peso: string;
  dose: DoseEspecie;
  concentracaoValor: string;
  concentracaoUnidade: string;
}): ResultadoFaixa {
  const f = faixaDe(params.dose);
  if (params.dose.proibido === true)
    return { ok: false, motivo: "Não pode ser ministrado nesta espécie." };
  const min = numero(f.min);
  const max = numero(f.max);
  if (min === null || min <= 0)
    return { ok: false, motivo: "Nenhuma dose cadastrada para esta espécie." };

  const formaDose = interpretarUnidadeDose(f.unidade);
  if (!formaDose) return { ok: false, motivo: AVISO_INCOMPATIVEL };

  const peso = numero(params.peso);
  if (!formaDose.porAnimal && (peso === null || peso <= 0))
    return { ok: false, motivo: "Informe o peso do animal." };

  const fator = formaDose.porAnimal ? 1 : (peso as number);
  const totalMin = min * fator;
  const totalMax = max !== null && max > min ? max * fator : null;

  const doseTexto =
    totalMax !== null
      ? `${arredondar(totalMin, 2)} – ${arredondar(totalMax, 2)} ${formaDose.numerador}`
      : `${arredondar(totalMin, 2)} ${formaDose.numerador}`;

  const referencia = referenciaDose(params.dose);
  const semVolume = (motivoVolume: string): ResultadoFaixa => ({
    ok: true,
    doseTexto,
    referencia,
    volumeTexto: null,
    unidade: null,
    forma: null,
    volMin: null,
    volMax: null,
    exatoTexto: null,
    motivoVolume,
  });

  // Dose já em volume (mL/kg ou mL/animal): a própria dose é a quantidade.
  let formaUnidade: string;
  let volMin: number;
  let volMax: number | null;

  if (formaDose.grandeza === "volume") {
    formaUnidade = "mL";
    volMin = totalMin;
    volMax = totalMax;
  } else {
    const forma = interpretarConcentracao(params.concentracaoValor, params.concentracaoUnidade);
    if (!forma) return semVolume(AVISO_SEM_CALCULO);
    if (forma.grandeza !== formaDose.grandeza)
      return semVolume(
        `${AVISO_INCOMPATIVEL} A dose está em ${ROTULO_GRANDEZA[formaDose.grandeza]} e a apresentação em ${ROTULO_GRANDEZA[forma.grandeza]}.`,
      );
    formaUnidade = forma.unidade;
    volMin = (totalMin * formaDose.fator) / forma.porUnidade;
    volMax = totalMax !== null ? (totalMax * formaDose.fator) / forma.porUnidade : null;
  }

  const referenciaVolume = volMax ?? volMin;
  const parte = (v: number) => textoQuantidade(v, formaUnidade);
  const volumeTexto = volMax !== null ? `${parte(volMin)} – ${parte(volMax)}` : parte(volMin);
  const exatoTexto = usaFracao(formaUnidade)
    ? volMax !== null
      ? `${arredondar(volMin, 2)} – ${arredondar(volMax, 2)}`
      : arredondar(volMin, 2)
    : null;

  return {
    ok: true,
    doseTexto,
    referencia,
    volumeTexto,
    unidade: plural(formaUnidade, referenciaVolume),
    forma: formaUnidade,
    volMin,
    volMax,
    exatoTexto,
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
    cao: { doseMin: "3", doseMax: "5", porAnimal: false, unidade: "mg/kg", intervalo: "12" },
    gato: { doseMin: "2", doseMax: "", porAnimal: false, unidade: "mg/kg", intervalo: "24" },
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
    cao: { doseMin: "10", doseMax: "20", porAnimal: false, unidade: "mg/kg", intervalo: "8" },
    gato: { doseMin: "5", doseMax: "", porAnimal: false, unidade: "mg/kg", intervalo: "12" },
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
    cao: { doseMin: "1", doseMax: "", porAnimal: false, unidade: "mg/kg", intervalo: "24" },
    gato: { doseMin: "1", doseMax: "", porAnimal: false, unidade: "mg/kg", intervalo: "24" },
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
