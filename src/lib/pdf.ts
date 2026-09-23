import type { Registro } from "./ficha";
import { LOGO_PDF_DATA_URL } from "./logo";
import { lerSelo } from "./assinatura";

import type { Curva } from "./curva";
import { formatarTodos, linhaEstaForaDaFaixa, paraNumero } from "./ficha";
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
  opcoes?: { legenda?: string; arquivo?: string; curvas?: Curva[]; assinadoEm?: string; visualizar?: boolean },
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

  const logoLargura = 42;
  const logoAltura = 46;
  try {
    doc.addImage(LOGO_PDF_DATA_URL, "JPEG", margem, y - 4, logoLargura, logoAltura);
  } catch {
    /* sem logo, segue sem imagem */
  }
  y += logoAltura + 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(25);
  doc.text(TITULO, margem, y);
  y += 20;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text(SUBTITULO, margem, y);
  y += 16;


  const legendaBruta =
    opcoes?.legenda ||
    rotuloPlantaoPdf(carregarPlantaoAtual()) ||
    dataPorExtenso(new Date());

  // A seta "→" não existe nas fontes padrão do PDF: usar hífen.
  const legenda = legendaBruta.replace(/\s*→\s*/g, " - ");

  doc.setFillColor(246, 247, 248);
  doc.roundedRect(margem, y - 12, largura, 25, 5, 5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(55);
  doc.text(legenda, margem + 10, y + 2);
  doc.setTextColor(0);
  // Três linhas de respiro antes do primeiro paciente.
  y += 24 + 21 * 3;

  const listaCurvas = opcoes?.curvas ?? carregarCurvas();

  const texto = formatarTodos(registros, {
    emoji: false,
    obsPadrao: true,
    curvas: listaCurvas,
  });
  // Não dividir por linhas em branco: o conteúdo clínico pode conter espaçamentos internos.
  // Cada bloco é obtido pela ordem dos registros e pelo cabeçalho do próximo animal.
  const linhasTexto = texto.split("\n");
  const blocos: string[] = [];
  let blocoAtual: string[] = [];
  const cabecalhos = new Set(
    registros.map((registro) =>
      formatarTodos([registro], { emoji: false, obsPadrao: true, curvas: [] }).split("\n")[0],
    ),
  );
  for (const linha of linhasTexto) {
    if (cabecalhos.has(linha) && blocoAtual.length) {
      blocos.push(blocoAtual.join("\n"));
      blocoAtual = [linha];
    } else {
      blocoAtual.push(linha);
    }
  }
  if (blocoAtual.length) blocos.push(blocoAtual.join("\n"));

  doc.setFontSize(11);
  const ALTURA_LINHA = 21;
  blocos.forEach((bloco, indice) => {
    const r = registros[indice];
    const [cabecalho = "", ...resto] = bloco.split("\n");
    novaPaginaSeNecessario(ALTURA_LINHA * 2);

    // Cabeçalho do paciente: "Animal - (cão/gato)", centralizado verticalmente na faixa.
    const especiePdf = r?.especie === "Cachorro" ? "cão" : r?.especie === "Gato" ? "gato" : "";
    const nomeAnimalPdf = cabecalho
      .replace(/\s*\(Cachorro\)\s*$/, "")
      .replace(/\s*\(Gato\)\s*$/, "");
    const tituloPaciente = especiePdf
      ? `${nomeAnimalPdf} - (${especiePdf})`
      : nomeAnimalPdf;

    const alturaFaixa = 34;
    novaPaginaSeNecessario(alturaFaixa + 10);
    doc.setFillColor(224, 229, 233);
    doc.roundedRect(margem, y - 17, largura, alturaFaixa, 7, 7, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(0);
    doc.text(tituloPaciente, margem + 12, y, {
      baseline: "middle",
      maxWidth: largura - 24,
    });
    y += alturaFaixa / 2 + 12;

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    // Cada informação é um bloco de texto independente, com espaçamento
    // generoso, para que a cópia a partir do PDF preserve as quebras de linha.
    let naCurva = false;
    for (let linhaIndice = 0; linhaIndice < resto.length; linhaIndice++) {
      const linha = resto[linhaIndice]!;
      const tituloCurvaLinha = /^Curva /.test(linha);
      const fimDaCurva = /^(Observações|Resumo|Óbito|Observação):/.test(linha);
      if (tituloCurvaLinha) {
        naCurva = true;
        y += 10;
      } else if (fimDaCurva && naCurva) {
        naCurva = false;
        y += 10;
      }

      // Bloco de medicações: título em negrito e itens recuados.
      const tituloSecao = /^(Parâmetros|Medicações|Exames laboratoriais|Exames|Queixa principal|Relato|Conduta|Atenção para o próximo plantão|Resumo|Hemograma:|Bioquímico:|Outros exames:)$/.test(linha);
      const itemAnamnese = false;
      const itemMedicacao = /^- /.test(linha);
      if (tituloSecao) {
        // Nunca deixar título/subtítulo separado da primeira informação.
        const proximaLinha = resto[linhaIndice + 1] ?? "";
        const recuoProxima = /^- /.test(proximaLinha) ? 14 : 0;
        const partesTitulo = doc.splitTextToSize(linha, largura) as string[];
        const partesProxima = doc.splitTextToSize(proximaLinha, largura - recuoProxima) as string[];
        const alturaNecessaria =
          8 + (partesTitulo.length + Math.max(1, partesProxima.length)) * ALTURA_LINHA;
        if (y + alturaNecessaria > alturaPagina - margem) {
          doc.addPage();
          y = margem;
        } else {
          y += 8;
        }
      }

      const recuo = naCurva || itemMedicacao ? 16 : 0;
      const negrito = tituloCurvaLinha || tituloSecao;
      const fora = r ? linhaEstaForaDaFaixa(r, linha) : false;

      if (tituloSecao) {
        // Barra curta e suave: cria uma âncora visual sem encher a página.
        doc.setFillColor(242, 244, 246);
        doc.roundedRect(margem, y - 13, largura, 22, 4, 4, "F");
        doc.setFillColor(105, 115, 125);
        doc.roundedRect(margem, y - 13, 4, 22, 2, 2, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(35);
        doc.text(linha, margem + 12, y + 1, { baseline: "alphabetic", maxWidth: largura - 20 });
        y += 27;
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(0);
        continue;
      }

      if (fora) {
        // Alterações importantes chamam atenção por peso + tom vinho, sem caixas fortes.
        doc.setFont("helvetica", "bold");
        doc.setTextColor(114, 47, 55);
      } else {
        doc.setFont("helvetica", negrito ? "bold" : "normal");
        doc.setTextColor(30);
      }
      doc.setFontSize(10);
      const linhaPdf = linha;
      if (itemAnamnese) y += 6;
      const partes = doc.splitTextToSize(linhaPdf, largura - recuo) as string[];
      for (const l of partes) {
        novaPaginaSeNecessario(18);
        doc.text(l, margem + recuo, y, { baseline: "alphabetic", maxWidth: largura - recuo });
        y += 18;
      }
      doc.setTextColor(0);
      doc.setFont("helvetica", "normal");
    }

    // Gráfico da curva logo abaixo das medições do animal.
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

    y += 12;
  });

  // Assinatura e carimbo guardados no aparelho, no fim do documento.
  const assinatura = lerSelo("assinatura");
  const carimbo = lerSelo("carimbo");
  const assinadoEm =
    opcoes?.assinadoEm ??
    new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

  novaPaginaSeNecessario(150);
  y += 16;

  const desenharSelo = (dataUrl: string, x: number, maxL: number, maxA: number) => {
    try {
      const props = doc.getImageProperties(dataUrl);
      const escala = Math.min(maxL / props.width, maxA / props.height);
      const l = props.width * escala;
      const a = props.height * escala;
      doc.addImage(dataUrl, "PNG", x, y + (maxA - a), l, a);
    } catch {
      /* selo inválido: segue sem imagem */
    }
  };

  if (assinatura || carimbo) {
    const alturaSelo = 60;
    const larguraAssinatura = 105;
    const larguraCarimbo = 105;
    if (assinatura) desenharSelo(assinatura, margem, larguraAssinatura, alturaSelo);
    if (carimbo) desenharSelo(carimbo, margem + larguraAssinatura + 8, larguraCarimbo, alturaSelo);
    y += alturaSelo + 4;
  }

  doc.setDrawColor(0);
  doc.setLineWidth(0.8);
  doc.line(margem, y, margem + 105, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Data: ${assinadoEm}`, margem, y);
  y += 14;
  doc.text("Assinatura / carimbo", margem, y);

  const atual = carregarPlantaoAtual();
  if (opcoes?.visualizar) {
    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return;
  }
  doc.save(opcoes?.arquivo ?? nomeArquivoPdf(atual?.dia ?? diaDeHoje(), atual?.turno));
}
