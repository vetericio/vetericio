import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { exigirPermissaoClinica } from "@/lib/permissao-clinica.server";

const input = z.object({ accessToken: z.string().min(20), clinicaId: z.string().uuid() });

const padrao = {
  agenda: {
    toleranciaMinutos: 10, cancelamentoHoras: 24,
    reagendamentoHoras: 12, exigirSinal: false, percentualSinal: 0,
  },
  comunicacao: {
    confirmacaoConsulta: "Olá, {{tutor}}! Sua consulta de {{paciente}} está agendada para {{data}} às {{hora}}.",
    lembreteVacina: "Olá, {{tutor}}! Verifique a próxima vacina de {{paciente}} com nossa equipe.",
    mensagemRetorno: "Olá, {{tutor}}! Está na hora de avaliar o retorno de {{paciente}}.",
    mensagemPosConsulta: "Olá, {{tutor}}! Como está {{paciente}} após o atendimento? Estamos à disposição.",
  },
};
const esquema = z.object({
  versao: z.literal(1),
  agenda: z.object({
    toleranciaMinutos: z.number().int().min(0).max(120),
    cancelamentoHoras: z.number().int().min(0).max(168),
    reagendamentoHoras: z.number().int().min(0).max(168),
    exigirSinal: z.boolean(),
    percentualSinal: z.number().int().min(0).max(100),
  }),
  comunicacao: z.object({
    confirmacaoConsulta: z.string().max(1500),
    lembreteVacina: z.string().max(1500),
    mensagemRetorno: z.string().max(1500),
    mensagemPosConsulta: z.string().max(1500),
  }),
});

/** Política operacional pública apenas à equipe autenticada e vinculada à clínica. */
export const consultarPoliticasAgendaClinica = createServerFn({ method: "POST" })
  .validator((v: unknown) => input.parse(v))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: auth, error: authError } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (authError || !auth.user) throw new Error("Sessão expirada.");
    const userId = auth.user.id;
    await exigirPermissaoClinica(supabaseAdmin, userId, data.clinicaId,
      ["recepcao.agenda","consultorio.atendimentos","administracao.configuracoes","crm.gerenciar"], data.accessToken);
    const { data: registro, error: registroError } = await supabaseAdmin.from("oricse_dados_modulos")
      .select("dados").eq("clinica_id", data.clinicaId).eq("chave", "estado_sistema").maybeSingle();
    if (registroError) throw new Error("Não foi possível carregar as políticas da clínica.");
    const estado = registro?.dados && typeof registro.dados === "object" && !Array.isArray(registro.dados)
      ? registro.dados as Record<string, unknown> : {};
    const bruto = estado["oricse-politicas-operacionais-v1"];
    if (!bruto) return { ...padrao, configurado: false };
    let parsed: unknown;
    try { parsed = JSON.parse(String(bruto)); }
    catch { throw new Error("Política salva inválida. Solicite revisão à administração."); }
    const result = esquema.safeParse(parsed);
    if (!result.success) throw new Error("Política salva inconsistente. Solicite revisão à administração.");
    return { agenda: result.data.agenda, comunicacao: result.data.comunicacao, configurado: true };
  });
