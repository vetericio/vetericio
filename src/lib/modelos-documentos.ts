export const TIPOS_MODELO_DOCUMENTO = ["receita", "pedido", "documento", "termo", "vacina", "vermifugo", "orcamento"] as const;
export type TipoModeloDocumento = (typeof TIPOS_MODELO_DOCUMENTO)[number];

export const DOCUMENTOS = {
  // Somente o corpo é personalizável. Clínica, paciente, tutor, título e
  // assinatura são sempre compostos pelo gerador padronizado do PDF.
  receita: {
    titulo: "Receita simples",
    exemplo: "Orientações ao responsável pelo animal {{paciente}}:\n\nCuidados recomendados:\n\nObservações adicionais:",
  },
  pedido: {
    titulo: "Pedido de exame",
    exemplo: "Solicito avaliação complementar para o animal {{paciente}}, sob responsabilidade de {{tutor}}.\n\nExames solicitados:\n\nJustificativa clínica:\n\nOrientações ao responsável:",
  },
  documento: {
    titulo: "Documento clínico",
    exemplo: "Confirmo que o animal {{paciente}}, sob responsabilidade de {{tutor}}, foi atendido em {{data}}.\n\nDescrição do atendimento:\n\nConduta e orientações:",
  },
  termo: {
    titulo: "Termo e consentimento",
    exemplo: "Eu, {{tutor}}, responsável pelo animal {{paciente}}, declaro ter recebido explicações sobre o atendimento ou procedimento abaixo.\n\nProcedimento proposto:\n\nOrientações, riscos e alternativas discutidos:\n\nObservações:\n\nEspaço para manifestação e assinatura do responsável:",
  },
  vacina: {
    titulo: "Atestado de vacinação",
    exemplo: "Registro de vacinação referente ao animal {{paciente}}, sob responsabilidade de {{tutor}}.\n\nOrientações após a aplicação:\n\nRecomendações para acompanhamento:",
  },
  vermifugo: {
    titulo: "Comprovante de vermifugação",
    exemplo: "Registro de vermifugação referente ao animal {{paciente}}, sob responsabilidade de {{tutor}}.\n\nOrientações após a administração:\n\nRecomendações para acompanhamento:",
  },
  orcamento: {
    titulo: "Orçamento",
    exemplo: "Proposta de serviços e produtos para {{paciente}}, sob responsabilidade de {{tutor}}.",
  },
} satisfies Record<TipoModeloDocumento, { titulo: string; exemplo: string }>;

export const FUNDOS_DOCUMENTOS = [
  ["02", "Ondas azul e verde"], ["03", "Pata em traço"], ["04", "Patinhas em verde claro"],
  ["05", "Ilustrações veterinárias"], ["06", "Animais nas bordas"], ["07", "Aquarela de animais"],
  ["08", "Patinhas rosa e lilás"], ["09", "Cães e gatos em tons pastel"], ["10", "Animais em cinza"],
  ["11", "Cantos bege"], ["12", "Linhas em verde sálvia"],
  ["13", "Preto & Branco"], ["14", "Atelier"],
  ["15", "Vinho Nobre"], ["16", "Atlântico"],
  ["17", "Sálvia"], ["18", "Terracota"],
] as const;

export const TEMAS_DOCUMENTOS_PREMIUM = {
  "13": { nome: "Preto & Branco", acento: "#202020", texto: "#1e1e1e", papel: "#ffffff", quadro: "#fdfdfc", borda: "#d4d4d4" },
  "14": { nome: "Atelier", acento: "#9a722d", texto: "#282119", papel: "#fcf9f2", quadro: "#fffdf8", borda: "#c9aa73" },
  "15": { nome: "Vinho Nobre", acento: "#64243d", texto: "#3f2431", papel: "#fffcfb", quadro: "#f7edf0", borda: "#d9b8c5" },
  "16": { nome: "Atlântico", acento: "#007f90", texto: "#073b47", papel: "#fbfefe", quadro: "#eaf6f7", borda: "#a2d4da" },
  "17": { nome: "Sálvia", acento: "#5a8065", texto: "#234d38", papel: "#fbfcf8", quadro: "#f3f8f1", borda: "#b3c9b4" },
  "18": { nome: "Terracota", acento: "#ba6749", texto: "#56352c", papel: "#fffbf8", quadro: "#fbefe7", borda: "#e5bba9" },
} as const;

export type TemaDocumentoPremium = typeof TEMAS_DOCUMENTOS_PREMIUM[keyof typeof TEMAS_DOCUMENTOS_PREMIUM] & { id: string };

export function obterTemaDocumentoPremium(id: string): TemaDocumentoPremium | null {
  const tema = TEMAS_DOCUMENTOS_PREMIUM[id as keyof typeof TEMAS_DOCUMENTOS_PREMIUM];
  return tema ? { ...tema, id } : null;
}

/** Desenha somente o fundo dos temas premium, sem inserir texto ou conteúdo do documento. */
export function desenharFundoTemaPremiumCanvas(ctx: CanvasRenderingContext2D, id: string, largura: number, altura: number) {
  const tema = obterTemaDocumentoPremium(id);
  if (!tema) return;

  ctx.save();
  ctx.fillStyle = tema.papel;
  ctx.fillRect(0, 0, largura, altura);
  const alturaPagina = 1754;
  const margem = largura * 0.036;
  for (let topo = 0; topo < altura; topo += alturaPagina) {
    if (id === "13") {
      ctx.fillStyle = "#111111";
      ctx.fillRect(0, topo, largura, alturaPagina * 0.006);
      ctx.fillRect(0, topo + alturaPagina * 0.992, largura, alturaPagina * 0.008);
    } else if (id === "14") {
      ctx.strokeStyle = "#bc984f";
      ctx.lineWidth = 3;
      ctx.strokeRect(margem, topo + alturaPagina * 0.013, largura - margem * 2, alturaPagina * 0.967);
      ctx.lineWidth = 1.5;
      ctx.strokeRect(margem * 1.25, topo + alturaPagina * 0.018, largura - margem * 2.5, alturaPagina * 0.957);
    } else if (id === "15") {
      ctx.fillStyle = "#64243d";
      ctx.fillRect(0, topo, largura, alturaPagina * 0.052);
      ctx.strokeStyle = "#d8abb9";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(margem, topo + alturaPagina * 0.982);
      ctx.lineTo(largura - margem, topo + alturaPagina * 0.982);
      ctx.stroke();
      ctx.strokeStyle = "#edd3d9";
      for (let n = 0; n < 3; n++) {
        ctx.beginPath();
        ctx.ellipse(largura * 0.965, topo + alturaPagina * 0.175, largura * (0.06 + n * 0.03), alturaPagina * (0.022 + n * 0.01), 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (id === "16") {
      ctx.fillStyle = "#00899a";
      ctx.fillRect(0, topo, largura, alturaPagina * 0.009);
      ctx.strokeStyle = "#d6eff0";
      ctx.lineWidth = 2;
      for (let n = 0; n < 3; n++) {
        ctx.beginPath();
        ctx.ellipse(largura * 0.98, topo + alturaPagina * (0.43 + n * 0.022), largura * 0.09, alturaPagina * 0.023, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (id === "17") {
      ctx.fillStyle = "#e9f0e7";
      if (typeof ctx.roundRect === "function") {
        ctx.beginPath();
        ctx.roundRect(margem, topo + alturaPagina * 0.022, largura - margem * 2, alturaPagina * 0.084, margem * 0.25);
        ctx.fill();
      } else ctx.fillRect(margem, topo + alturaPagina * 0.022, largura - margem * 2, alturaPagina * 0.084);
      ctx.strokeStyle = "#90ac93";
      ctx.lineWidth = 2;
      const bx = largura * 0.90, by = topo + alturaPagina * 0.91;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + largura * 0.027, by - alturaPagina * 0.105);
      ctx.stroke();
      for (let n = 0; n < 5; n++) {
        const y = by - alturaPagina * (0.02 + n * 0.019);
        const x = bx + largura * (0.005 + n * 0.004);
        ctx.beginPath();
        ctx.ellipse(x + (n % 2 ? 5 : -5), y, 15, 7, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (id === "18") {
      ctx.fillStyle = "#c97654";
      ctx.fillRect(0, topo, largura, alturaPagina * 0.01);
      ctx.fillRect(0, topo + alturaPagina * 0.989, largura, alturaPagina * 0.011);
      ctx.strokeStyle = "#edcdbf";
      ctx.lineWidth = 2;
      for (let n = 0; n < 3; n++) {
        ctx.beginPath();
        ctx.ellipse(largura * 0.98, topo + alturaPagina * 0.22, largura * (0.11 + n * 0.03), alturaPagina * (0.042 + n * 0.02), 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

export const COR_QUADROS_PADRAO = "#a6c4d9";

export type ModeloDocumentoPadrao = {
  fundo: string;
  texto: string;
  usarLogo: boolean;
  corQuadros: string;
};

export type IdentidadeDocumento = {
  nome: string;
  razaoSocial: string;
  cnpj: string;
  crmv: string;
  endereco: string;
  telefone: string;
  email: string;
  municipio: string;
  logoUrl: string;
  logoAlternativa?: string;
  site?: string;
};

export function urlFundoDocumento(fundo: string, miniatura = false) {
  // Os seis novos temas são vetoriais: não dependem de imagens JPG nem WebP.
  if (obterTemaDocumentoPremium(fundo)) return "";
  return FUNDOS_DOCUMENTOS.some(([id]) => id === fundo)
    ? `/fundos-documentos/${fundo}.${miniatura ? "webp" : "jpg"}`
    : "";
}

export function preencherTextoDocumento(texto: string, valores: Record<string, string>) {
  return texto.replace(/\{\{([a-z_]+)\}\}/g, (original, campo: string) =>
    Object.hasOwn(valores, campo) && valores[campo] ? valores[campo] : original,
  );
}

/**
 * Modelos antigos continham logo/cabeçalho e identificação dentro do texto.
 * O gerador atual insere esses dados uma única vez, de forma padronizada.
 * Só remove linhas reconhecíveis do cabeçalho legado, preservando o conteúdo
 * clínico ou jurídico redigido pela clínica e nunca alterando registros salvos.
 */
export function extrairCorpoModeloClinico(texto: string): string {
  const linhas = texto.replace(/\r\n/g, "\n").split("\n");
  const prefixo = [
    /^\s*\{\{clinica\}\}\s*$/,
    /^\s*\{\{endereco_clinica\}\}\s*$/,
    /^\s*(RECEITUÁRIO VETERINÁRIO|PEDIDO DE EXAME|DECLARAÇÃO|TERMO DE CONSENTIMENTO|TÍTULO DO DOCUMENTO)\s*$/i,
    /^\s*Paciente:\s*\{\{paciente\}\}.*$/i,
    /^\s*Animal:\s*\{\{paciente\}\}.*$/i,
    /^\s*Tutor:\s*\{\{tutor\}\}.*$/i,
  ];
  const tinhaCabecalho = linhas.slice(0, 9).some(linha => prefixo.some(regra => regra.test(linha)));
  if (!tinhaCabecalho) return texto;
  while (linhas.length && (linhas[0].trim() === "" || prefixo.some(regra => regra.test(linhas[0])))) linhas.shift();
  while (linhas.length && linhas[linhas.length - 1].trim() === "") linhas.pop();
  // Retira exclusivamente o rodapé fixo dos modelos ORICSE antigos.
  if (linhas.length && /^\s*\{\{veterinario\}\}\s*[-–]\s*CRMV\s*\{\{crmv\}\}\s*$/i.test(linhas[linhas.length - 1])) {
    linhas.pop();
    if (linhas.length && /^\s*(Data:\s*)?\{\{data\}\}\s*$/i.test(linhas[linhas.length - 1])) linhas.pop();
  }
  return linhas.join("\n").trim();
}

export function limparOrientacoesPadraoReceita(texto: string) {
  const linhaDeIdentificacao = /^(?:\{\{(?:paciente|raca|especie)\}\}[ \t]*)+$/;
  return texto.split(/\r?\n/).filter(linha => !linhaDeIdentificacao.test(linha.trim())).join("\n").trim();
}

export function valoresModeloDocumento(
  clinica: IdentidadeDocumento,
  contexto: { paciente: string; especie?: string; raca?: string; tutor: string; data: string },
) {
  return { ...contexto, data: formatarDataExtensoDocumento(contexto.data), clinica: clinica.nome, endereco_clinica: clinica.endereco,
    cnpj_clinica: clinica.cnpj, telefone_clinica: clinica.telefone, email_clinica: clinica.email };
}

export const MODELOS_BASE_CLINICOS = [
  { id: "d04d0000-0000-4000-8000-000000000001", categoria: "pedido" },
  { id: "d04d0000-0000-4000-8000-000000000002", categoria: "documento" },
  { id: "d04d0000-0000-4000-8000-000000000003", categoria: "termo" },
] as const;

/** Formato longo usado na data de emissão e assinatura dos documentos.
 * Mantém a data original no cadastro e não interfere em validade/lote/nascimento.
 * Aceita data ISO, BR e cidade/UF antes da data.
 */
export function formatarDataExtensoDocumento(valor: string): string {
  const meses = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
  ];
  return valor.replace(/\b(?:([0-9]{1,2})\/([0-9]{1,2})\/([0-9]{4})|([0-9]{4})-([0-9]{2})-([0-9]{2}))\b/g,
    (original, diaBR: string | undefined, mesBR: string | undefined, anoBR: string | undefined,
      anoISO: string | undefined, mesISO: string | undefined, diaISO: string | undefined) => {
      const dia = Number(diaBR ?? diaISO), mes = Number(mesBR ?? mesISO), ano = Number(anoBR ?? anoISO);
      if (!Number.isInteger(ano) || ano < 1000 || ano > 9999 || mes < 1 || mes > 12 || dia < 1 || dia > 31) return original;
      const data = new Date(Date.UTC(ano, mes - 1, dia));
      if (data.getUTCFullYear() !== ano || data.getUTCMonth() !== mes - 1 || data.getUTCDate() !== dia) return original;
      return `${dia} de ${meses[mes - 1]} de ${ano}`;
    });
}

export function formatarDataDocumento(valor?: string) {
  return valor && /^\d{4}-\d{2}-\d{2}$/.test(valor) ? valor.split("-").reverse().join("/") : valor || "";
}
