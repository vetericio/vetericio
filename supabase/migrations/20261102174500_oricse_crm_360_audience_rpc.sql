-- Dados agregados do CRM 360, sem expor o JSON privado completo do tutor.
-- A tabela de cobranças é consumida pelo CRM e precisa existir numa instalação limpa.
create table if not exists public.oricse_cobrancas_tutores (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  tutor_id uuid not null,
  animal_id uuid,
  agenda_id uuid,
  agendamento_id uuid,
  descricao text not null,
  modo_valor text not null default 'fixo',
  valor_referencia numeric(12,2) not null default 0,
  valor_cobrado numeric(12,2) not null default 0,
  valor_mercado_pago_previsto numeric(12,2) not null default 0,
  valor_oricse_previsto numeric(12,2) not null default 0,
  valor_clinica_previsto numeric(12,2) not null default 0,
  taxa_mercado_pago_percentual numeric(7,4) not null default 0,
  taxa_mercado_pago_fixa numeric(12,2) not null default 0,
  taxa_oricse_percentual numeric(7,4) not null default 0,
  status text not null default 'pendente',
  checkout_url text,
  mercado_pago_preference_id text,
  mercado_pago_payment_id text,
  aprovado_em timestamptz,
  webhook_recebido_em timestamptz,
  dados_provedor jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.oricse_cobrancas_tutores enable row level security;

-- Dados financeiros de tutor são acessados somente pelos fluxos autorizados.
create policy oricse_cobrancas_tutores_sem_acesso_direto
on public.oricse_cobrancas_tutores
as restrictive for all to anon, authenticated
using (false)
with check (false);

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
