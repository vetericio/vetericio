/**
 * Autorização obrigatória nos endpoints que utilizam a chave administrativa.
 * Nunca confiar em IDs ou permissões informados pelo cliente.
 * A função SQL de permissões efetivas é a fonte da verdade para plano + cargo + usuário.
 */
export async function exigirPermissaoClinica(
  admin: any,
  userId: string,
  clinicaId: string,
  codigos: readonly string[],
): Promise<void> {
  if (!userId || !clinicaId || codigos.length === 0)
    throw new Error("Identificação ou permissão inválida.");

  const { data: clinica, error: erroClinica } = await admin.from("clinicas")
    .select("id,status,excluido_em").eq("id", clinicaId).maybeSingle();
  if (erroClinica || !clinica || clinica.status !== "ativa" || clinica.excluido_em)
    throw new Error("Clínica indisponível.");

  const { data: perfil, error: erroPerfil } = await admin.from("app_users")
    .select("role").eq("user_id", userId).maybeSingle();
  if (erroPerfil) throw new Error("Não foi possível verificar o acesso.");
  if (perfil?.role === "admin") return;

  const { data: vinculo, error: erroVinculo } = await admin.from("clinica_usuarios")
    .select("user_id").eq("clinica_id", clinicaId).eq("user_id", userId)
    .eq("ativo", true).maybeSingle();
  if (erroVinculo || !vinculo) throw new Error("Você não tem vínculo ativo com esta clínica.");

  const { data: permissoes, error: erroPermissoes } = await admin.rpc(
    "oricse_permissoes_efetivas",
    { p_clinica_id: clinicaId, p_user_id: userId },
  );
  if (erroPermissoes || !Array.isArray(permissoes))
    throw new Error("Não foi possível verificar as permissões.");
  if (!permissoes.some((p: any) =>
    codigos.includes(String(p.codigo)) && p.permitido === true))
    throw new Error("Seu cargo ou plano não autoriza esta operação.");
}
