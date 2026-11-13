import { createClient } from "@supabase/supabase-js";

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
  accessToken: string,
): Promise<void> {
  if (!userId || !clinicaId || !accessToken || codigos.length === 0)
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

  // Serviço administrativo não transporta auth.uid() do funcionário; o RPC
  // precisa receber seu JWT para aplicar corretamente as políticas do banco.
  const url = process.env["ORICSE_SUPABASE_URL"] ||
    process.env["SUPABASE_URL"] || "https://mwrmfcyrdxfxssebgknz.supabase.co";
  const publishableKey = process.env["ORICSE_SUPABASE_PUBLISHABLE_KEY"] ||
    process.env["SUPABASE_PUBLISHABLE_KEY"] ||
    process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
    "sb_publishable_Y5qsG-0F69poaQjUnWxGKw_8WOydkZc";
  const usuario = createClient(url, publishableKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: permissoes, error: erroPermissoes } = await usuario.rpc(
    "oricse_permissoes_efetivas",
    { p_clinica_id: clinicaId, p_user_id: userId },
  );
  if (erroPermissoes || !Array.isArray(permissoes))
    throw new Error("Não foi possível verificar as permissões.");
  if (!permissoes.some((p: any) =>
    codigos.includes(String(p.codigo)) && p.permitido === true))
    throw new Error("Seu cargo ou plano não autoriza esta operação.");
}
