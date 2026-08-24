import type { Registro } from "./ficha";
import type { Curva } from "./curva";
import { formatarTodos, paraNumero } from "./ficha";
import { carregarCurvas, curvasDoAnimal, horaDaMedicao, ROTULO_PARAMETRO, tituloCurva } from "./curva";
import {
  carregarPlantaoAtual,
  dataPorExtenso,
  diaDeHoje,
  nomeArquivoPdf,
  rotuloPlantaoPdf,
} from "./plantao";

const TITULO = "Veterício Serviços Veterinários LTDA";
const SUBTITULO = "Ficha de Avaliação da Internação";

type Doc = import("jspdf").jsPDF;

const CORES: Record<string, [number, number, number]> = {
  glicemia: [37, 99, 235],
  pas: [190, 24, 93],
};

/** Pontos de um parâmetro da curva, na ordem das medições. */
function pontos(c: Curva, p: "glicemia" | "pas") {
  return c.medicoes
    .map((m) => ({ hora: horaDaMedicao(m), valor: paraNumero(p === "glicemia" ? m.glicemia : m.pas) }))
    .filter((d) => !Number.isNaN(d.valor));
}

/** Desenha o gráfico da curva e devolve a altura usada. */
function desenharGrafico(doc: Doc, c: Curva, x: number, y: number, largura: number): number {
  const series = c.parametros
    .map((p) => ({ p, dados: pontos(c, p) }))
    .filter((s) => s.dados.length > 0);
  if (series.length === 0) return 0;

  const alturaGrafico = 110;
  const padEsq = 34;
  const padBaixo = 16;
  const areaLargura = largura - padEsq;
  const areaAltura = alturaGrafico - padBaixo;

  const todos = series.flatMap((s) => s.dados.map((d) => d.valor));
  let min = Math.min(...todos);
  let max = Math.max(...todos);
  if (max === min) {
    min -= 10;
    max += 10;
  } else {
    const folga = (max - min) * 0.15;
    min -= folga;
    max += folga;
  }

  const px = (i: number, total: number) =>
    x + padEsq + (total <= 1 ? areaLargura / 2 : (areaLargura * i) / (total - 1));
  const py = (v: number) => y + areaAltura - ((v - min) / (max - min)) * areaAltura;

  // Moldura e linhas de grade
  doc.setDrawColor(210);
  doc.setLineWidth(0.6);
  doc.rect(x + padEsq, y, areaLargura, areaAltura);
  doc.setFontSize(7);
  doc.setTextColor(120);
  for (let i = 0; i <= 2; i++) {
    const v = min + ((max - min) * i) / 2;
    const ly = py(v);
    if (i > 0 && i < 2) doc.line(x + padEsq, ly, x + padEsq + areaLargura, ly);
    doc.text(String(Math.round(v)), x + padEsq - 4, ly + 2, { align: "right" });
  }

  // Linhas e pontos
  for (const s of series) {
    const [r, g, b] = CORES[s.p] ?? [80, 80, 80];
    doc.setDrawColor(r, g, b);
    doc.setFillColor(r, g, b);
    doc.setLineWidth(1.2);
    const total = s.dados.length;
    s.dados.forEach((d, i) => {
      const cx = px(i, total);
      const cy = py(d.valor);
      if (i > 0) {
        const anterior = s.dados[i - 1]!;
        doc.line(px(i - 1, total), py(anterior.valor), cx, cy);
      }
      doc.circle(cx, cy, 2, "F");
    });
  }

  // Horas no eixo X (da primeira série, que define a quantidade de medições)
  const base = series[0]!.dados;
  doc.setTextColor(120);
  doc.setFontSize(7);
  base.forEach((d, i) => {
    if (base.length > 8 && i % 2 === 1) return;
    doc.text(d.hora, px(i, base.length), y + areaAltura + 10, { align: "center" });
  });

  // Legenda com a cor de cada parâmetro
  let lx = x + padEsq;
  const ly = y + alturaGrafico + 2;
  doc.setFontSize(8);
  for (const s of series) {
    const [r, g, b] = CORES[s.p] ?? [80, 80, 80];
    doc.setFillColor(r, g, b);
    doc.circle(lx + 3, ly - 2.5, 3, "F");
    doc.setTextColor(r, g, b);
    const rotulo = `${ROTULO_PARAMETRO[s.p].rotulo} (${ROTULO_PARAMETRO[s.p].unidade})`;
    doc.text(rotulo, lx + 9, ly);
    lx += 9 + doc.getTextWidth(rotulo) + 14;
  }

  doc.setTextColor(0);
  doc.setDrawColor(0);
  return alturaGrafico + 10;
}


export async function exportarPdf(
  registros: Registro[],
  opcoes?: { legenda?: string; arquivo?: string; curvas?: Curva[] },
) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  const margem = 48;
  const largura = doc.internal.pageSize.getWidth() - margem * 2;
  const alturaPagina = doc.internal.pageSize.getHeight();
  let y = margem;

  const novaPaginaSeNecessario = (altura: number) => {
    if (y + altura > alturaPagina - margem) {
      doc.addPage();
      y = margem;
    }
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(TITULO, margem, y);
  y += 20;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(SUBTITULO, margem, y);
  y += 16;

  const legendaBruta =
    opcoes?.legenda ||
    rotuloPlantaoPdf(carregarPlantaoAtual()) ||
    dataPorExtenso(new Date());

  // A seta "→" não existe nas fontes padrão do PDF: usar hífen.
  const legenda = legendaBruta.replace(/\s*→\s*/g, " - ");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(legenda, margem, y);
  y += 24;

  const listaCurvas = opcoes?.curvas ?? carregarCurvas();

  const texto = formatarTodos(registros, {
    emoji: false,
    obsPadrao: true,
    curvas: listaCurvas,
  });
  const blocos = texto.split("\n\n");

  doc.setFontSize(11);
  const ALTURA_LINHA = 21;
  blocos.forEach((bloco, indice) => {
    const [cabecalho = "", ...resto] = bloco.split("\n");
    novaPaginaSeNecessario(ALTURA_LINHA * 2);

    doc.setFont("helvetica", "bold");
    const linhasCabecalho = doc.splitTextToSize(cabecalho, largura) as string[];
    for (const l of linhasCabecalho) {
      novaPaginaSeNecessario(ALTURA_LINHA);
      doc.text(l, margem, y, { baseline: "alphabetic", maxWidth: largura });
      y += ALTURA_LINHA;
    }

    doc.setFont("helvetica", "normal");
    // Cada informação é um bloco de texto independente, com espaçamento
    // generoso, para que a cópia a partir do PDF preserve as quebras de linha.
    let naCurva = false;
    for (const linha of resto) {
      const tituloCurvaLinha = /^Curva /.test(linha);
      const fimDaCurva = /^(Observações|Resumo|Óbito):/.test(linha);
      if (tituloCurvaLinha) {
        naCurva = true;
        y += 10;
      } else if (fimDaCurva && naCurva) {
        naCurva = false;
        y += 10;
      }

      // Bloco de medicações: título em negrito e itens recuados.
      const tituloMedicacao = /^Medicações:$/.test(linha);
      const itemMedicacao = /^- /.test(linha);
      if (tituloMedicacao) y += 6;

      const recuo = naCurva || itemMedicacao ? 14 : 0;
      const negrito = tituloCurvaLinha || tituloMedicacao;
      doc.setFont("helvetica", negrito ? "bold" : "normal");
      const partes = doc.splitTextToSize(linha, largura - recuo) as string[];
      for (const l of partes) {
        novaPaginaSeNecessario(ALTURA_LINHA);
        doc.text(l, margem + recuo, y, { baseline: "alphabetic", maxWidth: largura - recuo });
        y += ALTURA_LINHA;
      }
      doc.setFont("helvetica", "normal");
    }

    // Gráfico da curva logo abaixo das medições do animal.
    const r = registros[indice];
    if (r) {
      for (const c of curvasDoAnimal(listaCurvas, r.animal, r.especie)) {
        novaPaginaSeNecessario(140);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text(`Gráfico — ${tituloCurva(c)}`, margem + 14, y);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        y += 8;
        const usado = desenharGrafico(doc, c, margem + 14, y, largura - 28);
        y += usado;
        doc.setFontSize(11);
      }
    }

    y += 18;
  });

  const atual = carregarPlantaoAtual();
  doc.save(opcoes?.arquivo ?? nomeArquivoPdf(atual?.dia ?? diaDeHoje(), atual?.turno));
}
