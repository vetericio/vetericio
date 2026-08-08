import type { Registro } from "./ficha";
import { formatarTodos } from "./ficha";

const TITULO = "Veterício Serviços Veterinários LTDA";
const SUBTITULO = "Ficha de Avaliação da Internação";

export async function exportarPdf(
  registros: Registro[],
  opcoes?: { legenda?: string; arquivo?: string },
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

  const legenda =
    opcoes?.legenda ||
    rotuloPlantaoAtual(carregarPlantaoAtual()) ||
    new Date().toLocaleDateString("pt-BR", { dateStyle: "long" });


  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(legenda, margem, y);
  doc.setTextColor(0);
  y += 24;

  const texto = formatarTodos(registros);
  const blocos = texto.split("\n\n");

  doc.setFontSize(11);
  for (const bloco of blocos) {
    const [cabecalho = "", ...resto] = bloco.split("\n");
    novaPaginaSeNecessario(40);

    doc.setFont("helvetica", "bold");
    const linhasCabecalho = doc.splitTextToSize(cabecalho, largura) as string[];
    for (const l of linhasCabecalho) {
      novaPaginaSeNecessario(18);
      doc.text(l, margem, y);
      y += 18;
    }

    doc.setFont("helvetica", "normal");
    // Cada informação em sua própria linha, com espaçamento suficiente para
    // que a cópia a partir do PDF preserve as quebras de linha.
    for (const linha of resto) {
      const partes = doc.splitTextToSize(linha, largura) as string[];
      for (const l of partes) {
        novaPaginaSeNecessario(17);
        doc.text(l, margem, y);
        y += 17;
      }
    }
    y += 16;
  }


  doc.save(opcoes?.arquivo ?? "veterico-fichas.pdf");
}
