import { z } from "zod";
import {
  criarExamesPadrao,
  numeroExame,
  referenciaDoLaudoCatalogado,
  referenciaSugeridaCatalogo,
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
export type FaixaEtariaLab = "menos-de-12-meses" | "12-meses-ou-mais";

// Calcula a idade na data do exame (inclusive para registros retroativos).
export function faixaEtariaLaboratorial(
  nascimento: string | null | undefined,
  dataExame: string,
): FaixaEtariaLab | null {
  function diaValido(data: string | null | undefined): data is string {
    if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return false;
    const d = new Date(data + "T00:00:00Z");
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === data;
  }
  if (!diaValido(nascimento) || !diaValido(dataExame) || nascimento > dataExame) return null;
  const [ano, mes, dia] = nascimento.split("-").map(Number);
  const ultimoDiaDoMes = new Date(Date.UTC(ano + 1, mes, 0)).getUTCDate();
  const aniversario = new Date(Date.UTC(ano + 1, mes - 1, Math.min(dia, ultimoDiaDoMes)))
    .toISOString()
    .slice(0, 10);
  return dataExame >= aniversario ? "12-meses-ou-mais" : "menos-de-12-meses";
}

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
export type ReferenciaEtariaLab = ReferenciaLab & { faixaEtaria?: FaixaEtariaLab };

export function referenciasDaIdadeLab(
  referencias: ReferenciaEtariaLab[],
  faixaEtaria: FaixaEtariaLab | null,
) {
  return faixaEtaria ? referencias.filter((r) => r.faixaEtaria === faixaEtaria) : [];
}

export function atualizarFaixaEtariaLab(
  anteriores: ReferenciaEtariaLab[],
  novas: ReferenciaLab[],
  faixaEtaria: FaixaEtariaLab,
): ReferenciaEtariaLab[] {
  return [
    ...anteriores.filter((r) => r.faixaEtaria !== faixaEtaria),
    ...novas.map((r) => ({ ...r, faixaEtaria })),
  ];
}
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

export type LinhaLabRascunho = LinhaLab & {
  origemReferencia?: "sugestao" | "laboratorio" | "manual";
};

// Complementa o catálogo já adotado no ORICSE. Estas faixas não identificam
// o método do laudo; só são guardadas no exame após conferência explícita.
// UNESP/FMVZ (bioquímica, proteínas em soro e eletrólitos):
// https://www.fmvz.unesp.br/Home/ensino/departamentos/clinicaveterinaria/profreginatakahira/valref.pdf
// Relação A/G felina: Cornell AHDC, Cobas 501, soro:
// https://www.vet.cornell.edu/animal-health-diagnostic-center/laboratories/clinical-pathology/reference-intervals/chemistry-cobas
const sugestoesComplementares: Record<string, [string, string, string]> = {
  ast: ["U/L", "21 – 45", "26 – 43"],
  "fosfatase-alcalina": ["U/L", "20 – 156", "25 – 93"],
  ggt: ["U/L", "1,2 – 6,4", "1,3 – 5,1"],
  "proteina-total": ["g/dL", "", "5,40 – 7,80"],
  albumina: ["g/dL", "", "2,10 – 3,30"],
  globulina: ["g/dL", "", "2,60 – 5,10"],
  fosforo: ["mg/dL", "", "4,5 – 8,1"],
  "relacao-ag": ["", "", "0,8 – 1,5"],
};

export function sugerirReferenciaLab(
  linha: LinhaLabRascunho,
  especie: EspecieLab,
  faixaEtaria: FaixaEtariaLab | null,
): LinhaLabRascunho {
  if (
    faixaEtaria !== "12-meses-ou-mais" ||
    especie === "Outra" ||
    linha.parametroId.startsWith("personalizado-")
  )
    return linha;
  const complemento = sugestoesComplementares[linha.parametroId];
  const referencia =
    referenciaSugeridaCatalogo(linha.parametroId, linha.unidade, especie) ||
    (complemento && unidadeComparavel(linha.unidade) === unidadeComparavel(complemento[0])
      ? complemento[especie === "Cachorro" ? 1 : 2]
      : "");
  return referencia ? { ...linha, referencia, origemReferencia: "sugestao" } : linha;
}

export function aplicarReferenciasDoLaboratorioLab(
  linhas: LinhaLabRascunho[],
  referencias: ReferenciaLab[],
): LinhaLabRascunho[] {
  const porChave = new Map(referencias.map((r) => [chaveLinha(r), r.referencia]));
  return linhas.map((l) => {
    if (l.origemReferencia === "manual") return l;
    const referencia = porChave.get(chaveLinha(l));
    return referencia ? { ...l, referencia, origemReferencia: "laboratorio" } : l;
  });
}

export function resultadosConfirmadosLab(
  linhas: LinhaLabRascunho[],
  conferiuSugestoes: boolean,
): LinhaLab[] {
  return linhas
    .filter((l) => l.valor.trim())
    .map(({ origemReferencia, ...l }) => ({
      ...l,
      referencia: origemReferencia === "sugestao" && !conferiuSugestoes ? "" : l.referencia,
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
  data: dataSchema,
  laboratorio: texto(120).min(1),
  painel: z.enum(PaineisLab),
});
export const salvarReferenciasLabSchema = referenciasLabSchema.extend({
  referencias: z.array(baseLinhaSchema).min(1).max(60),
});
