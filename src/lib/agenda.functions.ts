import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { exigirPermissaoClinica } from '@/lib/permissao-clinica.server';

const agendaSchema = z.object({
  accessToken: z.string().min(1),
  clinicaId: z.string().uuid(),
  agendaId: z.string().uuid().optional(),
  agenda: z.object({
    nome: z.string().trim().min(1).max(160),
    responsavel: z.string().trim().max(160),
    tipo: z.string().trim().min(1).max(80),
    inicio: z.string().regex(/^\d{2}:\d{2}$/),
    fim: z.string().regex(/^\d{2}:\d{2}$/),
    dias_semana: z.array(z.number().int().min(0).max(6)).min(1),
    intervalo_min: z.number().int().min(5).max(240),
    portal_ativo: z.boolean(),
    modalidade: z.enum(['livre', 'aprovacao', 'pagamento']),
    antecedencia_horas: z.number().int().min(0).max(720),
    timezone: z.string().trim().min(1).max(80),
    cor: z.enum(['azul', 'verde', 'amarelo', 'vermelho', 'rosa', 'laranja', 'roxo', 'marrom', 'cinza', 'azul-petroleo']),
  }),
});

export const salvarAgendaOnline = createServerFn({ method: 'POST' })
  .validator((input: unknown) => agendaSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin: admin } = await import('@/integrations/supabase/client.server');
    const { data: auth, error: authErro } = await admin.auth.getUser(data.accessToken);
    if (authErro || !auth.user) throw new Error('Sessão inválida ou expirada. Entre novamente.');
    await exigirPermissaoClinica(admin, auth.user.id, data.clinicaId, ['recepcao.agenda']);
    if (!data.agendaId) {
      const { data: clinica, error: erroClinica } = await admin
        .from('clinicas').select('limite_usuarios').eq('id', data.clinicaId).single();
      if (erroClinica || !clinica) throw new Error('Não foi possível consultar o limite de agendas da clínica.');
      const { count, error: erroContagem } = await admin
        .from('oricse_agendas_online').select('id', { count: 'exact', head: true })
        .eq('clinica_id', data.clinicaId);
      if (erroContagem || count === null) throw new Error('Não foi possível confirmar a quantidade de agendas.');
      const limite = Math.max(0, Number(clinica.limite_usuarios) || 0);
      if (count >= limite) throw new Error(
        'Limite de ' + limite + ' agenda(s) atingido. Para contratar mais, escreva para atendimento@oricse.com.br ou fale com seu consultor.',
      );
    }
    const registro = { clinica_id: data.clinicaId, ...data.agenda, updated_at: new Date().toISOString() };
    const consulta = data.agendaId
      ? admin.from('oricse_agendas_online').update(registro).eq('id', data.agendaId).eq('clinica_id', data.clinicaId)
      : admin.from('oricse_agendas_online').insert(registro);
    const { data: agenda, error } = await consulta.select('id').single();
    if (error) throw new Error(error.message);
    return { agendaId: agenda.id };
  });
