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
] as const;

export type ModeloDocumentoPadrao = {
  fundo: string;
  texto: string;
  usarLogo: boolean;
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
  site?: string;
};

export function urlFundoDocumento(fundo: string, miniatura = false) {
  return FUNDOS_DOCUMENTOS.some(([id]) => id === fundo)
    ? `/fundos-documentos/${fundo}.${miniatura ? "webp" : "jpg"}`
    : "";
}

export function preencherTextoDocumento(texto: string, valores: Record<string, string>) {
  return texto.replace(/\{\{([a-z_]+)\}\}/g, (original, campo: string) =>
    Object.hasOwn(valores, campo) && valores[campo] ? valores[campo] : original,
  );
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
