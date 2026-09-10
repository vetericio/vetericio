import { LOGO_PDF_DATA_URL } from "./logo";
import { normalizarNomeMedicamento } from "./nomes";
import {
  NOME_ESPECIE,
  ordenarMedicamentos,
  referenciaDose,
  viasDe,
  type Medicamento,
} from "./medicamentos";
import { dataPorExtenso } from "./plantao";

const TITULO = "Veterício Serviços Veterinários LTDA";
const SUBTITULO = "Medicações cadastradas — doses e concentrações";

/** Linhas de dose de uma espécie, ou vazio quando não há nada cadastrado. */
function linhasDose(m: Medicamento): string[] {
  const linhas: string[] = [];
  const bloco = (especie: "cao" | "gato") => {
    const d = m[especie];
    const rotulo = NOME_ESPECIE[especie];
    if (d.proibido) return `${rotulo}: não pode ser ministrado`;
    const ref = referenciaDose(d);
    const padrao = (d.dosePadrao ?? "").trim();
    const partes: string[] = [];
    if (ref) partes.push(`dose ${ref}`);
    if (padrao) partes.push(`padrão ${padrao}`);
    if (d.intervalo?.trim()) partes.push(`a cada ${d.intervalo.trim()}h`);
    if (partes.length === 0) return "";
    return `${rotulo}: ${partes.join(" / ")}`;
  };

  if (m.doseUnificada) {
    const unico = bloco("cao");
    if (unico) linhas.push(unico.replace(/^cão:/i, "Cão e gato:"));
  } else {
    for (const e of ["cao", "gato"] as const) {
      const l = bloco(e);
      if (l) linhas.push(l.charAt(0).toUpperCase() + l.slice(1));
    }
  }
  return linhas;
}

/** Gera e baixa o PDF com todas as medicações cadastradas. */
export async function exportarPdfMedicamentos(medicamentos: Medicamento[]) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  const margem = 48;
  const largura = doc.internal.pageSize.getWidth() - margem * 2;
  const alturaPagina = doc.internal.pageSize.getHeight();
  let y = margem;

  const espaco = (altura: number) => {
    if (y + altura > alturaPagina - margem) {
      doc.addPage();
      y = margem;
    }
  };

  const logoLargura = 34;
  try {
    doc.addImage(LOGO_PDF_DATA_URL, "PNG", margem, y - 12, logoLargura, 37);
  } catch {
    /* sem logo, segue sem imagem */
  }
  const textoX = margem + logoLargura + 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(TITULO, textoX, y);
  y += 20;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(SUBTITULO, textoX, y);
  y += 16;
  doc.text(dataPorExtenso(new Date()), margem, y);
  y += 24;

  const lista = ordenarMedicamentos(medicamentos);

  doc.setFontSize(11);
  const ALTURA_LINHA = 16;

  for (const m of lista) {
    espaco(ALTURA_LINHA * 3);

    const nome = normalizarNomeMedicamento(m.nome);
    const menor = m.nomeMenor?.trim() ? `${normalizarNomeMedicamento(m.nomeMenor)} ` : "";
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    for (const l of doc.splitTextToSize(`${menor}${nome}`, largura) as string[]) {
      espaco(ALTURA_LINHA);
      doc.text(l, margem, y);
      y += ALTURA_LINHA;
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);

    const detalhes: string[] = [];
    if (m.classificacao?.trim()) detalhes.push(m.classificacao.trim());
    if (m.concentracaoValor?.trim())
      detalhes.push(`Concentração: ${m.concentracaoValor} ${m.concentracaoUnidade}`);
    const vias = viasDe(m);
    if (vias.length > 0) detalhes.push(`Via: ${vias.join(", ")}`);
    if (m.especial) detalhes.push("Medicação especial");
    detalhes.push(...linhasDose(m));
    if (m.resumo?.trim()) detalhes.push(`Obs.: ${m.resumo.trim()}`);

    for (const d of detalhes) {
      for (const l of doc.splitTextToSize(d, largura - 14) as string[]) {
        espaco(ALTURA_LINHA);
        doc.text(l, margem + 14, y);
        y += ALTURA_LINHA;
      }
    }

    y += 8;
  }

  if (lista.length === 0) {
    doc.text("Nenhuma medicação cadastrada.", margem, y);
  }

  doc.save("Medicações Veterício.pdf");
}
