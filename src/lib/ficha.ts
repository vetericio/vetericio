export type Registro = {
  id: string;
  animal: string;
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
  const nome = r.animal.trim() || "Sem nome";
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

