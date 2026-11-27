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
