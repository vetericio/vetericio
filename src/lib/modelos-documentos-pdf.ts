import type { jsPDF } from "jspdf";
import { quebrarAntesDaLinhaFinal } from "@/lib/paginacao-assinaturas";
import { COR_QUADROS_PADRAO, formatarDataExtensoDocumento, obterTemaDocumentoPremium, urlFundoDocumento, type IdentidadeDocumento, type ModeloDocumentoPadrao, type TemaDocumentoPremium } from "@/lib/modelos-documentos";

export type PapelDocumento = {
  clinica: IdentidadeDocumento;
  fundo: Uint8Array | null;
  logo: string;
  protegerLeitura?: boolean;
  corQuadros?: string;
  tema?: TemaDocumentoPremium | null;
};

export async function carregarLogoDocumento(url: string, removerFundoBranco = false): Promise<string> {
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
  if (!removerFundoBranco) return canvas.toDataURL("image/png");

  // Só nos temas premium. Remove o branco conectado às bordas do arquivo;
  // brancos internos ao símbolo e áreas coloridas não são apagados.
  // O arquivo original da clínica jamais é modificado.
  try {
    const { width: w, height: h } = canvas;
    const pixels = contexto.getImageData(0, 0, w, h);
    const d = pixels.data;
    const total = w * h;
    const branco = (indice: number) => {
      const p = indice * 4;
      const r = d[p], g = d[p + 1], b = d[p + 2];
      return d[p + 3] >= 20 && r >= 236 && g >= 236 && b >= 236 &&
        Math.max(r, g, b) - Math.min(r, g, b) <= 17;
    };
    let amostras = 0;
    let brancas = 0;
    for (let x = 0; x < w; x++) {
      for (const indice of [x, (h - 1) * w + x]) {
        if (d[indice * 4 + 3] < 20) continue;
        amostras++;
        if (branco(indice)) brancas++;
      }
    }
    for (let y = 1; y < h - 1; y++) {
      for (const indice of [y * w, y * w + w - 1]) {
        if (d[indice * 4 + 3] < 20) continue;
        amostras++;
        if (branco(indice)) brancas++;
      }
    }
    // Não interfere em logos de fundo colorido, com transparência real
    // ou com bordas brancas apenas decorativas.
    if (amostras > 0 && brancas / amostras >= 0.72) {
      const vistos = new Uint8Array(total);
      const fila = new Uint32Array(total);
      let inicio = 0, fim = 0;
      const colocar = (indice: number) => {
        if (vistos[indice] || !branco(indice)) return;
        vistos[indice] = 1;
        fila[fim++] = indice;
      };
      for (let x = 0; x < w; x++) { colocar(x); colocar((h - 1) * w + x); }
      for (let y = 0; y < h; y++) { colocar(y * w); colocar(y * w + w - 1); }
      while (inicio < fim) {
        const indice = fila[inicio++];
        d[indice * 4 + 3] = 0;
        const x = indice % w;
        if (x > 0) colocar(indice - 1);
        if (x < w - 1) colocar(indice + 1);
        if (indice >= w) colocar(indice - w);
        if (indice + w < total) colocar(indice + w);
      }
      contexto.putImageData(pixels, 0, 0);
    }
    // Corta apenas a borda vazia para a marca usar melhor o espaço
    // disponível, sem distorcer nem alterar suas proporções.
    const recorte = contexto.getImageData(0, 0, w, h).data;
    let xMin = w, yMin = h, xMax = -1, yMax = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (recorte[(y * w + x) * 4 + 3] <= 12) continue;
      xMin = Math.min(xMin, x); xMax = Math.max(xMax, x);
      yMin = Math.min(yMin, y); yMax = Math.max(yMax, y);
    }
    if (xMax < 0) return canvas.toDataURL("image/png");
    const margem = Math.max(2, Math.round(Math.min(w, h) * 0.01));
    xMin = Math.max(0, xMin - margem);
    yMin = Math.max(0, yMin - margem);
    xMax = Math.min(w - 1, xMax + margem);
    yMax = Math.min(h - 1, yMax + margem);
    const cortado = document.createElement("canvas");
    cortado.width = xMax - xMin + 1;
    cortado.height = yMax - yMin + 1;
    cortado.getContext("2d")?.drawImage(canvas, xMin, yMin, cortado.width, cortado.height,
      0, 0, cortado.width, cortado.height);
    return cortado.toDataURL("image/png");
  } catch {
    // Falha de leitura de pixels não deve impedir o receituário.
    return canvas.toDataURL("image/png");
  }
}

export async function prepararLogoDocumento(clinica: IdentidadeDocumento, usarLogo: boolean, removerFundoBranco = false) {
  if (!usarLogo) return "";
  for (const fonte of [clinica.logoUrl, clinica.logoAlternativa]) {
    if (!fonte) continue;
    const logo = await carregarLogoDocumento(fonte, removerFundoBranco).catch(() => "");
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
    prepararLogoDocumento(clinica, modelo.usarLogo, Boolean(obterTemaDocumentoPremium(modelo.fundo))),
  ]);
  return {
    clinica, fundo, logo, corQuadros: modelo.corQuadros,
    tema: obterTemaDocumentoPremium(modelo.fundo),
    protegerLeitura: ["04", "05", "07", "08", "09", "10"].includes(modelo.fundo),
  };
}


// Temas vetoriais: margens, cores e ornamentos permanecem nítidos no PDF A4.
// A logo e a identificação são inseridas separadamente para cada clínica.
function desenharTemaPremiumDocumento(pdf: jsPDF, tema: TemaDocumentoPremium) {
  const largura = pdf.internal.pageSize.getWidth();
  const altura = pdf.internal.pageSize.getHeight();
  const m = largura * 0.036;
  pdf.setFillColor(tema.papel);
  pdf.rect(0, 0, largura, altura, "F");
  if (tema.id === "13") {
    pdf.setFillColor("#111111");
    pdf.rect(0, 0, largura, altura * 0.006, "F");
    pdf.rect(0, altura * 0.992, largura, altura * 0.008, "F");

  } else if (tema.id === "14") {
    pdf.setDrawColor("#bc984f");
    pdf.setLineWidth(0.65);
    pdf.rect(m, altura * 0.013, largura - m * 2, altura * 0.967, "S");
    pdf.setLineWidth(0.25);
    pdf.rect(m * 1.25, altura * 0.018, largura - m * 2.5, altura * 0.957, "S");

  } else if (tema.id === "15") {
    pdf.setFillColor("#64243d");
    pdf.rect(0, 0, largura, altura * 0.052, "F");
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor("#ffffff");
    pdf.text("CUIDADO E PRECISÃO", largura - m, altura * 0.033, { align: "right" });
    pdf.setTextColor(tema.texto);
    pdf.setDrawColor("#d8abb9");
    pdf.setLineWidth(0.5);
    pdf.line(m, altura * 0.982, largura - m, altura * 0.982);
    for (let n = 0; n < 3; n++) {
      pdf.setDrawColor(n === 0 ? "#edd3d9" : "#e8c7d2");
      pdf.ellipse(largura * 0.965, altura * 0.175, largura * (0.06 + n * 0.03), altura * (0.022 + n * 0.01), "S");
    }
  } else if (tema.id === "16") {
    pdf.setFillColor("#00899a");
    pdf.rect(0, 0, largura, altura * 0.009, "F");

    pdf.setDrawColor("#d6eff0");
    pdf.setLineWidth(0.6);
    for (let n = 0; n < 3; n++) {
      pdf.ellipse(largura * 0.98, altura * (0.43 + n * 0.022), largura * 0.09, altura * 0.023, "S");
    }
  } else if (tema.id === "17") {
    pdf.setFillColor("#e9f0e7");
    pdf.roundedRect(m, altura * 0.022, largura - m * 2, altura * 0.084, m * 0.25, m * 0.25, "F");

    pdf.setDrawColor("#90ac93");
    pdf.setLineWidth(0.55);
    const bx = largura * 0.90, by = altura * 0.91;
    pdf.line(bx, by, bx + largura * 0.027, by - altura * 0.105);
    for (let n = 0; n < 5; n++) {
      const y = by - altura * (0.02 + n * 0.019);
      const x = bx + largura * (0.005 + n * 0.004);
      pdf.ellipse(x + (n % 2 ? 5 : -5), y, 5, 2.4, "S");
    }
  } else if (tema.id === "18") {
    pdf.setFillColor("#c97654");
    pdf.rect(0, 0, largura, altura * 0.01, "F");
    pdf.rect(0, altura * 0.989, largura, altura * 0.011, "F");

    pdf.setDrawColor("#edcdbf");
    pdf.setLineWidth(0.6);
    for (let n = 0; n < 3; n++) {
      pdf.ellipse(largura * 0.98, altura * 0.22, largura * (0.11 + n * 0.03), altura * (0.042 + n * 0.02), "S");
    }
  }
  pdf.setTextColor("#202020");
}

export function desenharPapelDocumento(pdf: jsPDF, papel: PapelDocumento) {
  const largura = pdf.internal.pageSize.getWidth();
  const altura = pdf.internal.pageSize.getHeight();
  if (papel.tema) {
    desenharTemaPremiumDocumento(pdf, papel.tema);
    return;
  }
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
  if (papel.tema) {
    const tema = papel.tema;
    const larguraPagina = pdf.internal.pageSize.getWidth();
    const alturaPagina = pdf.internal.pageSize.getHeight();
    const centro = larguraPagina / 2;
    const atelier = tema.id === "14";
    const topo = atelier ? inicio - 16 * fator
      : tema.id === "15" ? Math.max(inicio - 11 * fator, alturaPagina * 0.062)
      : inicio - 11 * fator;
    const maxLogoLargura = (atelier ? 25 : 30) * fator;
    const maxLogoAltura = (atelier ? 17 : 22) * fator;
    let larguraLogo = 0;
    let alturaLogo = 0;
    if (logo) {
      const imagem = pdf.getImageProperties(logo);
      const escala = Math.min(maxLogoLargura / imagem.width, maxLogoAltura / imagem.height);
      larguraLogo = imagem.width * escala;
      alturaLogo = imagem.height * escala;
      const logoX = atelier ? centro - larguraLogo / 2 : margem;
      // Não desenhar caixas, cartões nem fundo branco atrás da logo.
      // A versão PNG já vem com a transparência corrigida.
      pdf.addImage(logo, "PNG", logoX, topo, larguraLogo, alturaLogo, "logo-clinica");
    }
    const alinhamento = atelier ? "center" : "left";
    const xTexto = atelier ? centro : margem + (logo ? larguraLogo + 6 * fator : 0);
    const larguraTexto = atelier ? largura : larguraPagina - margem - xTexto;
    const nomeY = atelier ? topo + Math.max(alturaLogo, 17 * fator) + 5 * fator
      : topo + 6 * fator;

    pdf.setTextColor(tema.texto);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(atelier ? 11.8 : 13);
    const nomeLinhas = pdf.splitTextToSize(clinica.nome || clinica.razaoSocial || "Clínica veterinária", larguraTexto) as string[];
    const passoNome = (atelier ? 4.8 : 5.1) * fator;
    nomeLinhas.forEach((texto, indice) =>
      pdf.text(texto, xTexto, nomeY + indice * passoNome, { align: alinhamento }));

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.3);
    const detalhes = [
      clinica.razaoSocial && clinica.razaoSocial !== clinica.nome ? clinica.razaoSocial : "",
      [clinica.endereco, clinica.telefone].filter(Boolean).join(" · "),
      [clinica.cnpj && `CNPJ ${clinica.cnpj}`, clinica.crmv && `CRMV ${clinica.crmv}`].filter(Boolean).join(" · "),
      [clinica.email, clinica.site].filter(Boolean).join(" · "),
    ].filter(Boolean).flatMap(valor => pdf.splitTextToSize(valor, larguraTexto) as string[]);
    const passoDetalhe = 3.85 * fator;
    const detalhesY = nomeY + nomeLinhas.length * passoNome + 1 * fator;
    detalhes.forEach((texto, indice) =>
      pdf.text(texto, xTexto, detalhesY + indice * passoDetalhe, { align: alinhamento }));

    const fimTextos = detalhes.length
      ? detalhesY + (detalhes.length - 1) * passoDetalhe
      : nomeY + (nomeLinhas.length - 1) * passoNome;
    const fimMarca = topo + alturaLogo;
    const divisorY = Math.max(fimTextos + 8 * fator, fimMarca + 6 * fator);
    pdf.setDrawColor(tema.acento);
    pdf.setLineWidth(atelier ? 0.35 * fator : 0.42 * fator);
    const recuo = atelier ? 13 * fator : 0;
    pdf.line(margem + recuo, divisorY, larguraPagina - margem - recuo, divisorY);
    pdf.setTextColor("#202020");
    // A posição do título é calculada após o maior bloco do cabeçalho:
    // nenhuma linha ou texto decorativo pode atravessá-lo.
    return divisorY + 7 * fator;
  }
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
  tema?: TemaDocumentoPremium | null,
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
  const passo = (receita ? 4.75 : 4.4) * fator;
  const margemInterna = (receita ? 4.7 : 3) * fator;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(receita ? 9.5 : 9);
  const conteudos = colunas.map(({ linhas }) => linhas.map(linha => {
    const campos = linha.filter(([, valor]) => valor?.trim());
    const coluna = (largura - margemInterna * 2) / (campos.length || 1);
    const valores = campos.map(([rotulo, valor]) =>
      pdf.splitTextToSize(`${rotulo}: ${valor}`, coluna - (campos.length > 1 ? 2 * fator : 0)) as string[]);
    return { coluna, valores, altura: Math.max(0, ...valores.map(valor => valor.length)) * passo };
  }));
  const altura = Math.max((receita ? 31 : 38) * fator, (receita ? 18 : 12) * fator +
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
      pdf.setFillColor(tema?.quadro || "#fcfcfa");
      pdf.setDrawColor(tema?.borda || "#d7ddda");
      pdf.setLineWidth(0.17 * fator);
      pdf.roundedRect(x, topo, largura, altura, 2.4 * fator, 2.4 * fator, "FD");
      pdf.setDrawColor(tema?.acento || cor);
      pdf.setLineWidth(0.37 * fator);
      pdf.line(x + margemInterna, topo + 8.7 * fator, x + largura - margemInterna, topo + 8.7 * fator);
      pdf.setTextColor(tema?.texto || "#203630");
    } else {
      pdf.setFillColor(cor);
      pdf.rect(x, topo, largura, altura, "F");
      pdf.setTextColor(corTexto);
    }
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(receita ? 10.2 : 9);
    pdf.text(titulo, receita ? x + margemInterna : x + largura / 2, topo + (receita ? 6 : 5.3) * fator,
      { align: receita ? "left" : "center" });
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(receita ? 9.5 : 9);
    let y = topo + (receita ? 14.5 : 11) * fator;
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
  titulo, conteudo, papel, demonstrativo = false, identificacao, assinatura = [],
  assinaturaResponsavel = "", vias = 1, fundoSemIdentidade = null,
}: {
  titulo: string; conteudo: string; papel: PapelDocumento | null; demonstrativo?: boolean;
  fundoSemIdentidade?: PapelDocumento | null;
  identificacao?: IdentificacaoDocumento; assinatura?: string[];
  /** Para termos: desenha a linha do responsável e a do veterinário em cada via. */
  assinaturaResponsavel?: string;
  /** Para consentimentos, gera via do prontuário e via do responsável no mesmo PDF. */
  vias?: 1 | 2;
}) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  pdf.setProperties({ title: titulo });
  const margem = 13;
  const largura = pdf.internal.pageSize.getWidth() - margem * 2;
  const centro = margem + largura / 2;
  let y = 22;
  let viaAtual = 1;
  function iniciarPagina() {
    const fundo = papel || fundoSemIdentidade;
    if (fundo) desenharPapelDocumento(pdf, fundo);
    y = papel ? desenharIdentidadeDocumento(pdf, papel, margem, 23) : 23;
    if (vias === 2) {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8.5);
      pdf.setTextColor(0);
      pdf.text(viaAtual === 1 ? "1ª VIA · PRONTUÁRIO" : "2ª VIA · RESPONSÁVEL PELO ANIMAL",
        centro, y, { align: "center" });
      y += 6;
    }
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
  for (viaAtual = 1; viaAtual <= vias; viaAtual++) {
    if (viaAtual > 1) pdf.addPage();
    iniciarPagina();
    escrever(titulo, true, 19);
    y += 5;
    if (identificacao) {
      y = desenharIdentificacaoDocumento(pdf, identificacao, margem, y, 1,
        (papel ?? fundoSemIdentidade)?.corQuadros, "receita", papel?.tema);
    }
    y += 2;
    const temAssinaturas = Boolean(assinatura.length || assinaturaResponsavel);
    definirFonte(false, 10);
    const [data, ...profissional] = assinatura;
    const linhas = profissional.filter(Boolean).flatMap(texto => pdf.splitTextToSize(texto, largura) as string[]);
    // Inclui a data, as duas linhas de assinatura, as identificações e margem de segurança.
    const alturaAssinaturas = temAssinaturas
      ? 7 + (assinaturaResponsavel ? 23 : 0) + (assinatura.length ? 17 + linhas.length * 5 : 0) + 4
      : 0;

    if (vias === 2 && temAssinaturas) {
      // Para cada via, usar a maior tipografia que permita texto e assinaturas
      // na mesma página. Nunca diminuir abaixo de 9 pt.
      const tamanhos = [
        { fonte: 10.5, passo: 5 },
        { fonte: 10, passo: 4.75 },
        { fonte: 9.5, passo: 4.5 },
        { fonte: 9, passo: 4.3 },
      ];
      const planos = tamanhos.map(({ fonte, passo }) => {
        definirFonte(false, fonte);
        const corpo = conteudo.split("\n")
          .flatMap(paragrafo => pdf.splitTextToSize(paragrafo || " ", largura) as string[]);
        return { fonte, passo, corpo };
      });
      const plano = planos.find(p => y + p.corpo.length * p.passo + alturaAssinaturas <= 273)
        ?? planos[planos.length - 1];

      for (let indice = 0; indice < plano.corpo.length; indice++) {
        const restantes = plano.corpo.length - indice;
        if (quebrarAntesDaLinhaFinal({
          y, linhasRestantes: restantes, passo: plano.passo,
          reservaAssinaturas: alturaAssinaturas,
        })) {
          pdf.addPage();
          iniciarPagina();
        }
        definirFonte(false, plano.fonte);
        pdf.text(plano.corpo[indice], margem, y);
        y += plano.passo;
      }
    } else {
      for (const linha of conteudo.split("\n")) escrever(linha);
    }
    if (temAssinaturas) {
      definirFonte(false, 10);
      if (y + alturaAssinaturas > 273) {
        // Para os termos, a paginação tem de reservar a assinatura antes
        // de imprimir as linhas finais. Evitar página só com assinatura.
        if (vias === 2) throw new Error("O bloco de assinaturas não cabe junto ao texto final.");
        pdf.addPage();
        iniciarPagina();
      }
      y += 7;
      definirFonte(false, 10);
      if (data) {
        const dataExtenso = formatarDataExtensoDocumento(data.trim()).replace(/\.$/, "");
        pdf.text(dataExtenso + ".", centro, y, { align: "center" });
      }
      if (assinaturaResponsavel) {
        y += 13;
        pdf.setDrawColor(90);
        pdf.line(centro - 48, y, centro + 48, y);
        y += 5;
        pdf.text("Assinatura do responsável pelo animal", centro, y, { align: "center" });
        y += 5;
        pdf.text(assinaturaResponsavel, centro, y, { align: "center" });
      }
      if (assinatura.length) {
        y += 12;
        pdf.setDrawColor(90);
        pdf.line(centro - 35, y, centro + 35, y);
        y += 5;
        pdf.text("Assinatura do médico-veterinário", centro, y, { align: "center" });
        for (const linha of linhas) {
          y += 5;
          pdf.text(linha, centro, y, { align: "center" });
        }
      }
    }
  }
  return pdf;
}
