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

export function carregarRegistros(): Registro[] {
  if (typeof window === "undefined") return [];
  try {
    const bruto = window.localStorage.getItem(CHAVE);
    if (!bruto) return [];
    const dados = JSON.parse(bruto);
    return Array.isArray(dados) ? (dados as Registro[]) : [];
  } catch {
    return [];
  }
}

export function salvarRegistros(registros: Registro[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CHAVE, JSON.stringify(registros));
  } catch {
    /* armazenamento indisponível */
  }
}
