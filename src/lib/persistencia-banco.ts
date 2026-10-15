import { supabase } from "@/integrations/supabase/client";

/**
 * Persistência central por clínica. Nunca usa localStorage, sessionStorage ou IndexedDB.
 * Falhas de autenticação/rede são propagadas; não há fallback silencioso no navegador.
 */
async function contextoClinica(): Promise<{ clinica_id: string; user_id: string }> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Faça login para acessar os dados da clínica.");
  const { data, error } = await (supabase as any).from("clinica_usuarios")
    .select("clinica_id").eq("user_id", user.id).eq("ativo", true).limit(2);
  if (error) throw error;
  if (!data?.length) throw new Error("Usuário sem vínculo ativo com clínica.");
  if (data.length !== 1) throw new Error("Selecione uma clínica antes de acessar os dados.");
  return { clinica_id: data[0].clinica_id, user_id: user.id };
}

export async function carregarModulo<T>(chave: string, padrao: T): Promise<T> {
  const { clinica_id } = await contextoClinica();
  const { data, error } = await (supabase as any).from("oricse_dados_modulos")
    .select("dados").eq("clinica_id", clinica_id).eq("chave", chave).maybeSingle();
  if (error) throw error;
  return data ? data.dados as T : padrao;
}

export async function salvarModulo<T>(chave: string, dados: T): Promise<void> {
  const { clinica_id, user_id } = await contextoClinica();
  const { error } = await (supabase as any).from("oricse_dados_modulos").upsert({
    clinica_id, chave, dados, atualizado_por: user_id, atualizado_em: new Date().toISOString(),
  }, { onConflict: "clinica_id,chave" });
  if (error) throw error;
}

export async function apagarModulo(chave: string): Promise<void> {
  const { clinica_id } = await contextoClinica();
  const { error } = await (supabase as any).from("oricse_dados_modulos")
    .delete().eq("clinica_id", clinica_id).eq("chave", chave);
  if (error) throw error;
}
