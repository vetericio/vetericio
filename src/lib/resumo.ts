import {
  avaliarValor,
  comVirgula,
  type ChaveNumerica,
  type Registro,
} from "./ficha";

const NUMERICOS: ChaveNumerica[] = ["temperatura", "fc", "fr", "pas", "glicemia"];

function alimentacao(v: string): string {
  const t = v.trim();
  if (!t) return "";
  const mapa: Record<string, string> = {
    "Não alimentou": "não se alimentou",
    Jejum: "permaneceu em jejum",
    Forçado: "se alimentou de forma forçada",
    Sonda: "se alimentou por sonda",
    Líquido: "aceitou apenas alimento líquido",
    Recuperação: "se alimentou com ração de recuperação",
  };
  return mapa[t] ?? `se alimentou (${t.toLowerCase()})`;
}

function comportamento(v: string): string {
  const t = v.trim();
  if (!t) return "";
  const mapa: Record<string, string> = {
    "Responsivo porém prostrado": "estava responsivo, porém prostrado",
    Neurológico: "apresentou sinais neurológicos",
    Decúbito: "permaneceu em decúbito",
  };
  return mapa[t] ?? `estava ${t.toLowerCase()}`;
}

function fezes(v: string): string {
  const mapa: Record<string, string> = {
    Sim: "defecou",
    Não: "não defecou",
    Pastoso: "apresentou fezes pastosas",
    Diarreia: "apresentou diarreia",
    Melena: "apresentou melena",
  };
  return mapa[v.trim()] ?? "";
}

function urina(v: string): string {
  const mapa: Record<string, string> = {
    Sim: "urinou",
    Não: "não urinou",
    Sonda: "urinou por sonda",
    Compressão: "urinou por compressão vesical",
  };
  return mapa[v.trim()] ?? "";
}

function vomito(v: string): string {
  const mapa: Record<string, string> = {
    Sim: "vomitou",
    Não: "não vomitou",
    Sialorreia: "apresentou sialorreia",
  };
  return mapa[v.trim()] ?? "";
}

function mucosas(v: string): string {
  const t = v.trim();
  return t ? `mucosas ${t.toLowerCase()}` : "";
}

function primeiroValor(valor: string): string {
  return valor.split("/")[0]?.trim() ?? "";
}

function parametros(r: Registro): string {
  const preenchidos = NUMERICOS.filter((c) => r[c].trim());
  if (preenchidos.length === 0) return "";

  const alterados: string[] = [];
  for (const chave of preenchidos) {
    // Quando há dois valores ("32,5 / 37,9"), avalia o mais recente.
    const partes = r[chave]
      .split("/")
      .map((p) => p.trim())
      .filter(Boolean);
    const ultimo = partes[partes.length - 1] ?? primeiroValor(r[chave]);
    const { fora, termo } = avaliarValor(chave, ultimo, r.especie);
    if (fora && termo) alterados.push(`${termo} (${comVirgula(ultimo)})`);
  }

  if (alterados.length === 0) return "estava com parâmetros normais";
  return `apresentou ${juntar(alterados)}`;
}

function juntar(partes: string[]): string {
  if (partes.length === 0) return "";
  if (partes.length === 1) return partes[0]!;
  return `${partes.slice(0, -1).join(", ")} e ${partes[partes.length - 1]}`;
}

/** Resumo em linguagem natural gerado pelo próprio app (funciona offline). */
export function resumoRegistro(r: Registro): string {
  const partes = [
    alimentacao(r.alimentacao),
    comportamento(r.comportamento),
    fezes(r.fezes),
    urina(r.urina),
    vomito(r.vomito),
    mucosas(r.mucosas),
    parametros(r),
  ].filter(Boolean);

  if (partes.length === 0) return "";

  const nome = r.animal.trim() || "Animal";
  const frase = juntar(partes);
  return `${nome} ${frase}.`.replace(/\s+/g, " ");
}
