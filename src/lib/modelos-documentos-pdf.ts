import type { jsPDF } from "jspdf";
import { urlFundoDocumento, type IdentidadeDocumento, type ModeloDocumentoPadrao } from "@/lib/modelos-documentos";

export type PapelDocumento = {
  clinica: IdentidadeDocumento;
  fundo: Uint8Array | null;
  logo: string;
};

export async function carregarLogoDocumento(url: string): Promise<string> {
  const imagem = new Image();
  imagem.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => {
    imagem.onload = () => resolve();
    imagem.onerror = () => reject(new Error("Não foi possível carregar a logo da clínica."));
    imagem.src = url;
  });
  const escala = Math.min(1, 480 / Math.max(imagem.naturalWidth, imagem.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(imagem.naturalWidth * escala));
  canvas.height = Math.max(1, Math.round(imagem.naturalHeight * escala));
  const contexto = canvas.getContext("2d");
  if (!contexto) throw new Error("Não foi possível preparar a logo da clínica.");
  contexto.drawImage(imagem, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

export async function prepararPapelDocumento(clinica: IdentidadeDocumento, modelo: ModeloDocumentoPadrao): Promise<PapelDocumento> {
  const url = urlFundoDocumento(modelo.fundo);
  const [fundo, logo] = await Promise.all([
    url ? fetch(url).then(async (resposta) => {
      if (!resposta.ok || !resposta.headers.get("content-type")?.includes("image/jpeg")) {
        throw new Error("Não foi possível carregar o fundo selecionado.");
      }
      return new Uint8Array(await resposta.arrayBuffer());
    }) : null,
    modelo.usarLogo && clinica.logoUrl ? carregarLogoDocumento(clinica.logoUrl).catch(() => "") : "",
  ]);
  return { clinica, fundo, logo };
}

export function desenharPapelDocumento(pdf: jsPDF, papel: PapelDocumento) {
  const largura = pdf.internal.pageSize.getWidth();
  const altura = pdf.internal.pageSize.getHeight();
  if (papel.fundo) {
    pdf.addImage(papel.fundo, "JPEG", 0, 0, largura, altura, "fundo-documento");
    pdf.saveGraphicsState();
    pdf.setGState(pdf.GState({ opacity: 0.78, "stroke-opacity": 1 }));
    pdf.setFillColor("#ffffff");
    pdf.roundedRect(largura * 0.065, altura * 0.053, largura * 0.87, altura * 0.894,
      largura * 0.018, largura * 0.018, "F");
    pdf.restoreGraphicsState();
  }
}

export function desenharIdentidadeDocumento(pdf: jsPDF, papel: PapelDocumento, margem: number, inicio: number, fator = 1) {
  const { clinica, logo } = papel;
  const largura = pdf.internal.pageSize.getWidth() - margem * 2;
  let recuo = 0;
  if (logo) {
    const imagem = pdf.getImageProperties(logo);
    const escala = Math.min(26 * fator / imagem.width, 19 * fator / imagem.height);
    pdf.addImage(logo, "PNG", margem, inicio - 4 * fator, imagem.width * escala, imagem.height * escala, "logo-clinica");
    recuo = 30 * fator;
  }
  let y = inicio;
  function texto(valor: string, tamanho: number, negrito: boolean, passo: number) {
    pdf.setFont("helvetica", negrito ? "bold" : "normal");
    pdf.setFontSize(tamanho);
    pdf.setTextColor(negrito ? "#612b40" : "#29262a");
    for (const linha of pdf.splitTextToSize(valor, largura - recuo) as string[]) {
      pdf.text(linha, margem + recuo, y);
      y += passo * fator;
    }
  }
  texto(clinica.nome, 14, true, 6);
  [
    [clinica.razaoSocial !== clinica.nome ? clinica.razaoSocial : "", clinica.cnpj && `CNPJ ${clinica.cnpj}`, clinica.crmv && `Registro CRMV ${clinica.crmv}`].filter(Boolean).join(" · "),
    clinica.endereco,
    [clinica.telefone, clinica.email].filter(Boolean).join(" · "),
  ].filter(Boolean).forEach(linha => texto(linha, 9, false, 4.5));
  pdf.setTextColor(0);
  return Math.max(y, inicio + (logo ? 17 * fator : 0)) + 6 * fator;
}

export async function criarPdfComModelo({
  titulo, conteudo, papel, demonstrativo = false, identificacao = [], assinatura = [],
}: {
  titulo: string; conteudo: string; papel: PapelDocumento; demonstrativo?: boolean;
  identificacao?: string[]; assinatura?: string[];
}) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  pdf.setProperties({ title: titulo });
  const margem = 19;
  let y = 21;
  function novaPagina() {
    desenharPapelDocumento(pdf, papel);
    y = desenharIdentidadeDocumento(pdf, papel, margem, 24);
    if (demonstrativo) {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8.5);
      pdf.setTextColor("#612b40");
      pdf.text("PRÉVIA DEMONSTRATIVA · SEM VALIDADE", margem, y);
      y += 8;
    }
  }
  function escrever(texto: string, negrito = false, tamanho = 11) {
    pdf.setFont("helvetica", negrito ? "bold" : "normal");
    pdf.setFontSize(tamanho);
    const linhas = pdf.splitTextToSize(texto || " ", 210 - margem * 2) as string[];
    for (const linha of linhas) {
      if (y > 274) { pdf.addPage(); novaPagina(); }
      pdf.setFont("helvetica", negrito ? "bold" : "normal");
      pdf.setFontSize(tamanho);
      pdf.setTextColor(negrito ? "#612b40" : "#252328");
      pdf.text(linha, margem, y);
      y += tamanho > 14 ? 9 : 5.5;
    }
  }
  novaPagina();
  escrever(titulo, true, 19);
  for (const linha of identificacao.filter(Boolean)) escrever(linha);
  y += 5;
  for (const linha of conteudo.split("\n")) escrever(linha);
  if (assinatura.length) {
    if (y > 241) { pdf.addPage(); novaPagina(); }
    y += 12;
    escrever("________________________________________");
    for (const linha of assinatura.filter(Boolean)) escrever(linha);
  }
  return pdf;
}
