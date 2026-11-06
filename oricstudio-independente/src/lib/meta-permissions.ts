// Shared (browser-safe) catalog of Meta permissions used by the app.
export const META_SCOPES = [
  "instagram_basic",
  "instagram_content_publish",
  "instagram_manage_insights",
  "instagram_manage_comments",
  "pages_show_list",
  "pages_read_engagement",
  "business_management",
] as const;

export const PERMISSION_MATRIX: { funcionalidade: string; permissao: string; finalidade: string }[] = [
  { funcionalidade: "Listar contas do Instagram", permissao: "instagram_basic", finalidade: "Ler perfil, foto, nome de usuário e seguidores das contas profissionais." },
  { funcionalidade: "Listar Páginas", permissao: "pages_show_list", finalidade: "Encontrar as Páginas do Facebook vinculadas às contas do Instagram." },
  { funcionalidade: "Ler dados das Páginas", permissao: "pages_read_engagement", finalidade: "Obter o token da Página e a conta do Instagram vinculada." },
  { funcionalidade: "Portfólios empresariais", permissao: "business_management", finalidade: "Encontrar Páginas atribuídas por meio de portfólios empresariais." },
  { funcionalidade: "Publicar conteúdo", permissao: "instagram_content_publish", finalidade: "Publicar e agendar posts (próxima fase)." },
  { funcionalidade: "Métricas", permissao: "instagram_manage_insights", finalidade: "Coletar métricas de contas e publicações (próxima fase)." },
  { funcionalidade: "Comentários", permissao: "instagram_manage_comments", finalidade: "Ler, responder e ocultar comentários (próxima fase)." },
];

export const STATUS_LABEL: Record<string, string> = {
  ativa: "Ativa",
  token_expirado: "Token expirado",
  permissao_insuficiente: "Permissão insuficiente",
  revogada: "Revogada",
  erro: "Erro",
  desconectada: "Desconectada",
  inativa: "Inativa",
};
