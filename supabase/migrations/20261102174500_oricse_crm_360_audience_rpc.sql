-- Dados agregados do CRM 360, sem expor o JSON privado completo do tutor.
create or replace function public.oricse_crm_360_base(p_clinica_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  if not (
    public.oricse_usuario_pode_permissao(p_clinica_id,'crm.visualizar')
    or public.oricse_usuario_pode_permissao(p_clinica_id,'crm.enviar')
    or public.oricse_usuario_pode_permissao(p_clinica_id,'crm.gerenciar')
  ) then
    raise exception 'Sem permissão para consultar a carteira CRM desta clínica.' using errcode='42501';
  end if;

  return jsonb_build_object(
    'tutores',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',t.id,'nome',t.nome,'telefone',t.telefone,'outro_telefone',t.outro_telefone,
        'email',t.email,'criado_em',t.created_at,
        'autoriza_marketing',case lower(coalesce(t.dados->>'autorizaMarketing','false')) when 'true' then true else false end,
        'contato_preferencial',coalesce(t.dados->>'contatoPreferencial','')
      ) order by t.nome)
      from public.tutores t where t.clinica_id=p_clinica_id
    ),'[]'::jsonb),
    'animais',coalesce((
      select jsonb_agg(jsonb_build_object('id',a.id,'tutor_id',a.tutor_id,'nome',a.nome,'especie',a.especie) order by a.nome)
      from public.oricse_animais a where a.clinica_id=p_clinica_id
    ),'[]'::jsonb),
    'agenda',coalesce((
      select jsonb_agg(jsonb_build_object('tutor_id',a.tutor_id,'animal_id',a.animal_id,'inicio',a.inicio,'estado',a.estado,'tipo',a.tipo))
      from public.oricse_agendamentos_online a where a.clinica_id=p_clinica_id
    ),'[]'::jsonb),
    'hotel',coalesce((
      select jsonb_agg(jsonb_build_object('tutor_id',h.tutor_id,'animal_id',h.animal_id,'status',h.status,'chegada',h.chegada_prevista,'saida',h.saida_prevista))
      from public.oricse_hotel_estadias h where h.clinica_id=p_clinica_id
    ),'[]'::jsonb),
    'banho_tosa',coalesce((
      select jsonb_agg(jsonb_build_object('tutor_id',b.tutor_id,'animal_id',b.animal_id,'status',b.status,'inicio',b.inicio,'servico',b.servico_nome,'pago',b.pago))
      from public.oricse_banho_tosa_agendamentos b where b.clinica_id=p_clinica_id
    ),'[]'::jsonb),
    'cobrancas',coalesce((
      select jsonb_agg(jsonb_build_object('tutor_id',c.tutor_id,'animal_id',c.animal_id,'status',c.status,'descricao',c.descricao,'valor',c.valor_cobrado,'criado_em',c.created_at))
      from public.oricse_cobrancas_tutores c where c.clinica_id=p_clinica_id
    ),'[]'::jsonb)
  );
end;
$$;
revoke all on function public.oricse_crm_360_base(uuid) from public;
revoke all on function public.oricse_crm_360_base(uuid) from anon;
grant execute on function public.oricse_crm_360_base(uuid) to authenticated;
