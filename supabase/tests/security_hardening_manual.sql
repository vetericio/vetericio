-- Executar no SQL Editor SOMENTE após aplicar 20261106111649_security_hardening.sql.
-- A verificação não preserva dados: tudo é removido no ROLLBACK.
begin;

create temp table security_hardening_result (
  teste text not null,
  esperado text not null,
  obtido text not null,
  passou boolean not null
);

do $$
declare
  tabela text;
  tabelas_internas text[] := array[
    'oricse_animal_pesos', 'oricse_animal_registros_extra',
    'oricse_clinica_ativa_usuario', 'oricse_drive_backup_outbox',
    'oricse_fila_espera', 'oricse_mercadopago_conexoes',
    'oricse_mp_oauth_sessoes', 'oricse_pagamentos', 'oricse_pessoas',
    'oricse_portal_extras', 'oricse_portal_promocoes',
    'oricse_portal_redefinicoes_senha', 'oricse_portal_tutor_config',
    'oricse_precos_portal', 'oricse_receitas_controladas',
    'oricse_taxas_modalidade', 'oricse_taxas_oricse_modalidade',
    'oricse_taxas_oricse_segmento', 'oricstudio_meta_oauth_states',
    'oricstudio_meta_tokens', 'oricstudio_threads_oauth_states',
    'oricstudio_threads_tokens', 'sync_salas'
  ];
begin
  foreach tabela in array tabelas_internas loop
    if to_regclass('public.' || tabela) is null then
      insert into security_hardening_result values (
        tabela || ': tabela opcional ausente', 'n/a', 'n/a', true
      );
    else
      insert into security_hardening_result
      select
        tabela || ': anon sem SELECT',
        'false',
        has_table_privilege('anon', format('public.%I', tabela), 'select')::text,
        not has_table_privilege('anon', format('public.%I', tabela), 'select');

      insert into security_hardening_result
      select
        tabela || ': authenticated sem escrita direta',
        'false',
        has_table_privilege('authenticated', format('public.%I', tabela), 'insert,update,delete')::text,
        not has_table_privilege('authenticated', format('public.%I', tabela), 'insert,update,delete');

      insert into security_hardening_result
      select
        tabela || ': política restritiva existe',
        'true',
        exists(
          select 1 from pg_policies
          where schemaname='public' and tablename=tabela and policyname='server_only_no_direct_api'
        )::text,
        exists(
          select 1 from pg_policies
          where schemaname='public' and tablename=tabela and policyname='server_only_no_direct_api'
        );
    end if;
  end loop;
end;
$$;

insert into security_hardening_result
select
  'rate limit não é executável por anon',
  'false',
  has_function_privilege('anon', 'public.oricse_rate_limit_allow(text,text,integer,integer)', 'execute')::text,
  not has_function_privilege('anon', 'public.oricse_rate_limit_allow(text,text,integer,integer)', 'execute');

insert into security_hardening_result
select
  'rate limit é executável por service_role',
  'true',
  has_function_privilege('service_role', 'public.oricse_rate_limit_allow(text,text,integer,integer)', 'execute')::text,
  has_function_privilege('service_role', 'public.oricse_rate_limit_allow(text,text,integer,integer)', 'execute');

insert into security_hardening_result
with tentativa as (
  select public.oricse_rate_limit_allow('teste_auditoria', 'chave-unica', 2, 600) as permitido
)
select
  'rate limit aceita a tentativa dentro da janela',
  'true',
  permitido::text,
  permitido
from tentativa;

insert into security_hardening_result
with primeira as (
  select public.oricse_rate_limit_allow('teste_auditoria', 'chave-limite', 1, 600) as permitido
), segunda as (
  select public.oricse_rate_limit_allow('teste_auditoria', 'chave-limite', 1, 600) as permitido
  from primeira
)
select
  'rate limit bloqueia a tentativa excedente',
  'false',
  permitido::text,
  not permitido
from segunda;

select teste, esperado, obtido, passou
from security_hardening_result
order by teste;

rollback;
