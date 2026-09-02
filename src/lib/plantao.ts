export type Turno = "diurno" | "noturno";

export type PlantaoAtual = {
  /** Dia do plantão no formato AAAA-MM-DD (pode ser escolhido manualmente). */
  dia: string;
  turno: Turno;
  /** Dia do aparelho em que a escolha foi feita (AAAA-MM-DD). */
  escolhidoEm?: string;
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

/** dd/mm/aaaa */
function longa(data: Date): string {
  const dois = (n: number) => String(n).padStart(2, "0");
  return `${dois(data.getDate())}/${dois(data.getMonth() + 1)}/${data.getFullYear()}`;
}

/**
 * Diurno: "Plantão diurno - 10 de agosto de 2026"
 * Noturno: "Plantão noturno - 08/08/26 (noite) - 09/08/2026 (manhã)"
 */
export function rotuloPlantaoPdf(p: PlantaoAtual | null): string {
  if (!p) return "";
  return rotuloPlantaoPdfDe(p.dia, p.turno);
}

/** Igual ao anterior, a partir de um dia salvo (AAAA-MM-DD) e turno em texto. */
export function rotuloPlantaoPdfDe(dia: string, turno: string): string {
  const inicio = daDia(dia);
  const t = turno.trim().toLowerCase();
  if (t === "noturno") {
    const fim = new Date(inicio);
    fim.setDate(fim.getDate() + 1);
    return `Plantão noturno - ${curta(inicio)} (noite) - ${longa(fim)} (manhã)`;
  }
  const data = dataPorExtenso(inicio);
  return t ? `Plantão ${t} - ${data}` : data;
}

/** "Plantão noturno 08.08.26.pdf" (nome do arquivo exportado). */
export function nomeArquivoPdf(dia: string, turno?: string): string {
  const data = daDia(dia);
  const dois = (n: number) => String(n).padStart(2, "0");
  const curtaPontos = `${dois(data.getDate())}.${dois(data.getMonth() + 1)}.${String(
    data.getFullYear(),
  ).slice(-2)}`;
  const t = (turno ?? "").trim();
  return t ? `Plantão ${t} ${curtaPontos}.pdf` : `Plantão ${curtaPontos}.pdf`;
}

/**
 * O que fica guardado na chave do plantão: ou o plantão ativo, ou a marca de
 * plantão finalizado. A marca é persistente para que recarregar o app (ou
 * restaurar um backup) nunca reabra um plantão já finalizado.
 */
export type PlantaoSalvo = PlantaoAtual | { finalizadoEm: string };

export function plantaoFinalizado(bruto: unknown): boolean {
  return (
    !!bruto &&
    typeof bruto === "object" &&
    typeof (bruto as { finalizadoEm?: unknown }).finalizadoEm === "string"
  );
}

function valido(dados: unknown): PlantaoAtual | null {
  const d = dados as PlantaoAtual | null;
  if (!d?.dia || typeof d.dia !== "string") return null;
  if (d.turno !== "diurno" && d.turno !== "noturno") return null;
  return d;
}

export function carregarPlantaoAtual(): PlantaoAtual | null {
  if (typeof window === "undefined") return null;
  try {
    const bruto = window.localStorage.getItem(CHAVE);
    if (!bruto) return null;
    const dados: unknown = JSON.parse(bruto);
    // Plantão finalizado nunca volta a ser lido como ativo.
    if (plantaoFinalizado(dados)) return null;
    // O plantão vale até ser finalizado (ou alterado), mesmo virando o dia.
    return valido(dados);
  } catch {
    return null;
  }
}

export function salvarPlantaoAtual(p: PlantaoAtual | null) {
  if (typeof window === "undefined") return;
  try {
    const valor: PlantaoSalvo = p ?? { finalizadoEm: new Date().toISOString() };
    window.localStorage.setItem(CHAVE, JSON.stringify(valor));
  } catch {
    /* armazenamento indisponível */
  }
}

