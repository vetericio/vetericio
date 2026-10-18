import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

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

async function podeEditarAgenda(admin: any, userId: string, clinicaId: string) {
  const { data: perfil, error: perfilErro } = await admin.from('app_users').select('role').eq('user_id', userId).maybeSingle();
  if (perfilErro) throw new Error(perfilErro.message);
  if (perfil?.role === 'admin') return;
  const { data: vinculo, error: vinculoErro } = await admin.from('clinica_usuarios').select('papel,ativo').eq('clinica_id', clinicaId).eq('user_id', userId).eq('ativo', true).maybeSingle();
  if (vinculoErro) throw new Error(vinculoErro.message);
  if (!vinculo) throw new Error('Você não tem acesso a esta clínica.');
  const { data: individual } = await admin.from('oricse_permissoes_usuario').select('permitido').eq('clinica_id', clinicaId).eq('user_id', userId).eq('permissao_codigo', 'recepcao.agenda').maybeSingle();
  if (individual?.permitido === false) throw new Error('Você não tem permissão para editar a agenda.');
  if (individual?.permitido === true) return;
  const { data: papel } = await admin.from('oricse_permissoes_papel').select('permitido').eq('papel', vinculo.papel).eq('permissao_codigo', 'recepcao.agenda').maybeSingle();
  if (!papel?.permitido) throw new Error('Você não tem permissão para editar a agenda.');
}

export const salvarAgendaOnline = createServerFn({ method: 'POST' })
  .validator((input: unknown) => agendaSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin: admin } = await import('@/integrations/supabase/client.server');
    const { data: auth, error: authErro } = await admin.auth.getUser(data.accessToken);
    if (authErro || !auth.user) throw new Error('Sessão inválida ou expirada. Entre novamente.');
    await podeEditarAgenda(admin, auth.user.id, data.clinicaId);
    const registro = { clinica_id: data.clinicaId, ...data.agenda, updated_at: new Date().toISOString() };
    const consulta = data.agendaId
      ? admin.from('oricse_agendas_online').update(registro).eq('id', data.agendaId).eq('clinica_id', data.clinicaId)
      : admin.from('oricse_agendas_online').insert(registro);
    const { data: agenda, error } = await consulta.select('id').single();
    if (error) throw new Error(error.message);
    return { agendaId: agenda.id };
  });
