import type { Registro } from "./ficha";
import type { Curva } from "./curva";
import { formatarTodos } from "./ficha";
import {
  carregarPlantaoAtual,
  dataPorExtenso,
  diaDeHoje,
  nomeArquivoPdf,
  rotuloPlantaoPdf,
} from "./plantao";

const TITULO = "Veterício Serviços Veterinários LTDA";
const SUBTITULO = "Ficha de Avaliação da Internação";

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

  const texto = formatarTodos(registros, {
    emoji: false,
    obsPadrao: true,
    ...(opcoes?.curvas ? { curvas: opcoes.curvas } : {}),
  });
  const blocos = texto.split("\n\n");

  doc.setFontSize(11);
  const ALTURA_LINHA = 21;
  for (const bloco of blocos) {
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
      const tituloCurva = /^Curva /.test(linha);
      const fimDaCurva = /^(Observações|Resumo):/.test(linha);
      if (tituloCurva) {
        naCurva = true;
        y += 10;
      } else if (fimDaCurva && naCurva) {
        naCurva = false;
        y += 10;
      }

      const recuo = naCurva ? 14 : 0;
      const negrito = tituloCurva;
      doc.setFont("helvetica", negrito ? "bold" : "normal");
      const partes = doc.splitTextToSize(linha, largura - recuo) as string[];
      for (const l of partes) {
        novaPaginaSeNecessario(ALTURA_LINHA);
        doc.text(l, margem + recuo, y, { baseline: "alphabetic", maxWidth: largura - recuo });
        y += ALTURA_LINHA;
      }
      doc.setFont("helvetica", "normal");
    }
    y += 18;
  }



  const atual = carregarPlantaoAtual();
  doc.save(opcoes?.arquivo ?? nomeArquivoPdf(atual?.dia ?? diaDeHoje(), atual?.turno));
}
