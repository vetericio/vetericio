import { REGISTRO_VAZIO, type Especie, type Plantao, type Registro } from "./ficha";
import { chaveDoAnimal, type Curva, type Medicao, type ParametroCurva } from "./curva";

/** Extrai as linhas de texto de um PDF, na ordem em que foram desenhadas. */
async function linhasDoPdf(arquivo: File): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const dados = new Uint8Array(await arquivo.arrayBuffer());
  const doc = await pdfjs.getDocument({ data: dados }).promise;
  const linhas: string[] = [];

  for (let p = 1; p <= doc.numPages; p++) {
    const pagina = await doc.getPage(p);
    const conteudo = await pagina.getTextContent();
    let atual = "";
    let ultimoY: number | null = null;
    for (const item of conteudo.items) {
      if (!("str" in item)) continue;
      const y = Math.round(item.transform[5] as number);
      if (ultimoY !== null && Math.abs(y - ultimoY) > 2) {
        if (atual.trim()) linhas.push(atual.trim());
        atual = "";
      }
      atual += item.str;
      ultimoY = y;
    }
    if (atual.trim()) linhas.push(atual.trim());
  }
  return linhas;
}

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

const CAMPOS: Record<string, keyof Registro> = {
  "alimentação": "alimentacao",
  comportamento: "comportamento",
  fezes: "fezes",
  mucosas: "mucosas",
  temperatura: "temperatura",
  urina: "urina",
  fc: "fc",
  fr: "fr",
  "vômito": "vomito",
  pas: "pas",
  glicemia: "glicemia",
  "observações": "observacoes",
};

function semAcento(t: string) {
  return t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function soValor(valor: string) {
  return valor.replace(/\s*(°C|bpm|mpm|mmHg|mg\/dL)\s*$/i, "").trim();
}

/** Data/turno a partir da legenda do PDF gerado pelo app. */
function lerLegenda(linha: string): { data: string; turno: string } | null {
  const t = semAcento(linha);
  if (!t.startsWith("plantao ")) return null;
  const turno = t.includes("noturno") ? "noturno" : "diurno";

  const extenso = linha.match(/(\d{1,2}) de ([a-zç]+) de (\d{4})/i);
  if (extenso) {
    const mes = MESES.findIndex((m) => semAcento(m) === semAcento(extenso[2]!));
    if (mes >= 0) {
      const dia = String(Number(extenso[1])).padStart(2, "0");
      return { data: `${extenso[3]}-${String(mes + 1).padStart(2, "0")}-${dia}`, turno };
    }
  }
  const curta = linha.match(/(\d{2})\/(\d{2})\/(\d{2,4})/);
  if (curta) {
    const ano = curta[3]!.length === 2 ? `20${curta[3]}` : curta[3]!;
    return { data: `${ano}-${curta[2]}-${curta[1]}`, turno };
  }
  return null;
}

function especieDoTitulo(linha: string): { animal: string; especie: Especie } | null {
  const com = linha.match(/^(.+)\s\((Cachorro|Gato)\)$/);
  if (com) return { animal: com[1]!.trim(), especie: com[2] as Especie };
  if (/:/.test(linha)) return null;
  if (/^\d{1,2}h\d{2}\s*-/.test(linha)) return null;
  if (/^(Curva|Gr[áa]fico|sem medi)/i.test(linha)) return null;
  if (semAcento(linha).startsWith("plantao")) return null;
  return { animal: linha.trim(), especie: "" };
}

export type ResultadoImportacao = {
  plantao: Plantao;
  animais: number;
  curvas: number;
};

/** Lê um PDF gerado por este app e reconstrói o plantão (animais e curvas). */
export async function importarPlantaoDoPdf(arquivo: File): Promise<ResultadoImportacao> {
  const linhas = await linhasDoPdf(arquivo);
  const doApp = linhas.some((l) => semAcento(l).includes("ficha de avaliacao da internacao"));
  if (!doApp) throw new Error("Este PDF não é um plantão gerado pelo app.");

  let legenda: { data: string; turno: string } | null = null;
  const registros: Registro[] = [];
  const curvas: Curva[] = [];
  let atual: Registro | null = null;
  let curvaAtual: Curva | null = null;
  let ultimoCampo: keyof Registro | null = null;

  const iniciarAnimal = (animal: string, especie: Especie) => {
    atual = {
      ...REGISTRO_VAZIO,
      id: crypto.randomUUID(),
      animal,
      especie,
      criadoEm: new Date().toISOString(),
    } as Registro;
    registros.push(atual);
    curvaAtual = null;
    ultimoCampo = null;
  };

  for (const linha of linhas) {
    if (semAcento(linha).includes("veterico servicos")) continue;
    if (semAcento(linha).includes("ficha de avaliacao")) continue;

    if (!legenda) {
      const lida = lerLegenda(linha);
      if (lida) {
        legenda = lida;
        continue;
      }
    }
    if (/^Gr[áa]fico\s*—/.test(linha)) continue;
    if (/^\d+(\s|$)/.test(linha) && linha.length <= 4) continue; // rótulos do gráfico

    const tituloCurva = linha.match(/^Curva\s(gl|de)(.*)\(a cada (\d)h\)$/i);
    if (tituloCurva && atual) {
      const parametros: ParametroCurva[] = /gl/i.test(tituloCurva[1]!)
        ? ["glicemia"]
        : ([
            /glicemia/i.test(tituloCurva[2]!) ? "glicemia" : null,
            /pas/i.test(tituloCurva[2]!) ? "pas" : null,
          ].filter(Boolean) as ParametroCurva[]);
      curvaAtual = {
        id: crypto.randomUUID(),
        chave: chaveDoAnimal(atual.animal, atual.especie),
        animal: atual.animal,
        especie: (atual.especie ?? "") as Especie,
        parametros: parametros.length ? parametros : ["glicemia"],
        intervaloHoras: Number(tituloCurva[3]) || 2,
        ativa: false,
        criadoEm: new Date().toISOString(),
        medicoes: [],
      };
      curvas.push(curvaAtual);
      continue;
    }

    const medicao = linha.match(/^(\d{1,2})h(\d{2})\s*-\s*(.+)$/);
    if (medicao && curvaAtual) {
      const valores = medicao[3]!.split("/").map((v) => v.trim());
      const m: Medicao = { id: crypto.randomUUID(), em: "", glicemia: "", pas: "" };
      for (const v of valores) {
        if (/mg\/?dL/i.test(v) || (curvaAtual.parametros.includes("glicemia") && !/mmHg/i.test(v)))
          m.glicemia = soValor(v);
        else if (/mmHg/i.test(v)) m.pas = soValor(v);
      }
      const dia = legenda?.data ?? new Date().toISOString().slice(0, 10);
      m.em = new Date(
        `${dia}T${medicao[1]!.padStart(2, "0")}:${medicao[2]}:00`,
      ).toISOString();
      curvaAtual.medicoes.push(m);
      continue;
    }
    if (/^sem medi/i.test(linha)) continue;

    const par = linha.match(/^([^:]{1,20}):\s*(.*)$/);
    if (par && atual) {
      const rotulo = semAcento(par[1]!);
      if (rotulo === "obito") {
        const partes = par[2]!.split(/\s+-\s+/);
        atual.obito = { hora: (partes[0] ?? "").trim(), motivo: partes.slice(1).join(" - ").trim() };
        curvaAtual = null;
        ultimoCampo = null;
        continue;
      }
      if (rotulo === "resumo") {
        curvaAtual = null;
        ultimoCampo = null;
        continue;
      }
      const chave = CAMPOS[rotulo];
      if (chave) {
        const valor = par[2]!.trim();
        if (chave === "observacoes") {
          atual.observacoes = /^nenhuma observa/i.test(valor) ? "" : valor;
        } else {
          (atual as unknown as Record<string, string>)[chave] = soValor(valor);
        }
        ultimoCampo = chave;
        curvaAtual = null;
        continue;
      }
    }

    const titulo = especieDoTitulo(linha);
    if (titulo && (!atual || ultimoCampo !== null || registros.length === 0)) {
      // Continuação de uma observação longa quebrada em várias linhas.
      if (atual && ultimoCampo === "observacoes" && !/\((Cachorro|Gato)\)$/.test(linha)) {
        atual.observacoes = `${atual.observacoes}\n${linha}`.trim();
        continue;
      }
      iniciarAnimal(titulo.animal, titulo.especie);
      continue;
    }

    if (atual && ultimoCampo === "observacoes") {
      atual.observacoes = `${atual.observacoes}\n${linha}`.trim();
    }
  }

  if (registros.length === 0) throw new Error("Nenhum animal encontrado neste PDF.");

  const comMedicoes = curvas.filter((c) => c.medicoes.length > 0);
  const plantao: Plantao = {
    id: crypto.randomUUID(),
    data: legenda?.data ?? new Date().toISOString().slice(0, 10),
    turno: legenda?.turno ?? "",
    registros,
    ...(comMedicoes.length ? { curvas: comMedicoes } : {}),
    criadoEm: new Date().toISOString(),
  };

  return { plantao, animais: registros.length, curvas: comMedicoes.length };
}
