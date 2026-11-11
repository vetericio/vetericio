/**
 * Congelamento explícito da versão aprovada do ORICSE.
 *
 * O bloqueio protege as superfícies de administração e edição sem interromper
 * o uso operacional das clínicas ou o Portal do Tutor já publicado.
 */
export const ORICSE_SISTEMA_CONGELADO = true;

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
