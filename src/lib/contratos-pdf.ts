export type DadosContrato = Record<string, string>;

export const CAMPOS_CONTRATO_BETA = [
  "razao_social_nome",
  "cpf_cnpj",
  "endereco_parceiro",
  "email",
  "telefone_whatsapp",
  "representante_legal",
  "cpf_representante",
  "data_nascimento",
  "endereco_representante",
] as const;

export function extrairCamposContrato(conteudo: string) {
  const encontrados = new Set<string>();
  const regex = /{{\s*([a-zA-ZÀ-ÿ][a-zA-ZÀ-ÿ0-9_-]{1,80})\s*}}/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(conteudo))) encontrados.add(match[1]);
  return [...encontrados];
}

export function rotuloCampoContrato(campo: string) {
  const rotulos: Record<string, string> = {
    razao_social_nome: "Razão social ou nome",
    cpf_cnpj: "CPF/CNPJ",
    endereco_parceiro: "Endereço",
    email: "E-mail",
    telefone_whatsapp: "Telefone/WhatsApp",
    representante_legal: "Representado por — nome",
    cpf_representante: "Representado por — CPF",
    data_nascimento: "Representado por — data de nascimento",
    endereco_representante: "Representado por — endereço",
    data_contrato: "Data do contrato",
  };
  if (rotulos[campo]) return rotulos[campo];
  return campo.replaceAll("_", " ").replace(/\b\w/g, (letra) => letra.toUpperCase());
}

function valorParaDocumento(campo: string, valor: string | undefined) {
  if (!valor) return "";
  if (campo.toLowerCase().includes("data") && /^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    const [ano, mes, dia] = valor.split("-");
    return `${dia}/${mes}/${ano}`;
  }
  return valor;
}

export function preencherModeloContrato(conteudo: string, dados: DadosContrato) {
  return conteudo.replace(
    /{{\s*([a-zA-ZÀ-ÿ][a-zA-ZÀ-ÿ0-9_-]{1,80})\s*}}/g,
    (_texto, campo: string) => valorParaDocumento(campo, dados[campo]),
  );
}

export function nomeSeguroContrato(nome: string) {
  return (
    nome
      .trim()
      .replace(/[^a-zA-ZÀ-ÿ0-9 _-]/g, "")
      .replace(/\s+/g, " ")
      .slice(0, 100) || "Contrato"
  );
}

function dataAtualContrato() {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
}

function textoDados(dados: DadosContrato, campo: string) {
  return valorParaDocumento(campo, dados[campo]) || "[não informado]";
}

function linhaParceiroBeta(dados: DadosContrato) {
  return `PARCEIRO BETA: ${textoDados(dados, "razao_social_nome")}, CPF/CNPJ nº ${textoDados(dados, "cpf_cnpj")}, endereço ${textoDados(dados, "endereco_parceiro")}, e-mail ${textoDados(dados, "email")}, telefone/WhatsApp ${textoDados(dados, "telefone_whatsapp")}, neste ato representado por ${textoDados(dados, "representante_legal")}, CPF nº ${textoDados(dados, "cpf_representante")}, data de nascimento ${textoDados(dados, "data_nascimento")}, endereço ${textoDados(dados, "endereco_representante")}.`;
}

async function asBytes(dataUriOrUrl: string) {
  if (!dataUriOrUrl.startsWith("data:")) {
    const resposta = await fetch(new URL(dataUriOrUrl, window.location.origin));
    if (!resposta.ok) throw new Error("Não foi possível carregar o modelo PDF.");
    return new Uint8Array(await resposta.arrayBuffer());
  }
  const base64 = dataUriOrUrl.replace(/^data:application\/pdf;base64,/, "");
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function quebrarTexto(texto: string, fonte: { widthOfTextAtSize: (texto: string, tamanho: number) => number }, tamanho: number, largura: number) {
  const palavras = texto.split(/\s+/);
  const linhas: string[] = [];
  let atual = "";
  for (const palavra of palavras) {
    const candidato = atual ? `${atual} ${palavra}` : palavra;
    if (atual && fonte.widthOfTextAtSize(candidato, tamanho) > largura) {
      linhas.push(atual);
      atual = palavra;
    } else {
      atual = candidato;
    }
  }
  if (atual) linhas.push(atual);
  return linhas;
}

async function gerarPdfComModelo(templatePdfBase64: string, dados: DadosContrato) {
  const { PDFDocument, beginText, endText, rgb, setCharacterSpacing, setWordSpacing } = await import("pdf-lib");
  const { default: fontkit } = await import("@pdf-lib/fontkit");
  const pdf = await PDFDocument.load(await asBytes(templatePdfBase64));
  pdf.registerFontkit(fontkit);
  const fonteResponse = await fetch(new URL("/fonts/Arial-v2.ttf", window.location.origin));
  if (!fonteResponse.ok) throw new Error("Não foi possível carregar a fonte do contrato.");
  const fonte = await pdf.embedFont(await fonteResponse.arrayBuffer(), { subset: true });
  const tamanho = 9.5;
  const paginaInicial = pdf.getPage(0);
  const altura = paginaInicial.getHeight();
  paginaInicial.pushOperators(beginText(), setCharacterSpacing(0), setWordSpacing(0), endText());
  const limpar = (pagina: ReturnType<typeof pdf.getPage>, x: number, y: number, width: number, height: number) => {
    pagina.drawRectangle({ x, y, width, height, color: rgb(1, 1, 1) });
  };
  const desenharLinhas = (pagina: ReturnType<typeof pdf.getPage>, linhas: string[], x: number, y: number, largura: number, espacamento = 12.5) => {
    linhas.forEach((linha, indice) => {
      pagina.drawText(linha, { x, y: y - indice * espacamento, size: tamanho, font: fonte, color: rgb(0.12, 0.12, 0.12) });
    });
  };

  const parceiro = linhaParceiroBeta(dados);
  limpar(paginaInicial, 68, altura - 399, 480, 35);
  desenharLinhas(paginaInicial, quebrarTexto(parceiro, fonte, tamanho, 475), 73.8, altura - 379, 475);

  const paginaFinal = pdf.getPage(pdf.getPageCount() - 1);
  const alturaFinal = paginaFinal.getHeight();
  paginaFinal.pushOperators(beginText(), setCharacterSpacing(0), setWordSpacing(0), endText());
  limpar(paginaFinal, 70, alturaFinal - 420, 220, 24);
  paginaFinal.drawText(`Belo Horizonte/MG, ${dataAtualContrato()}`, {
    x: 73.8,
    y: alturaFinal - 415,
    size: tamanho,
    font: fonte,
    color: rgb(0.12, 0.12, 0.12),
  });
  limpar(paginaFinal, 70, alturaFinal - 662, 465, 28);
  paginaFinal.drawText(
    `Empresa: ${textoDados(dados, "razao_social_nome")} / ${textoDados(dados, "cpf_cnpj")}`,
    {
      x: 73.8,
      y: alturaFinal - 647,
      size: tamanho,
      font: fonte,
      color: rgb(0.12, 0.12, 0.12),
    },
  );
  paginaFinal.drawText(
    `Representante: ${textoDados(dados, "representante_legal")} / ${textoDados(dados, "cpf_representante")}`,
    {
      x: 73.8,
      y: alturaFinal - 660,
      size: tamanho,
      font: fonte,
      color: rgb(0.12, 0.12, 0.12),
    },
  );
  const bytes = await pdf.save();
  let binary = "";
  for (let indice = 0; indice < bytes.length; indice += 0x8000) binary += String.fromCharCode(...bytes.subarray(indice, indice + 0x8000));
  return `data:application/pdf;base64,${btoa(binary)}`;
}

export async function gerarPdfContrato(
  titulo: string,
  conteudo: string,
  dados: DadosContrato,
  templatePdfBase64?: string | null,
) {
  if (templatePdfBase64) return gerarPdfComModelo(templatePdfBase64, dados);
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margem = 54;
  const largura = 595.28;
  const larguraTexto = largura - margem * 2;
  const linhas = doc.splitTextToSize(
    preencherModeloContrato(conteudo, dados),
    larguraTexto,
  ) as string[];
  doc.setTextColor(74, 24, 38);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(titulo, margem, 62);
  doc.setDrawColor(190, 146, 158);
  doc.line(margem, 78, largura - margem, 78);
  doc.setTextColor(45, 34, 39);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  let y = 105;
  for (const linha of linhas) {
    if (y > 790) {
      doc.addPage();
      y = 54;
    }
    doc.text(linha, margem, y);
    y += 16;
  }
  doc.setFontSize(8);
  doc.setTextColor(125, 111, 117);
  doc.text("Documento gerado pela Oricse — versão sem assinatura", margem, 815);
  return `data:application/pdf;base64,${doc.output("datauristring").split(",")[1] || ""}`;
}

export function baixarPdfContrato(dataUri: string, nomeArquivo: string) {
  const link = document.createElement("a");
  link.href = dataUri;
  link.download = nomeArquivo;
  link.click();
}

export function lerArquivoComoDataUri(arquivo: File) {
  return new Promise<string>((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result || ""));
    leitor.onerror = () => reject(new Error("Não foi possível ler o PDF."));
    leitor.readAsDataURL(arquivo);
  });
}
