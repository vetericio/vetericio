export type Turno = "diurno" | "noturno";

export type PlantaoAtual = {
  /** Dia do aparelho no formato AAAA-MM-DD em que a escolha foi feita. */
  dia: string;
  turno: Turno;
};

const CHAVE = "veterico-plantao-v1";

export function diaDeHoje(data = new Date()): string {
  const dois = (n: number) => String(n).padStart(2, "0");
  return `${data.getFullYear()}-${dois(data.getMonth() + 1)}-${dois(data.getDate())}`;
}

/** 07/08/26 */
function curta(data: Date): string {
  const dois = (n: number) => String(n).padStart(2, "0");
  return `${dois(data.getDate())}/${dois(data.getMonth() + 1)}/${String(data.getFullYear()).slice(-2)}`;
}

function daDia(dia: string): Date {
  const [ano, mes, d] = dia.split("-").map(Number);
  return new Date(ano ?? 1970, (mes ?? 1) - 1, d ?? 1);
}

/**
 * "Plantão diurno: 07/08/26"
 * "Plantão noturno: 07/08/26 (noite) → 08/08/26 (manhã)"
 */
export function rotuloPlantaoAtual(p: PlantaoAtual | null): string {
  if (!p) return "";
  const inicio = daDia(p.dia);
  if (p.turno === "diurno") return `Plantão diurno: ${curta(inicio)}`;
  const fim = new Date(inicio);
  fim.setDate(fim.getDate() + 1);
  return `Plantão noturno: ${curta(inicio)} (noite) → ${curta(fim)} (manhã)`;
}

/** Data por extenso: "8 de agosto de 2026". */
export function dataPorExtenso(data: Date): string {
  return data.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
}

/** "Plantão diurno - 8 de agosto de 2026" (usado no PDF). */
export function rotuloPlantaoPdf(p: PlantaoAtual | null): string {
  if (!p) return "";
  return `Plantão ${p.turno} - ${dataPorExtenso(daDia(p.dia))}`;
}

/** Igual ao anterior, a partir de um dia salvo (AAAA-MM-DD) e turno em texto. */
export function rotuloPlantaoPdfDe(dia: string, turno: string): string {
  const data = dataPorExtenso(daDia(dia));
  const t = turno.trim();
  return t ? `Plantão ${t} - ${data}` : data;
}

export function carregarPlantaoAtual(): PlantaoAtual | null {
  if (typeof window === "undefined") return null;
  try {
    const bruto = window.localStorage.getItem(CHAVE);
    if (!bruto) return null;
    const dados = JSON.parse(bruto) as PlantaoAtual;
    if (dados?.dia !== diaDeHoje()) return null;
    if (dados.turno !== "diurno" && dados.turno !== "noturno") return null;
    return dados;
  } catch {
    return null;
  }
}

export function salvarPlantaoAtual(p: PlantaoAtual | null) {
  if (typeof window === "undefined") return;
  try {
    if (!p) window.localStorage.removeItem(CHAVE);
    else window.localStorage.setItem(CHAVE, JSON.stringify(p));
  } catch {
    /* armazenamento indisponível */
  }
}
