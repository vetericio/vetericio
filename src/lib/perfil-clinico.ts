import { supabase } from "@/integrations/supabase/client";
import { obterPerfilPessoa } from "@/lib/admin-users.functions";

export async function obterAutorClinico() {
  const { data, error } = await supabase.auth.getSession();
  const sessao = data.session;
  if (error || !sessao) throw new Error("Entre novamente para identificar o autor.");
  const perfil = await obterPerfilPessoa({ data: { accessToken: sessao.access_token } });
  const nome = perfil?.nome_completo?.trim() || "";
  const numeroCrmv = perfil?.crmv?.trim() || "";
  const uf = perfil?.crmv_uf?.trim().toUpperCase() || "";
  const conta = sessao.user.email?.replace(/@vetericio\.local$/i, "") || sessao.user.id;
  return {
    id: sessao.user.id, nome, numeroCrmv, uf,
    crmv: numeroCrmv && uf ? `CRMV-${uf} ${numeroCrmv}` : "",
    identificacao: nome || conta,
    endereco: perfil?.endereco?.trim() || "",
    telefone: perfil?.telefone?.trim() || "",
  };
}
