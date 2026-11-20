export const TIPOS_MODELO_DOCUMENTO = ["receita", "pedido", "documento", "termo", "vacina", "vermifugo"] as const;
export type TipoModeloDocumento = (typeof TIPOS_MODELO_DOCUMENTO)[number];

export const DOCUMENTOS = {
  receita: { titulo: "Receita simples", exemplo: "Orientações adicionais ao responsável pelo animal." },
  pedido: { titulo: "Pedido de exame", exemplo: "Exames solicitados:\n\nJustificativa clínica:" },
  documento: { titulo: "Documento clínico", exemplo: "O animal {{paciente}}, sob responsabilidade de {{tutor}}, compareceu para atendimento veterinário em {{data}}." },
  termo: { titulo: "Termo de consentimento", exemplo: "Procedimento proposto:\n\nRiscos, benefícios e alternativas explicados:\n\nDeclaro que recebi as orientações e autorizo o procedimento descrito.\n\nAssinatura do responsável: ______________________________" },
  vacina: { titulo: "Atestado de vacinação", exemplo: "Orientações após a aplicação." },
  vermifugo: { titulo: "Comprovante de vermifugação", exemplo: "Orientações após a administração." },
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

export function limparOrientacoesPadraoReceita(texto: string) {
  const linhaDeIdentificacao = /^(?:\{\{(?:paciente|raca|especie)\}\}[ \t]*)+$/;
  return texto.split(/\r?\n/).filter(linha => !linhaDeIdentificacao.test(linha.trim())).join("\n").trim();
}

export function valoresModeloDocumento(
  clinica: IdentidadeDocumento,
  contexto: { paciente: string; especie?: string; raca?: string; tutor: string; data: string },
) {
  return { ...contexto, clinica: clinica.nome, endereco_clinica: clinica.endereco,
    cnpj_clinica: clinica.cnpj, telefone_clinica: clinica.telefone, email_clinica: clinica.email };
}

export const MODELOS_BASE_CLINICOS = [
  { id: "d04d0000-0000-4000-8000-000000000001", categoria: "pedido" },
  { id: "d04d0000-0000-4000-8000-000000000002", categoria: "documento" },
  { id: "d04d0000-0000-4000-8000-000000000003", categoria: "termo" },
] as const;

export function formatarDataDocumento(valor?: string) {
  return valor && /^\d{4}-\d{2}-\d{2}$/.test(valor) ? valor.split("-").reverse().join("/") : valor || "";
}
