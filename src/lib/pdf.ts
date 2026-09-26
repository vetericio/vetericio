import type { Registro } from "./ficha";
import type { Anamnese } from "./anamnese";
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

const TITULO = "FICHA DE INTERNAÇÃO";

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
  opcoes?: { legenda?: string; arquivo?: string; curvas?: Curva[]; anamneses?: Anamnese[]; assinadoEm?: string; visualizar?: boolean },
) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  const margem = 32;
  const largura = doc.internal.pageSize.getWidth() - margem * 2;
  const alturaPagina = doc.internal.pageSize.getHeight();
  let y = margem;

  const novaPaginaSeNecessario = (altura: number) => {
    if (y + altura > alturaPagina - margem) {
      doc.addPage();
      y = margem;
    }
  };

  const logoLargura = 90;
  const logoAltura = 90;
  const centroX = doc.internal.pageSize.getWidth() / 2;
  try {
    // Usa a mesma logo oficial da abertura. O caminho público local evita CORS no visualizador móvel.
    const caminhoLogo = "/vetericio-logo-oficial.png";
    const imagem = new Image();
    imagem.src = caminhoLogo;
    await imagem.decode();
    const canvas = document.createElement("canvas");
    canvas.width = imagem.naturalWidth;
    canvas.height = imagem.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas indisponível");
    ctx.drawImage(imagem, 0, 0);
    const logoDataUrl = canvas.toDataURL("image/png");
    const propsLogo = doc.getImageProperties(logoDataUrl);
    const escalaLogo = Math.min(logoLargura / propsLogo.width, logoAltura / propsLogo.height);
    const larguraFinalLogo = propsLogo.width * escalaLogo;
    const alturaFinalLogo = propsLogo.height * escalaLogo;
    doc.addImage(logoDataUrl, "PNG", centroX - larguraFinalLogo / 2, y + (logoAltura - alturaFinalLogo) / 2, larguraFinalLogo, alturaFinalLogo);
  } catch (erro) {
    console.error("Falha ao inserir logo oficial no PDF", erro);
  }
  y += logoAltura + 18;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(25);
  doc.text(TITULO, centroX, y, { align: "center" });
  y += 28;


  const legendaBruta =
    opcoes?.legenda ||
    rotuloPlantaoPdf(carregarPlantaoAtual()) ||
    dataPorExtenso(new Date());

  // A seta "→" não existe nas fontes padrão do PDF: usar hífen.
  const legenda = legendaBruta.replace(/\s*→\s*/g, " - ");

  doc.setFillColor(232, 234, 236);
  doc.roundedRect(margem, y - 14, largura, 30, 9, 9, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(45);
  doc.text(legenda, margem + largura / 2, y + 3, { align: "center" });
  doc.setTextColor(0);
  // Três linhas de respiro antes do primeiro paciente.
  y += 24 + 21 * 3;

  const listaCurvas = opcoes?.curvas ?? carregarCurvas();

  const texto = formatarTodos(registros, {
    emoji: false,
    obsPadrao: true,
    curvas: listaCurvas,
    ...(opcoes?.anamneses ? { anamneses: opcoes.anamneses } : {}),
  });
  // Não dividir por linhas em branco: o conteúdo clínico pode conter espaçamentos internos.
  // Cada bloco é obtido pela ordem dos registros e pelo cabeçalho do próximo animal.
  const linhasTexto = texto.split("\n");
  const blocos: string[] = [];
  let blocoAtual: string[] = [];
  const cabecalhos = new Set(
    registros.map((registro) =>
      formatarTodos([registro], { emoji: false, obsPadrao: true, curvas: [], ...(opcoes?.anamneses ? { anamneses: opcoes.anamneses } : {}) }).split("\n")[0],
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
  const desenharIconeSecao = (titulo: string, x: number, cy: number) => {
    doc.setDrawColor(25);
    doc.setFillColor(25);
    doc.setLineWidth(1.2);
    // desenhos monocromáticos simples para manter legibilidade na impressão
    if (titulo === "Parâmetros") {
      // coração + traço de ECG
      doc.line(x, cy, x + 5, cy);
      doc.line(x + 5, cy, x + 8, cy - 5);
      doc.line(x + 8, cy - 5, x + 12, cy + 5);
      doc.line(x + 12, cy + 5, x + 16, cy - 2);
      doc.line(x + 16, cy - 2, x + 20, cy);
      doc.line(x + 20, cy, x + 27, cy);
    } else if (titulo === "Medicações") {
      // seringa
      doc.line(x + 5, cy + 6, x + 20, cy - 7);
      doc.rect(x + 9, cy - 5, 10, 6, "S");
      doc.line(x + 18, cy - 7, x + 23, cy - 2);
      doc.line(x + 20, cy - 9, x + 25, cy - 4);
      doc.line(x + 5, cy + 3, x + 8, cy + 6);
      doc.line(x + 3, cy + 8, x + 5, cy + 6);
    } else if (titulo === "Exames laboratoriais") {
      // tubo de coleta
      doc.roundedRect(x + 7, cy - 9, 13, 18, 3, 3, "S");
      doc.line(x + 6, cy - 9, x + 21, cy - 9);
      doc.line(x + 9, cy + 4, x + 18, cy + 4);
    } else if (titulo === "Exames") {
      // tubo de ensaio
      doc.line(x + 7, cy - 9, x + 20, cy - 9);
      doc.line(x + 10, cy - 9, x + 10, cy + 5);
      doc.line(x + 17, cy - 9, x + 17, cy + 5);
      doc.line(x + 10, cy + 5, x + 12, cy + 8);
      doc.line(x + 12, cy + 8, x + 15, cy + 8);
      doc.line(x + 15, cy + 8, x + 17, cy + 5);
      doc.line(x + 11, cy + 2, x + 16, cy + 2);
    } else if (titulo === "Queixa principal") {
      // balão de fala
      doc.roundedRect(x + 3, cy - 8, 21, 13, 3, 3, "S");
      doc.line(x + 9, cy + 5, x + 7, cy + 9);
      doc.line(x + 7, cy + 9, x + 13, cy + 5);
    } else if (titulo === "Relato") {
      // folha com linhas
      doc.rect(x + 5, cy - 9, 17, 18, "S");
      doc.line(x + 9, cy - 4, x + 18, cy - 4);
      doc.line(x + 9, cy, x + 18, cy);
      doc.line(x + 9, cy + 4, x + 16, cy + 4);
    } else if (titulo === "Conduta") {
      // checklist
      doc.rect(x + 4, cy - 8, 4, 4, "S");
      doc.line(x + 11, cy - 6, x + 23, cy - 6);
      doc.rect(x + 4, cy, 4, 4, "S");
      doc.line(x + 11, cy + 2, x + 23, cy + 2);
    } else if (titulo === "Atenção para o próximo plantão") {
      // triângulo de atenção
      doc.triangle(x + 14, cy - 10, x + 3, cy + 9, x + 25, cy + 9, "S");
      doc.line(x + 14, cy - 4, x + 14, cy + 3);
      doc.circle(x + 14, cy + 6, 1, "F");
    } else if (titulo === "Observações") {
      // anotação clínica livre
      doc.roundedRect(x + 5, cy - 8, 18, 16, 2, 2, "S");
      doc.line(x + 9, cy - 3, x + 19, cy - 3);
      doc.line(x + 9, cy + 1, x + 19, cy + 1);
      doc.line(x + 9, cy + 5, x + 16, cy + 5);
    } else if (titulo === "Resumo") {
      // prancheta
      doc.roundedRect(x + 5, cy - 8, 18, 17, 2, 2, "S");
      doc.roundedRect(x + 10, cy - 11, 8, 5, 2, 2, "S");
      doc.line(x + 9, cy - 1, x + 19, cy - 1);
      doc.line(x + 9, cy + 4, x + 19, cy + 4);
    }
  };
  blocos.forEach((bloco, indice) => {
    // Paginação por meia folha:
    // - primeiro animal permanece com o cabeçalho;
    // - se o animal anterior terminou até a metade da página, o próximo pode usar a mesma página;
    // - se passou da metade, o próximo começa obrigatoriamente em uma página nova.
    if (indice > 0 && y > alturaPagina / 2) {
      doc.addPage();
      y = margem;
    }
    const r = registros[indice];
    const [cabecalho = "", ...restoBruto] = bloco.split("\n");

    // Ordem clínica fixa do PDF. Seções vazias continuam omitidas.
    const ORDEM_SECOES = [
      "Parâmetros",
      "Medicações",
      "Exames laboratoriais",
      "Exames",
      "Queixa principal",
      "Relato",
      "Conduta",
      "Atenção para o próximo plantão",
      "Observações",
      "Resumo",
    ] as const;
    const ehTituloSecao = (linha: string) =>
      (ORDEM_SECOES as readonly string[]).includes(linha);
    const secoes = new Map<string, string[]>();
    let secaoAtual = "";
    const extras: string[] = [];
    for (const linha of restoBruto) {
      if (ehTituloSecao(linha)) {
        secaoAtual = linha;
        if (!secoes.has(linha)) secoes.set(linha, []);
      } else if (secaoAtual) {
        secoes.get(secaoAtual)!.push(linha);
      } else if (linha.trim()) {
        extras.push(linha);
      }
    }
    const resto = [
      ...ORDEM_SECOES.flatMap((tituloSecao) => {
        const conteudo = (secoes.get(tituloSecao) ?? []).filter((linha) => linha.trim());
        return conteudo.length ? [tituloSecao, ...conteudo] : [];
      }),
      ...extras,
    ];

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
    // Nome grande + selo de espécie no lado direito.
    doc.text(nomeAnimalPdf, margem + 12, y, {
      baseline: "middle",
      maxWidth: largura - 95,
    });
    if (especiePdf) {
      const selo = especiePdf.toUpperCase();
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(margem + largura - 72, y - 10, 60, 20, 10, 10, "F");
      doc.setFontSize(8);
      doc.setTextColor(70);
      doc.text(selo, margem + largura - 42, y + 1, { align: "center", baseline: "middle" });
      doc.setFontSize(15);
      doc.setTextColor(0);
    }
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
      const tituloSecao = /^(Parâmetros|Medicações|Exames laboratoriais|Exames|Queixa principal|Relato|Conduta|Atenção para o próximo plantão|Observações|Resumo)$/.test(linha);
      const itemAnamnese = false;
      const itemMedicacao = /^- /.test(linha);
      if (tituloSecao) {
        // O subtítulo e seu conteúdo formam um bloco visual único.
        // Se o bloco inteiro couber em uma página, nunca o partir entre páginas.
        let fimSecao = linhaIndice + 1;
        while (fimSecao < resto.length && !/^(Parâmetros|Medicações|Exames laboratoriais|Exames|Queixa principal|Relato|Conduta|Atenção para o próximo plantão|Observações|Resumo)$/.test(resto[fimSecao]!)) {
          fimSecao++;
        }
        const conteudoSecao = resto.slice(linhaIndice + 1, fimSecao).filter((item) => item.trim());
        const alturaConteudo = conteudoSecao.reduce((total, item) => {
          const recuoItem = /^- /.test(item) ? 16 : 0;
          const partesItem = doc.splitTextToSize(item, largura - recuoItem) as string[];
          return total + Math.max(1, partesItem.length) * 18;
        }, 0);
        const alturaBloco = 35 + alturaConteudo;
        const alturaUtilPagina = alturaPagina - margem * 2;

        if (alturaBloco <= alturaUtilPagina && y + alturaBloco > alturaPagina - margem) {
          doc.addPage();
          y = margem;
        } else if (alturaBloco > alturaUtilPagina && y + 35 + 36 > alturaPagina - margem) {
          // Se a seção for maior que uma página, ao menos título + primeiras linhas ficam juntos.
          doc.addPage();
          y = margem;
        } else {
          y += 8;
        }
      }

      const RECUO_CONTEUDO = 28.35; // 1 cm
      const recuo = RECUO_CONTEUDO + (naCurva || itemMedicacao ? 16 : 0);
      const negrito = tituloCurvaLinha || tituloSecao;
      const fora = r ? linhaEstaForaDaFaixa(r, linha) : false;

      if (tituloSecao) {
        // Cabeçalho visual com desenho preto; Medicações permanece sem desenho.
        doc.setFillColor(239, 242, 244);
        doc.roundedRect(margem, y - 15, largura, 28, 6, 6, "F");
        const temDesenho = true;
        desenharIconeSecao(linha, margem + 8 + RECUO_CONTEUDO, y - 1);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(30);
        doc.text(linha, margem + RECUO_CONTEUDO + (temDesenho ? 44 : 12), y + 2, {
          baseline: "alphabetic",
          maxWidth: largura - RECUO_CONTEUDO - (temDesenho ? 53 : 21),
        });
        y += 34;
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
      // Desenhos ficam somente nos títulos das seções.
      // Linhas clínicas ganham aparência de tabela leve para leitura horizontal.
      if (/^- /.test(linhaPdf)) {
        const indiceVisual = linhaIndice % 2;
        if (indiceVisual === 0) {
          doc.setFillColor(249, 250, 251);
          doc.roundedRect(margem + 8, y - 12, largura - 16, 17, 3, 3, "F");
        }
      }
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
    const url = doc.output("bloburl");
    const aberta = window.open(String(url), "_blank");
    if (!aberta) {
      // Fallback para navegadores móveis que bloqueiam a nova aba.
      window.location.href = String(url);
    }
    return;
  }
  doc.save(opcoes?.arquivo ?? nomeArquivoPdf(atual?.dia ?? diaDeHoje(), atual?.turno));
}
