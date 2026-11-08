begin;

-- Tabelas internas: o cliente nunca deve acessá-las diretamente. O acesso
-- acontece somente por funções de servidor/Edge Functions com service_role.
do $$
declare
  tabela text;
  tabelas_internas text[] := array[
    'oricse_animal_pesos',
    'oricse_animal_registros_extra',
    'oricse_clinica_ativa_usuario',
    'oricse_drive_backup_outbox',
    'oricse_fila_espera',
    'oricse_mercadopago_conexoes',
    'oricse_mp_oauth_sessoes',
    'oricse_pagamentos',
    'oricse_pessoas',
    'oricse_portal_extras',
    'oricse_portal_promocoes',
    'oricse_portal_redefinicoes_senha',
    'oricse_portal_tutor_config',
    'oricse_precos_portal',
    'oricse_receitas_controladas',
    'oricse_taxas_modalidade',
    'oricse_taxas_oricse_modalidade',
    'oricse_taxas_oricse_segmento',
    'oricstudio_meta_oauth_states',
    'oricstudio_meta_tokens',
    'oricstudio_threads_oauth_states',
    'oricstudio_threads_tokens',
    'sync_salas'
  ];
begin
  foreach tabela in array tabelas_internas loop
    if to_regclass('public.' || tabela) is not null then
      execute format('alter table public.%I enable row level security', tabela);
      execute format('revoke all on table public.%I from anon, authenticated', tabela);
      if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = tabela
          and policyname = 'server_only_no_direct_api'
      ) then
        execute format(
          'create policy server_only_no_direct_api on public.%I as restrictive for all to anon, authenticated using (false) with check (false)',
          tabela
        );
      end if;
    end if;
  end loop;
end;
$$;

-- Rate limiting persistente do login público do portal. A função é privada
-- para anon/authenticated e invocada somente pela Edge Function com service_role.
create schema if not exists private;

create table if not exists private.oricse_rate_limits (
  escopo text not null check (char_length(escopo) between 1 and 80),
  chave text not null check (char_length(chave) between 1 and 240),
  inicio_janela timestamptz not null,
  tentativas integer not null default 0 check (tentativas >= 0),
  primary key (escopo, chave, inicio_janela)
);

revoke all on table private.oricse_rate_limits from public, anon, authenticated;

create or replace function public.oricse_rate_limit_allow(
  p_escopo text,
  p_chave text,
  p_limite integer default 8,
  p_janela_segundos integer default 600
)
returns boolean
language plpgsql
security definer
set search_path = private, public, pg_temp
as $$
declare
  v_inicio timestamptz;
  v_tentativas integer;
begin
  if char_length(coalesce(p_escopo, '')) not between 1 and 80
    or char_length(coalesce(p_chave, '')) not between 1 and 240
    or p_limite not between 1 and 100
    or p_janela_segundos not between 60 and 86400 then
    raise exception 'Parâmetros de limite inválidos';
  end if;

  v_inicio := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / p_janela_segundos) * p_janela_segundos
  );

  insert into private.oricse_rate_limits (escopo, chave, inicio_janela, tentativas)
  values (p_escopo, p_chave, v_inicio, 1)
  on conflict (escopo, chave, inicio_janela) do update
    set tentativas = private.oricse_rate_limits.tentativas + 1
    where private.oricse_rate_limits.tentativas < p_limite
  returning tentativas into v_tentativas;

  return found and v_tentativas <= p_limite;
end;
$$;

revoke all on function public.oricse_rate_limit_allow(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.oricse_rate_limit_allow(text, text, integer, integer) to service_role;

-- Funções públicas que precisam permanecer disponíveis não podem resolver
-- objetos por um search_path gravável. Instalações mais antigas podem não ter
-- todos os endpoints de portal; nesses casos, a migration permanece aplicável.
do $$
declare
  assinatura text;
begin
  foreach assinatura in array array[
    'public.oricse_clinica_publica_portal(text,text)',
    'public.oricse_portal_config_publica(text)',
    'public.oricse_portal_extras_publicas(text)',
    'public.oricse_portal_tutor_clinica(text)'
  ] loop
    if to_regprocedure(assinatura) is not null then
      execute format('alter function %s set search_path = ''''', assinatura);
    end if;
  end loop;
end;
$$;

commit;
