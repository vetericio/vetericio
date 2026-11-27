import { z } from "zod";
import {
  criarExamesPadrao,
  numeroExame,
  referenciaDoLaudoCatalogado,
} from "./exames-laboratoriais-catalogo";
import { diaNoFuso } from "./relatorios";

export const PaineisLab = ["bioquimico", "hemograma", "outros"] as const;
export type PainelLab = (typeof PaineisLab)[number];
export const PAINEIS_LAB = {
  bioquimico: "Bioquímico",
  hemograma: "Hemograma",
  outros: "Outro painel",
} as const;
export type EspecieLab = "Cachorro" | "Gato" | "Outra";
export type LinhaLab = {
  parametroId: string;
  nome: string;
  unidade: string;
  valor: string;
  referencia: string;
};
export type ExameLab = {
  id: string;
  consultaId: string | null;
  painel: PainelLab;
  especie: EspecieLab;
  data: string;
  hora: string;
  laboratorio: string;
  autor: string;
  observacoes: string;
  resultados: LinhaLab[];
  temPdf: boolean;
};
export type ReferenciaLab = Pick<LinhaLab, "parametroId" | "unidade" | "referencia">;
export const LABORATORIOS_ORIGEM = ["LabNet", "DiagVet"] as const;
export const normalizarLaboratorio = (texto: string) =>
  texto
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ");

const bio: [string, string, string][] = [
  ["ureia", "Ureia", "mg/dL"],
  ["creatinina", "Creatinina", "mg/dL"],
  ["ast", "AST (TGO)", "U/L"],
  ["tgp", "ALT (TGP)", "U/L"],
  ["fosfatase-alcalina", "Fosfatase alcalina", "U/L"],
  ["ggt", "GGT", "U/L"],
  ["proteina-total", "Proteínas totais", "g/dL"],
];
export function criarLinhasLab(painel: PainelLab): LinhaLab[] {
  const padroes = criarExamesPadrao();
  const linha = (parametroId: string, nome = "", unidade = ""): LinhaLab => ({
    parametroId,
    nome,
    unidade,
    valor: "",
    referencia: "",
  });
  if (painel === "outros") return [];
  if (painel === "hemograma")
    return padroes.hemograma.map(({ id, nome, unidade }) => linha(id, nome, unidade ?? ""));
  return [
    ...bio.map(([id, nome, unidade]) => linha(id, nome, unidade ?? "")),
    ...padroes.bioquimico
      .filter((p) => !bio.some(([id]) => id === p.id))
      .map(({ id, nome, unidade }) => linha(id, nome, unidade ?? "")),
  ];
}

export function especieLaboratorial(especie: string | null | undefined): EspecieLab {
  const valor = normalizarLaboratorio(especie || "");
  if (["cao", "cachorro", "canina", "canino", "canis lupus familiaris"].includes(valor))
    return "Cachorro";
  if (["gato", "felina", "felino", "felis catus"].includes(valor)) return "Gato";
  return "Outra";
}

// Só normaliza grafias equivalentes conhecidas. Nenhuma conversão numérica.
export function unidadeComparavel(texto: string) {
  const unidade = texto
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\s*\/\s*/g, "/")
    .replace(/[μµ]/g, "µ");
  if (/^(mg|g|mmol|µmol|[uU]|[uU][iI])\/[dµm]?[lL]$/.test(unidade)) return unidade.toLowerCase();
  if (/^\/(?:µl)$/i.test(unidade)) return unidade.toLowerCase();
  return unidade;
}
const chaveLinha = (p: Pick<LinhaLab, "parametroId" | "unidade">) =>
  JSON.stringify([p.parametroId, unidadeComparavel(p.unidade)]);

export function preencherReferenciasLab(
  linhas: LinhaLab[],
  referencias: ReferenciaLab[],
  especie: EspecieLab,
  laboratorio: string,
) {
  const mapa = new Map(referencias.map((r) => [chaveLinha(r), r.referencia]));
  return linhas.map((linha) => ({
    ...linha,
    referencia:
      mapa.get(chaveLinha(linha)) ??
      (especie === "Outra"
        ? ""
        : referenciaDoLaudoCatalogado(linha.parametroId, linha.unidade, especie, laboratorio)),
  }));
}

type PontoLab = {
  id: string;
  data: string;
  hora: string;
  laboratorio: string;
  valor: string;
  referencia: string;
  numerico: number | null;
};
export type SerieLab = {
  chave: string;
  painel: PainelLab;
  nome: string;
  unidade: string;
  pontos: PontoLab[];
};
export function seriesLaboratoriais(exames: ExameLab[]): SerieLab[] {
  const grupos = new Map<string, SerieLab>();
  for (const exame of exames)
    for (const linha of exame.resultados) {
      const unidade = unidadeComparavel(linha.unidade);
      const parametro = linha.parametroId.startsWith("personalizado-")
        ? "personalizado:" + normalizarLaboratorio(linha.nome)
        : linha.parametroId;
      const chave = JSON.stringify([exame.painel, parametro, unidade]);
      const serie = grupos.get(chave) || {
        chave,
        painel: exame.painel,
        nome: linha.nome,
        unidade: linha.unidade,
        pontos: [],
      };
      serie.pontos.push({
        id: exame.id,
        data: exame.data,
        hora: exame.hora,
        laboratorio: exame.laboratorio,
        valor: linha.valor,
        referencia: linha.referencia,
        // Unidade ausente não autoriza comparação entre exames distintos.
        // 1.000 é ambíguo na transcrição em pt-BR, não usá-lo no gráfico.
        numerico:
          unidade && !/^[+-]?\d{1,3}\.\d{3}$/.test(linha.valor.trim())
            ? numeroExame(linha.valor)
            : null,
      });
      grupos.set(chave, serie);
    }
  for (const { pontos } of grupos.values())
    pontos.sort((a, b) => (a.data + a.hora + a.id).localeCompare(b.data + b.hora + b.id));
  return [...grupos.values()].sort(
    (a, b) => a.nome.localeCompare(b.nome, "pt-BR") || a.unidade.localeCompare(b.unidade, "pt-BR"),
  );
}

const texto = (n: number) => z.string().trim().max(n);
export const acessoLabSchema = z.object({
  accessToken: z.string().min(20).max(16000),
  clinicaId: z.string().uuid(),
  animalId: z.string().uuid(),
});
const dataSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((dia) => {
    const tempo = new Date(dia + "T00:00:00Z");
    return (
      dia >= "2000-01-01" &&
      dia <= diaNoFuso(new Date().toISOString()) &&
      Number.isFinite(tempo.valueOf()) &&
      tempo.toISOString().slice(0, 10) === dia
    );
  }, "Informe uma data de exame válida, sem data futura.");
const baseLinhaSchema = z.object({
  parametroId: z
    .string()
    .max(80)
    .regex(/^[a-z0-9-]+$/),
  unidade: texto(35),
  referencia: texto(140),
});
const linhaSchema = baseLinhaSchema.extend({ nome: texto(120).min(1), valor: texto(100).min(1) });
export const salvarExameLabSchema = acessoLabSchema
  .extend({
    id: z.string().uuid(),
    consultaId: z.string().uuid().nullable().optional(),
    painel: z.enum(PaineisLab),
    data: dataSchema,
    hora: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
    laboratorio: texto(120).min(1),
    observacoes: texto(2500),
    resultados: z.array(linhaSchema).min(1).max(60),
    temPdf: z.boolean(),
  })
  .refine(
    ({ resultados }) =>
      new Set(
        resultados.map((r) =>
          r.parametroId.startsWith("personalizado-")
            ? JSON.stringify([normalizarLaboratorio(r.nome), unidadeComparavel(r.unidade)])
            : r.parametroId,
        ),
      ).size === resultados.length,
    "Um mesmo parâmetro não pode aparecer duas vezes no painel.",
  );
export const referenciasLabSchema = acessoLabSchema.extend({
  laboratorio: texto(120).min(1),
  painel: z.enum(PaineisLab),
});
export const salvarReferenciasLabSchema = referenciasLabSchema.extend({
  referencias: z.array(baseLinhaSchema).min(1).max(60),
});
