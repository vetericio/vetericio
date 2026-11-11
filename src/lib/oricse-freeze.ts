/**
 * O ORICSE está liberado para edição e administração.
 * As rotas anteriormente protegidas permanecem registradas para controle
 * explícito caso a política de congelamento seja retomada no futuro.
 */
export const ORICSE_SISTEMA_CONGELADO = false;

const ROTAS_EDITAVEIS_PROTEGIDAS = new Set([
  "/admin",
  "/admin-canvas",
  "/configuracao-site",
  "/configurar-portal-tutor",
  "/site-da-clinica",
  "/temas",
  "/oricstudio",
  "/permissoes-equipe",
  "/perfil-clinica",
  "/portal-tutores",
  "/sincronizacao",
]);

export function rotaEditavelProtegida(pathname: string) {
  return pathname.startsWith("/admin") || ROTAS_EDITAVEIS_PROTEGIDAS.has(pathname);
}
