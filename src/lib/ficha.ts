export type Especie = "Cachorro" | "Gato" | "";

export type Registro = {
  id: string;
  animal: string;
  especie?: Especie;
  criadoEm?: string;
  alimentacao: string;
  comportamento: string;
  fezes: string;
  mucosas: string;
  urina: string;
  vomito: string;
  temperatura: string;
  fc: string;
  fr: string;
  pas: string;
  glicemia: string;
  observacoes: string;
};

export const ESPECIES: Especie[] = ["Cachorro", "Gato"];

export type ChaveNumerica = "temperatura" | "fc" | "fr" | "pas" | "glicemia";

/** Faixas de referência por espécie. */
export const FAIXAS: Record<"Cachorro" | "Gato", Record<ChaveNumerica, [number, number]>> = {
  Cachorro: {
    temperatura: [37.5, 39.5],
    fc: [60, 180],
    fr: [18, 34],
    pas: [110, 160],
    glicemia: [70, 120],
  },
  Gato: {
    temperatura: [37.5, 39.5],
    fc: [140, 220],
    fr: [20, 30],
    pas: [90, 170],
    glicemia: [80, 150],
  },
};

export function faixaDe(especie: Especie | undefined, chave: ChaveNumerica) {
  if (especie === "Cachorro" || especie === "Gato") return FAIXAS[especie][chave];
  return null;
}

const TERMOS: Record<ChaveNumerica, { abaixo: string; acima: string }> = {
  temperatura: { abaixo: "hipotermia", acima: "hipertermia" },
  fc: { abaixo: "bradicardia", acima: "taquicardia" },
  fr: { abaixo: "bradipneia", acima: "taquipneia" },
  pas: { abaixo: "hipotensão", acima: "hipertensão" },
  glicemia: { abaixo: "hipoglicemia", acima: "hiperglicemia" },
};

export const ROTULOS_NUMERICOS: Record<ChaveNumerica, { rotulo: string; unidade: string }> = {
  temperatura: { rotulo: "Temperatura", unidade: "°C" },
  fc: { rotulo: "FC", unidade: "bpm" },
  fr: { rotulo: "FR", unidade: "mpm" },
  pas: { rotulo: "PAS", unidade: "mmHg" },
  glicemia: { rotulo: "Glicemia", unidade: "mg/dL" },
};

/** Diz se o valor está fora da faixa da espécie e qual o termo clínico. */
export function avaliarValor(
  chave: ChaveNumerica,
  valor: string,
  especie: Especie | undefined,
): { fora: boolean; termo: string } {
  const faixa = faixaDe(especie, chave);
  const n = paraNumero(valor);
  if (!faixa || Number.isNaN(n)) return { fora: false, termo: "" };
  if (chave === "fr" && n === 0) return { fora: true, termo: "apneia" };
  if (n < faixa[0]) return { fora: true, termo: TERMOS[chave].abaixo };
  if (n > faixa[1]) return { fora: true, termo: TERMOS[chave].acima };
  return { fora: false, termo: "" };
}

/** "Animal com hipotermia em 07/08/2026 às 09:05." */
export function frasePorTermo(termo: string, data = new Date()): string {
  const dois = (n: number) => String(n).padStart(2, "0");
  const dia = `${dois(data.getDate())}/${dois(data.getMonth() + 1)}/${data.getFullYear()}`;
  const hora = `${dois(data.getHours())}:${dois(data.getMinutes())}`;
  return `Animal com ${termo} em ${dia} às ${hora}.`;
}

/** Resumo das faixas da espécie, para referência rápida. */
export function resumoFaixas(especie: Especie | undefined): string {
  if (especie !== "Cachorro" && especie !== "Gato") return "";
  return (Object.keys(FAIXAS[especie]) as ChaveNumerica[])
    .map((chave) => {
      const [min, max] = FAIXAS[especie][chave];
      const { rotulo, unidade } = ROTULOS_NUMERICOS[chave];
      return `${rotulo} ${comVirgula(String(min))}–${comVirgula(String(max))} ${unidade}`;
    })
    .join(" · ");
}


/** Identidade do animal: nome normalizado + espécie. */
export function chaveAnimal(r: Pick<Registro, "animal" | "especie">): string {
  const nome = r.animal
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return `${nome}|${r.especie ?? ""}`;
}

/** Gera "Nome (2)", "Nome (3)"… conforme os nomes já existentes. */
export function proximoNomeDuplicado(nome: string, registros: Registro[]): string {
  const baseLimpa = nome.trim().replace(/\s*\(\d+\)$/, "");
  const usados = new Set(registros.map((r) => r.animal.trim().toLowerCase()));
  let n = 2;
  while (usados.has(`${baseLimpa} (${n})`.toLowerCase())) n += 1;
  return `${baseLimpa} (${n})`;
}


export const OPCOES = {
  alimentacao: [
    "Ração",
    "Patê",
    "Ração + patê",
    "Forçado",
    "Recuperação",
    "Jejum",
    "Não alimentou",
    "Líquido",
    "Sonda",
  ],
  comportamento: [
    "Responsivo",
    "Prostrado",
    "Ativo",
    "Neurológico",
    "Decúbito",
    "Agressivo",
    "Responsivo porém prostrado",
  ],
  fezes: ["Sim", "Não", "Pastoso", "Diarreia", "Melena"],
  mucosas: ["Normocoradas", "Hipocoradas", "Ictéricas", "Hiperêmicas", "Cianóticas"],
  urina: ["Sim", "Não", "Sonda", "Compressão"],
  vomito: ["Sim", "Não", "Sialorreia"],
} as const;

export const REGISTRO_VAZIO: Omit<Registro, "id"> = {
  animal: "",
  especie: "",
  alimentacao: "",

  comportamento: "",
  fezes: "",
  mucosas: "",
  urina: "",
  vomito: "",
  temperatura: "",
  fc: "",
  fr: "",
  pas: "",
  glicemia: "",
  observacoes: "",
};

/** Aceita "5,3" ou "5.3" e devolve número (NaN se inválido). */
export function paraNumero(valor: string): number {
  const limpo = valor.replace(",", ".").trim();
  if (!limpo) return NaN;
  return Number(limpo);
}

/** Exibe números com vírgula decimal. */
export function comVirgula(valor: string): string {
  return valor.replace(".", ",").trim();
}

function linha(rotulo: string, valor: string, unidade = ""): string | null {
  const v = valor.trim();
  if (!v) return null;
  const texto = unidade ? `${comVirgula(v)} ${unidade}` : comVirgula(v);
  return `${rotulo}: ${texto}.`;
}

export function formatarRegistro(r: Registro): string {
  const linhas = [
    linha("Alimentação", r.alimentacao),
    linha("Comportamento", r.comportamento),
    linha("Fezes", r.fezes),
    linha("Mucosas", r.mucosas),
    linha("Temperatura", r.temperatura, "°C"),
    linha("Urina", r.urina),
    linha("FC", r.fc, "bpm"),
    linha("FR", r.fr, "mpm"),
    linha("Vômito", r.vomito),
    linha("PAS", r.pas, "mmHg"),
    linha("Glicemia", r.glicemia, "mg/dL"),
  ].filter(Boolean) as string[];

  const obs = r.observacoes.trim();
  const base = r.animal.trim() || "Sem nome";
  const nome = r.especie ? `${base} (${r.especie})` : base;
  return [nome, ...linhas, `Observações: ${obs}`].join("\n");
}


export function formatarTodos(registros: Registro[]): string {
  return registros
    .map((r, i) => {
      const texto = formatarRegistro(r);
      const [nome, ...resto] = texto.split("\n");
      return [`${i + 1}. ${nome}`, ...resto].join("\n");
    })
    .join("\n\n");
}

const CHAVE = "veterico-registros-v1";
const CHAVE_PLANTOES = "veterico-plantoes-v1";

export const MAX_PLANTOES = 10;

export type Plantao = {
  id: string;
  data: string;
  turno: string;
  registros: Registro[];
  criadoEm: string;
};

export function rotuloPlantao(p: Plantao): string {
  const [ano, mes, dia] = p.data.split("-");
  const dataBr = ano && mes && dia ? `${dia}/${mes}/${ano}` : p.data;
  return p.turno ? `${dataBr} — ${p.turno}` : dataBr;
}

export function carregarRegistros(): Registro[] {
  return ler<Registro>(CHAVE);
}

export function salvarRegistros(registros: Registro[]) {
  escrever(CHAVE, registros);
}

export function carregarPlantoes(): Plantao[] {
  return ler<Plantao>(CHAVE_PLANTOES);
}

export function salvarPlantoes(plantoes: Plantao[]) {
  escrever(CHAVE_PLANTOES, plantoes);
}

function ler<T>(chave: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const bruto = window.localStorage.getItem(chave);
    if (!bruto) return [];
    const dados = JSON.parse(bruto);
    return Array.isArray(dados) ? (dados as T[]) : [];
  } catch {
    return [];
  }
}

function escrever(chave: string, valor: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    /* armazenamento indisponível */
  }
}

