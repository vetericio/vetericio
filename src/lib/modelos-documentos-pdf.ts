import type { jsPDF } from "jspdf";
import { COR_QUADROS_PADRAO, urlFundoDocumento, type IdentidadeDocumento, type ModeloDocumentoPadrao } from "@/lib/modelos-documentos";

export type PapelDocumento = {
  clinica: IdentidadeDocumento;
  fundo: Uint8Array | null;
  logo: string;
  protegerLeitura?: boolean;
  corQuadros?: string;
};

export async function carregarLogoDocumento(url: string): Promise<string> {
  const caminho = url.replace(/^https:\/\/oricse\.com\.br(?=\/api\/public\/clinic-image\?)/i, "");
  const imagem = new Image();
  imagem.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => {
    imagem.onload = () => resolve();
    imagem.onerror = () => reject(new Error("Não foi possível carregar a logo da clínica."));
    imagem.src = caminho;
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

export async function prepararLogoDocumento(clinica: IdentidadeDocumento, usarLogo: boolean) {
  if (!usarLogo) return "";
  for (const fonte of [clinica.logoUrl, clinica.logoAlternativa]) {
    if (!fonte) continue;
    const logo = await carregarLogoDocumento(fonte).catch(() => "");
    if (logo) return logo;
  }
  return "";
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
    prepararLogoDocumento(clinica, modelo.usarLogo),
  ]);
  return { clinica, fundo, logo, corQuadros: modelo.corQuadros, protegerLeitura: ["04", "05", "07", "08", "09", "10"].includes(modelo.fundo) };
}

export function desenharPapelDocumento(pdf: jsPDF, papel: PapelDocumento) {
  const largura = pdf.internal.pageSize.getWidth();
  const altura = pdf.internal.pageSize.getHeight();
  if (papel.fundo) {
    pdf.addImage(papel.fundo, "JPEG", 0, 0, largura, altura, "fundo-documento");
    if (!papel.protegerLeitura) return;
    pdf.saveGraphicsState();
    pdf.setGState(pdf.GState({ opacity: 0.78, "stroke-opacity": 1 }));
    pdf.setFillColor("#ffffff");
    pdf.roundedRect(largura * 0.065, altura * 0.053, largura * 0.87, altura * 0.894,
      largura * 0.018, largura * 0.018, "F");
    pdf.restoreGraphicsState();
  }
}

export type IdentificacaoDocumento = {
  paciente: {
    nome: string; especie?: string; raca?: string; idade?: string; peso?: string;
    sexo?: string; microchip?: string; pelagem?: string; castrado?: string; outros?: string;
  };
  tutor: { nome?: string; cpf?: string; nascimento?: string; telefone?: string; endereco?: string };
};

export function desenharIdentidadeDocumento(pdf: jsPDF, papel: PapelDocumento, margem: number, inicio: number, fator = 1) {
  const { clinica, logo } = papel;
  const largura = pdf.internal.pageSize.getWidth() - margem * 2;
  const recuo = logo ? 35 * fator : 0;
  if (logo) {
    const imagem = pdf.getImageProperties(logo);
    const escala = Math.min(28 * fator / imagem.width, 26 * fator / imagem.height);
    pdf.addImage(logo, "PNG", margem, inicio - 4 * fator, imagem.width * escala, imagem.height * escala, "logo-clinica");
  }
  const centro = margem + recuo + (largura - recuo) / 2;
  let y = inicio;
  function texto(valor: string, tamanho: number, negrito: boolean, passo: number) {
    pdf.setFont("helvetica", negrito ? "bold" : "normal");
    pdf.setFontSize(tamanho);
    pdf.setTextColor(0);
    for (const linha of pdf.splitTextToSize(valor, largura - recuo) as string[]) {
      pdf.text(linha, centro, y, { align: "center" });
      y += passo * fator;
    }
  }
  texto(clinica.nome, 13, true, 5.5);
  [
    clinica.razaoSocial !== clinica.nome ? clinica.razaoSocial : "",
    [clinica.endereco, clinica.telefone].filter(Boolean).join(" · "),
    [clinica.cnpj && `CNPJ ${clinica.cnpj}`, clinica.crmv && `Registro CRMV ${clinica.crmv}`].filter(Boolean).join(" · "),
    [clinica.email, clinica.site].filter(Boolean).join(" · "),
  ].filter(Boolean).forEach(linha => texto(linha, 9, false, 4.2));
  return Math.max(y, inicio + 23 * fator) + 3 * fator;
}

export function desenharIdentificacaoDocumento(
  pdf: jsPDF, { paciente, tutor }: IdentificacaoDocumento, margem: number, topo: number, fator = 1, cor = COR_QUADROS_PADRAO,
  estilo?: "receita",
) {
  const receita = estilo === "receita";
  const espaco = 7 * fator;
  const largura = (pdf.internal.pageSize.getWidth() - margem * 2 - espaco) / 2;
  type Campo = readonly [string, string?];
  const linhasPaciente: Campo[][] = receita ? [
    [["Nome", paciente.nome]],
    [["Espécie", paciente.especie], ["Peso", paciente.peso]],
    [["Raça", paciente.raca], ["Idade", paciente.idade]],
    [["Sexo", paciente.sexo]],
    [["Pelagem", paciente.pelagem], ["Castrado", paciente.castrado]],
    [["Microchip", paciente.microchip]],
    [["Outros identificadores", paciente.outros]],
  ] : [
    [["Nome", paciente.nome]],
    [["Espécie", paciente.especie], ["Raça", paciente.raca]],
    [["Idade", paciente.idade], ["Peso", paciente.peso]],
    [["Sexo", paciente.sexo]],
    [["Microchip", paciente.microchip]],
    [["Pelagem", paciente.pelagem]],
    [["Outros identificadores", paciente.outros]],
  ];
  const colunas: { titulo: string; linhas: Campo[][] }[] = [
    { titulo: "PACIENTE", linhas: linhasPaciente },
    { titulo: "TUTOR", linhas: [
      [["Nome", tutor.nome]], [[receita ? "CPF/CNPJ" : "CPF", tutor.cpf]], [["Data de nascimento", tutor.nascimento]],
      [["Telefone", tutor.telefone]], [["Endereço", tutor.endereco]],
    ] },
  ];
  const passo = 4.4 * fator;
  const margemInterna = (receita ? 4 : 3) * fator;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  const conteudos = colunas.map(({ linhas }) => linhas.map(linha => {
    const campos = linha.filter(([, valor]) => valor?.trim());
    const coluna = (largura - margemInterna * 2) / (campos.length || 1);
    const valores = campos.map(([rotulo, valor]) =>
      pdf.splitTextToSize(`${rotulo}: ${valor}`, coluna - (campos.length > 1 ? 2 * fator : 0)) as string[]);
    return { coluna, valores, altura: Math.max(0, ...valores.map(valor => valor.length)) * passo };
  }));
  const altura = Math.max((receita ? 28 : 38) * fator, (receita ? 16 : 12) * fator +
    Math.max(...conteudos.map(linhas => linhas.reduce((total, linha) => total + linha.altura, 0))));
  const [r, g, b] = [1, 3, 5].map(inicio => {
    const canal = parseInt(cor.slice(inicio, inicio + 2), 16) / 255;
    return canal <= 0.04045 ? canal / 12.92 : ((canal + 0.055) / 1.055) ** 2.4;
  });
  const luminancia = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const corTexto = luminancia >= 0.179 ? 0 : 255;
  colunas.forEach(({ titulo }, indice) => {
    const x = margem + indice * (largura + espaco);
    if (receita) {
      pdf.setFillColor("#fcfcfa");
      pdf.setDrawColor("#d7ddda");
      pdf.setLineWidth(0.2 * fator);
      pdf.roundedRect(x, topo, largura, altura, 2.6 * fator, 2.6 * fator, "FD");
      pdf.setDrawColor(cor);
      pdf.setLineWidth(0.6 * fator);
      pdf.line(x + margemInterna, topo + 8.2 * fator, x + largura - margemInterna, topo + 8.2 * fator);
      pdf.setTextColor("#203630");
    } else {
      pdf.setFillColor(cor);
      pdf.rect(x, topo, largura, altura, "F");
      pdf.setTextColor(corTexto);
    }
    pdf.setFont("helvetica", "bold");
    pdf.text(titulo, receita ? x + margemInterna : x + largura / 2, topo + (receita ? 6 : 5.3) * fator,
      { align: receita ? "left" : "center" });
    pdf.setFont("helvetica", "normal");
    let y = topo + (receita ? 13.8 : 11) * fator;
    for (const linha of conteudos[indice]) {
      linha.valores.forEach((valor, coluna) => valor.forEach((texto, n) =>
        pdf.text(texto, x + margemInterna + coluna * linha.coluna, y + n * passo)));
      y += linha.altura;
    }
  });
  pdf.setTextColor(0);
  return topo + altura + 7 * fator;
}

export async function criarPdfComModelo({
  titulo, conteudo, papel, demonstrativo = false, identificacao, assinatura = [], fundoSemIdentidade = null,
}: {
  titulo: string; conteudo: string; papel: PapelDocumento | null; demonstrativo?: boolean; fundoSemIdentidade?: PapelDocumento | null;
  identificacao?: IdentificacaoDocumento; assinatura?: string[];
}) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  pdf.setProperties({ title: titulo });
  const margem = 13;
  const largura = pdf.internal.pageSize.getWidth() - margem * 2;
  const centro = margem + largura / 2;
  let y = 22;
  function iniciarPagina() {
    const fundo = papel || fundoSemIdentidade;
    if (fundo) desenharPapelDocumento(pdf, fundo);
    y = papel ? desenharIdentidadeDocumento(pdf, papel, margem, 23) : 23;
    if (demonstrativo) {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8.5);
      pdf.setTextColor(0);
      pdf.text("PRÉVIA DEMONSTRATIVA · SEM VALIDADE", centro, y, { align: "center" });
      y += 6;
    }
  }
  function definirFonte(negrito: boolean, tamanho: number) {
    pdf.setFont("helvetica", negrito ? "bold" : "normal");
    pdf.setFontSize(tamanho);
    pdf.setTextColor(0);
  }
  function escrever(texto: string, negrito = false, tamanho = 10.5) {
    definirFonte(negrito, tamanho);
    const linhas = pdf.splitTextToSize(texto || " ", largura) as string[];
    for (const linha of linhas) {
      if (y > 273) { pdf.addPage(); iniciarPagina(); }
      definirFonte(negrito, tamanho);
      pdf.text(linha, margem, y);
      y += tamanho > 14 ? 9 : 5;
    }
  }
  iniciarPagina();
  if (identificacao) y = desenharIdentificacaoDocumento(pdf, identificacao, margem, y, 1, (papel ?? fundoSemIdentidade)?.corQuadros);
  escrever(titulo, true, 19);
  y += 3;
  for (const linha of conteudo.split("\n")) escrever(linha);
  if (assinatura.length) {
    definirFonte(false, 10);
    const [data, ...profissional] = assinatura;
    const linhas = profissional.filter(Boolean).flatMap(texto => pdf.splitTextToSize(texto, largura) as string[]);
    if (y + 24 + linhas.length * 5 > 273) { pdf.addPage(); iniciarPagina(); }
    y += 7;
    definirFonte(false, 10);
    if (data) pdf.text(data, centro, y, { align: "center" });
    y += 12;
    pdf.setDrawColor(90);
    pdf.line(centro - 30, y, centro + 30, y);
    y += 5;
    pdf.text("Assinatura do médico-veterinário", centro, y, { align: "center" });
    for (const linha of linhas) {
      y += 5;
      pdf.text(linha, centro, y, { align: "center" });
    }
  }
  return pdf;
}
