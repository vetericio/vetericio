import type { Medicacao } from "./ficha";

/**
 * Leitura de texto em imagens (OCR) feita no próprio aparelho, sem internet.
 * Os arquivos do motor e o pacote de português ficam em /ocr e são guardados
 * no cache do navegador na primeira leitura.
 */

type Worker = { recognize: (imagem: Blob | File | string) => Promise<{ data: { text: string } }> };

let workerPromise: Promise<Worker> | null = null;

async function obterWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("por", 1, {
        workerPath: "/ocr/worker.min.js",
        corePath: "/ocr",
        langPath: "/ocr",
        gzip: true,
      });
      return worker as unknown as Worker;
    })().catch((erro) => {
      workerPromise = null;
      throw erro;
    });
  }
  return workerPromise;
}

/** Devolve o texto reconhecido na imagem. */
export async function lerTextoDaImagem(imagem: Blob | File): Promise<string> {
  const worker = await obterWorker();
  const { data } = await worker.recognize(imagem);
  return (data.text ?? "").trim();
}

const DOSE =
  /(\d+[.,]?\d*)\s*(ml|mg|mcg|µg|g|ui|u\.i\.|cp|comp(?:rimidos?|rimido)?|gts?|gotas?|caps?|%)\b/i;

const DURACAO =
  /((?:por\s+)?\d+\s*(?:dias?|semanas?|meses?|hs?|horas?)\b|\d+\s*x\s*(?:ao|por)?\s*dia|(?:sid|bid|tid|qid)\b|uso\s+cont[íi]nuo|dose\s+[úu]nica|a\s+cada\s+\d+\s*h(?:oras?)?)/i;

const LIXO = /^(receit|prescri|nome|paciente|tutor|crmv|dr\.?|dra\.?|clinic|cl[íi]nic|data|ass)/i;

/** Divide uma linha de texto em medicação, dose e duração. */
export function analisarLinha(linha: string): Medicacao | null {
  const limpo = linha
    .replace(/[|_]+/g, " ")
    .replace(/^[\s\-•*.\d)]+/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (limpo.length < 3) return null;
  if (LIXO.test(limpo)) return null;
  if (!/[a-zà-ú]{3}/i.test(limpo)) return null;

  const duracaoAchada = limpo.match(DURACAO);
  const duracao = duracaoAchada?.[0]?.trim() ?? "";
  const semDuracao = duracao ? limpo.replace(duracao, " ") : limpo;

  const doseAchada = semDuracao.match(DOSE);
  const dose = doseAchada?.[0]?.trim() ?? "";
  const semDose = dose ? semDuracao.replace(dose, " ") : semDuracao;

  const nome = semDose
    .replace(/[-–—,;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!nome && !dose) return null;
  return { nome: nome || limpo, dose, duracao };
}

/** Interpreta o texto lido e devolve as medicações sugeridas. */
export function analisarMedicacoes(texto: string): Medicacao[] {
  return texto
    .split(/\r?\n/)
    .map((l) => analisarLinha(l))
    .filter((m): m is Medicacao => Boolean(m));
}
