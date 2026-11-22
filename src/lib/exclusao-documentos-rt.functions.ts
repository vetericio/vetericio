import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { contaDemoAlvorada, exigirEmissaoDisponivel } from "@/lib/demo-alvorada";

const autenticacao = z.object({
  accessToken: z.string().min(20),
  clinicaId: z.string().uuid(),
});

const excluirSchema = autenticacao.extend({
  animalId: z.string().uuid(),
  documentoId: z.string().uuid(),
  categoria: z.enum(["termo", "receita"]),
  confirmacao: z.literal("DELETE"),
  motivo: z.string().trim().min(5, "Informe o motivo com pelo menos 5 caracteres.").max(500),
});

/**
 * Não aceitar a alegação de papel RT vinda do navegador.
 * Só o vínculo autenticado e ativo na clínica autoriza este poder.
 * O perfil admin global ou o cargo admin_clinica NÃO concede exclusão.
 */
async function validarRt(accessToken: string, clinicaId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: auth, error: authError } = await supabaseAdmin.auth.getUser(accessToken);
  if (authError || !auth.user) throw new Error("Sessão expirada. Entre novamente.");
  const [clinica, vinculo] = await Promise.all([
    supabaseAdmin.from("clinicas")
      .select("status,excluido_em").eq("id", clinicaId).maybeSingle(),
    supabaseAdmin.from("clinica_usuarios")
      .select("papel").eq("clinica_id", clinicaId)
      .eq("user_id", auth.user.id).eq("ativo", true).maybeSingle(),
  ]);
  if (clinica.error || vinculo.error) throw new Error("Não foi possível verificar a autorização do RT.");
  const autorizado = clinica.data?.status === "ativa" && !clinica.data?.excluido_em
    && vinculo.data?.papel === "rt";
  return { autorizado, userId: auth.user.id, user: auth.user, admin: supabaseAdmin };
}

export const consultarExclusaoRt = createServerFn({ method: "POST" })
  .validator((input: unknown) => autenticacao.parse(input))
  .handler(async ({ data }) => {
    const acesso = await validarRt(data.accessToken, data.clinicaId);
    return { podeExcluir: acesso.autorizado && !contaDemoAlvorada(acesso.user) };
  });

/**
 * Exclusão LÓGICA: mantém documento, PDF e trilha de auditoria.
 * Uma função SQL transacional verifica o RT novamente, atualiza a
 * visibilidade e grava auditoria. Nenhum DELETE físico é executado.
 */
export const excluirTermoOuReceitaRt = createServerFn({ method: "POST" })
  .validator((input: unknown) => excluirSchema.parse(input))
  .handler(async ({ data }) => {
    const acesso = await validarRt(data.accessToken, data.clinicaId);
    if (!acesso.autorizado) {
      throw new Error("Somente o responsável técnico da clínica pode excluir termos e receitas.");
    }
    exigirEmissaoDisponivel(contaDemoAlvorada(acesso.user));

    // Este RPC pode ser executado apenas por service_role. A função do
    // banco confere novamente clínica, paciente e vínculo de RT ativo.
    const { data: auditoria, error } = await (acesso.admin as any).rpc("oricse_arquivar_documento_rt", {
      p_clinica_id: data.clinicaId,
      p_animal_id: data.animalId,
      p_documento_id: data.documentoId,
      p_categoria: data.categoria,
      p_usuario_id: acesso.userId,
      p_motivo: data.motivo,
    });
    if (error || typeof auditoria !== "string") {
      throw new Error(error?.message || "Não foi possível confirmar a exclusão e a auditoria.");
    }
    return { excluido: true, auditoriaId: auditoria };
  });
