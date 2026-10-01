import type { jsPDF as DocumentoPDF } from "jspdf";
import { LOGO_PDF_DATA_URL } from "./logo";
import { lerSelo } from "./assinatura";

export const ENDERECO_RECEITUARIO =
  "Rua Tenente Marino Freire, 444 - Paraúna / Belo Horizonte - MG\n31680-120";

export type ItemReceituario = {
  id: string;
  medicamento: string;
  posologia: string;
};

export type DadosReceituario = {
  paciente: string;
  especie: string;
  peso: string;
  tutor: string;
  data: string;
  itens: ItemReceituario[];
  observacoes: string;
  endereco: string;
};

const DADOS_PROFISSIONAL = [
  "Dr. Fabrício Fernando Jesus Gonçalves",
  "Médico-Veterinário · CRMV-MG 34.538",
  "MAPA MV00816392025 · CNPJ 67.995.338/0001-76",
  "Veterício Serviços Veterinários Ltda.",
];

function desenharSelo(
  doc: DocumentoPDF,
  imagem: string,
  x: number,
  y: number,
  largura: number,
  altura: number,
) {
  const props = doc.getImageProperties(imagem);
  const escala = Math.min(largura / props.width, altura / props.height);
  doc.addImage(
    imagem,
    props.fileType,
    x,
    y + altura - props.height * escala,
    props.width * escala,
    props.height * escala,
  );
}

export async function criarReceituario(dados: DadosReceituario) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margem = 46;
  const largura = doc.internal.pageSize.getWidth() - margem * 2;
  const altura = doc.internal.pageSize.getHeight();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const endereco = doc.splitTextToSize(dados.endereco.trim(), largura) as string[];
  const rodapeY = altura - margem - Math.max(endereco.length, 1) * 12 - 8;
  const assinaturaY = rodapeY - 100;
  const limiteConteudo = assinaturaY - 20;
  let y = margem;

  const cabecalho = () => {
    y = margem;
    doc.setTextColor(0);
    doc.addImage(LOGO_PDF_DATA_URL, "JPEG", margem, y - 8, 45, 49);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text("VETERÍCIO", margem + 56, y + 8);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    DADOS_PROFISSIONAL.forEach((linha, indice) =>
      doc.text(linha, margem + 56, y + 22 + indice * 10),
    );
    y += 66;
    doc.setDrawColor(20, 130, 116);
    doc.setLineWidth(1.2);
    doc.line(margem, y, margem + largura, y);
    y += 28;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("RECEITUÁRIO VETERINÁRIO", margem, y);
    y += 22;

    doc.setFontSize(11);
    const linhas = (texto: string, max: number) =>
      doc.splitTextToSize(texto || "-", max) as string[];
    const paciente = linhas(dados.paciente, 245);
    const especie = linhas(dados.especie, 115);
    const peso = linhas(dados.peso ? `${dados.peso} kg` : "", largura - 407);
    const tutor = linhas(dados.tutor, 365);
    const data = linhas(dados.data, largura - 407);
    const primeiraAltura = 25 + Math.max(paciente.length, especie.length, peso.length) * 14;
    const segundaAltura = 25 + Math.max(tutor.length, data.length) * 14;

    doc.setFillColor(242, 245, 244);
    doc.roundedRect(margem, y, largura, primeiraAltura + segundaAltura, 7, 7, "F");
    const celula = (rotulo: string, valor: string[], x: number, topo: number) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(90);
      doc.text(rotulo, x, topo + 15);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(0);
      valor.forEach((linha, indice) => doc.text(linha, x, topo + 29 + indice * 14));
    };
    celula("PACIENTE", paciente, margem + 12, y);
    celula("ESPÉCIE", especie, margem + 270, y);
    celula("PESO", peso, margem + 395, y);
    celula("TUTOR", tutor, margem + 12, y + primeiraAltura);
    celula("DATA", data, margem + 395, y + primeiraAltura);
    y += primeiraAltura + segundaAltura + 27;
  };

  const novaPagina = () => {
    doc.addPage();
    cabecalho();
  };
  const escrever = (texto: string, recuo = 0, negrito = false) => {
    doc.setFont("helvetica", negrito ? "bold" : "normal");
    doc.setFontSize(11);
    const linhas = doc.splitTextToSize(texto, largura - recuo) as string[];
    linhas.forEach((linha) => {
      if (y + 16 > limiteConteudo) novaPagina();
      doc.setFont("helvetica", negrito ? "bold" : "normal");
      doc.setFontSize(11);
      doc.text(linha, margem + recuo, y);
      y += 16;
    });
  };

  cabecalho();
  escrever("Prescrição", 0, true);
  y += 7;
  dados.itens
    .filter((item) => item.medicamento.trim() || item.posologia.trim())
    .forEach((item, indice) => {
      if (y + 48 > limiteConteudo) novaPagina();
      escrever(`${indice + 1}. ${item.medicamento.trim() || "Orientação"}`, 0, true);
      if (item.posologia.trim()) escrever(item.posologia.trim(), 18);
      y += 12;
    });
  if (dados.observacoes.trim()) {
    if (y + 48 > limiteConteudo) novaPagina();
    escrever("Orientações", 0, true);
    y += 5;
    escrever(dados.observacoes.trim());
  }

  const assinatura = lerSelo("assinatura");
  const carimbo = lerSelo("carimbo");
  if (assinatura) desenharSelo(doc, assinatura, margem, assinaturaY, 165, 54);
  if (carimbo) desenharSelo(doc, carimbo, margem + 190, assinaturaY, 170, 54);
  doc.setDrawColor(80);
  doc.setLineWidth(0.6);
  doc.line(margem, assinaturaY + 66, margem + 360, assinaturaY + 66);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Assinatura e carimbo", margem, assinaturaY + 80);

  for (let pagina = 1; pagina <= doc.getNumberOfPages(); pagina++) {
    doc.setPage(pagina);
    doc.setDrawColor(20, 130, 116);
    doc.setLineWidth(0.8);
    doc.line(margem, rodapeY, margem + largura, rodapeY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    endereco.forEach((linha, indice) =>
      doc.text(linha, margem + largura / 2, rodapeY + 14 + indice * 12, { align: "center" }),
    );
  }
  return doc;
}

export async function baixarReceituario(dados: DadosReceituario) {
  const doc = await criarReceituario(dados);
  const paciente = dados.paciente.trim().replace(/\s+/g, "-").toLowerCase();
  doc.save(`receituario-${paciente || "vetericio"}.pdf`);
}
