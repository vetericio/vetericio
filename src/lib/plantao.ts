export type Turno = "diurno" | "noturno";

export type PlantaoAtual = {
  /** Identidade estável para a sincronização entre aparelhos. */
  id: string;
  /** Dia do plantão no formato AAAA-MM-DD (pode ser escolhido manualmente). */
  dia: string;
  turno: Turno;
  /** Dia do aparelho em que a escolha foi feita (AAAA-MM-DD). */
  escolhidoEm?: string;
  abertoEm: string;
  atualizadoEm: string;
  finalizadoEm?: string;
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

export function carregarPlantaoAtual(): PlantaoAtual | null {
  if (typeof window === "undefined") return null;
  try {
    const bruto = window.localStorage.getItem(CHAVE);
    if (!bruto) return null;
    const dados = JSON.parse(bruto) as Partial<PlantaoAtual>;
    // O plantão vale até ser finalizado (ou alterado), mesmo virando o dia.
    if (!dados?.dia || typeof dados.dia !== "string") return null;
    if (dados.turno !== "diurno" && dados.turno !== "noturno") return null;
    if (dados.finalizadoEm) return null;
    const agora = new Date().toISOString();
    const normalizado: PlantaoAtual = {
      id: typeof dados.id === "string" && dados.id ? dados.id : crypto.randomUUID(),
      dia: dados.dia,
      turno: dados.turno,
      ...(typeof dados.escolhidoEm === "string" ? { escolhidoEm: dados.escolhidoEm } : {}),
      abertoEm: typeof dados.abertoEm === "string" ? dados.abertoEm : agora,
      atualizadoEm: typeof dados.atualizadoEm === "string" ? dados.atualizadoEm : agora,
    };
    if (!dados.id || !dados.abertoEm || !dados.atualizadoEm) salvarPlantaoAtual(normalizado);
    return normalizado;
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

/** Mantém um marcador de encerramento para um aparelho desatualizado não reabrir o plantão. */
export function finalizarPlantaoAtual(p: PlantaoAtual) {
  if (typeof window === "undefined") return;
  const agora = new Date().toISOString();
  window.localStorage.setItem(
    CHAVE,
    JSON.stringify({ ...p, atualizadoEm: agora, finalizadoEm: agora }),
  );
}
