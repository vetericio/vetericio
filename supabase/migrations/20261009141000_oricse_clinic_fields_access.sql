alter table public.clinicas
  add column if not exists dominio text,
  add column if not exists logo_url text,
  add column if not exists plano text not null default '',
  add column if not exists limite_usuarios integer not null default 1,
  add column if not exists observacoes text,
  add column if not exists ultimo_pagamento_em timestamptz,
  add column if not exists proximo_pagamento_em timestamptz,
  add column if not exists acesso_ate timestamptz,
  add column if not exists status_financeiro text not null default 'em_dia',
  add column if not exists duracao_padrao_atendimento_min integer not null default 30,
  add column if not exists duracoes_atendimento_min jsonb not null default
    '{"Consulta":30,"Retorno":30,"Cirurgia":120,"Banho e Tosa":60,"Vacina":30,"Procedimento":30}'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

alter table public.clinicas
  drop constraint if exists clinicas_status_check;
alter table public.clinicas
  add constraint clinicas_status_check
  check (status in ('ativa', 'bloqueada', 'inativa', 'cancelada'));

alter table public.clinicas
  drop constraint if exists clinicas_status_financeiro_check;
alter table public.clinicas
  add constraint clinicas_status_financeiro_check
  check (status_financeiro in ('em_dia', 'pendente', 'atrasado', 'isento', 'teste'));

alter table public.clinicas
  drop constraint if exists clinicas_limite_usuarios_check;
alter table public.clinicas
  add constraint clinicas_limite_usuarios_check
  check (limite_usuarios > 0);

alter table public.clinicas
  drop constraint if exists clinicas_duracao_padrao_atendimento_min_check;
alter table public.clinicas
  add constraint clinicas_duracao_padrao_atendimento_min_check
  check (duracao_padrao_atendimento_min between 5 and 720);

create or replace function public.oricse_meu_acesso()
returns table (
  teste_ativo boolean,
  teste_expirado boolean,
  dias_restantes integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.status_financeiro = 'teste'
      and c.acesso_ate is not null
      and c.acesso_ate >= now() as teste_ativo,
    c.status_financeiro = 'teste'
      and c.acesso_ate is not null
      and c.acesso_ate < now() as teste_expirado,
    case
      when c.status_financeiro = 'teste' and c.acesso_ate is not null
        then greatest(0, ceil(extract(epoch from (c.acesso_ate - now())) / 86400)::integer)
      else 0
    end as dias_restantes
  from public.clinica_usuarios cu
  join public.clinicas c on c.id = cu.clinica_id
  where cu.user_id = (select auth.uid())
    and cu.ativo = true
  order by cu.created_at, cu.clinica_id
  limit 1
$$;

create or replace function public.set_my_clinic_agenda_settings(
  p_interval_minutes integer,
  p_durations jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  minha_clinica uuid;
  tipo text;
  duracao integer;
begin
  if p_interval_minutes is null
     or p_interval_minutes not between 5 and 720
     or jsonb_typeof(p_durations) is distinct from 'object' then
    raise exception 'Configuração de agenda inválida.'
      using errcode = '22023';
  end if;

  for tipo, duracao in
    select key, value::text::integer
    from jsonb_each(p_durations)
  loop
    if tipo not in ('Consulta', 'Retorno', 'Cirurgia', 'Banho e Tosa', 'Vacina', 'Procedimento')
       or duracao not between 5 and 720 then
      raise exception 'Informe durações entre 5 e 720 minutos para os tipos de atendimento válidos.'
        using errcode = '22023';
    end if;
  end loop;

  if exists (
    select 1
    from unnest(array['Consulta', 'Retorno', 'Cirurgia', 'Banho e Tosa', 'Vacina', 'Procedimento']) as esperado(tipo)
    where not (p_durations ? esperado.tipo)
  ) then
    raise exception 'Informe a duração de todos os tipos de atendimento.'
      using errcode = '22023';
  end if;

  select cu.clinica_id into minha_clinica
  from public.clinica_usuarios cu
  where cu.user_id = (select auth.uid())
    and cu.ativo = true
    and cu.papel in ('rt', 'recepcao')
  order by cu.created_at, cu.clinica_id
  limit 1;

  if minha_clinica is null then
    raise exception 'Somente o RT ou a Recepção podem alterar as configurações da agenda.'
      using errcode = '42501';
  end if;

  update public.clinicas
  set duracao_padrao_atendimento_min = p_interval_minutes,
      duracoes_atendimento_min = p_durations,
      updated_at = now()
  where id = minha_clinica;
end;
$$;

revoke all on function public.oricse_meu_acesso() from public, anon;
revoke all on function public.set_my_clinic_agenda_settings(integer, jsonb) from public, anon;
grant execute on function public.oricse_meu_acesso() to authenticated;
grant execute on function public.set_my_clinic_agenda_settings(integer, jsonb) to authenticated;
