/** Compatibilidade com chamadas antigas: a Central de Relacionamento não é restrita a uma clínica piloto.
 * Permissões de usuário e escopo da clínica continuam obrigatórios nas rotas e no servidor.
 */
export function crmLiberadoParaClinica(_clinicaSlug?: string | null) {
  return true;
}
