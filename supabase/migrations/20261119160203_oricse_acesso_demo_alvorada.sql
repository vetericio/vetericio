create schema if not exists oricse_private;
revoke all on schema oricse_private from public, anon, authenticated;

-- Marca administrada pelo servidor. O e-mail técnico é reservado ao perfil Alvorada.
update auth.users as u
set raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb)
    || '{"oricse_demo_clinica":"alvorada"}'::jsonb
where lower(u.email) = 'alvorada@vetericio.local'
  and exists (
    select 1
    from public.app_users p
    join public.clinica_usuarios v on v.user_id = p.user_id and v.ativo
    join public.clinicas c on c.id = v.clinica_id and c.slug = 'alvorada'
    where p.user_id = u.id and p.username = 'alvorada' and p.role <> 'admin'
  );

-- Os gatilhos cobrem PostgREST e procedimentos SECURITY DEFINER. A identidade
-- vem do JWT, e a classificação da conta vem do cadastro Auth no servidor.
create or replace function oricse_private.bloquear_operacao_demo_alvorada()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ator uuid := auth.uid();
  demo boolean;
  operacao text := tg_argv[0];
begin
  if ator is null then return new; end if;

  case operacao
    when 'exame' then
      if new.drive_arquivo_id is null and new.visivel_tutor is false then return new; end if;
    when 'arquivo' then
      if new.categoria not in ('documentos', 'exames', 'receitas') then return new; end if;
    when 'caixa' then
      if new.tipo <> 'entrada' or new.status <> 'pago' then return new; end if;
    when 'comanda' then
      if tg_op = 'INSERT' then
        if coalesce(new.total_pago, 0) = 0
          and coalesce(new.pagamentos, '[]'::jsonb) = '[]'::jsonb then return new; end if;
      elsif new.total_pago is not distinct from old.total_pago
        and new.pagamentos is not distinct from old.pagamentos then
        return new;
      end if;
    when 'agenda' then
      if tg_op = 'UPDATE' then
        if new.pagamento_id is not distinct from old.pagamento_id
          and new.pagamento_valor_centavos is not distinct from old.pagamento_valor_centavos
          and new.pagamento_confirmado_em is not distinct from old.pagamento_confirmado_em then return new; end if;
      end if;
      if new.pagamento_id is null and coalesce(new.pagamento_valor_centavos, 0) = 0
        and new.pagamento_confirmado_em is null then return new; end if;
      if exists (select 1 from public.clinicas c where c.id = new.clinica_id and c.slug = 'alvorada') then
        raise exception using errcode = '42501',
          message = 'Cobranças estão indisponíveis na demonstração Alvorada.';
      end if;
    else
      null;
  end case;

  select exists (
    select 1 from auth.users u where u.id = ator and (
      lower(u.email) = 'alvorada@vetericio.local'
      or u.raw_app_meta_data ->> 'oricse_demo_clinica' = 'alvorada'
    )
  ) into demo;
  if not demo then return new; end if;

  if operacao in ('documento', 'arquivo', 'exame') then
    raise exception using errcode = '42501',
      message = 'A demonstração Alvorada não permite assinar, emitir ou publicar documentos.';
  end if;
  raise exception using errcode = '42501',
    message = 'Cobranças e recebimentos estão indisponíveis na demonstração Alvorada.';
end;
$$;

revoke all on function oricse_private.bloquear_operacao_demo_alvorada() from public, anon, authenticated;

do $$
declare
  regra record;
begin
  for regra in select * from (values
    ('oricse_portal_documentos', 'documento'),
    ('oricse_portal_exames', 'exame'),
    ('oricse_portal_receitas', 'documento'),
    ('oricse_receitas_controladas', 'documento'),
    ('oricse_selos_profissionais', 'documento'),
    ('drive_arquivos', 'arquivo'),
    ('oricse_caixa_lancamentos', 'caixa'),
    ('oricse_portal_comandas', 'comanda'),
    ('oricse_agendamentos_online', 'agenda'),
    ('oricse_vendas_expressas', 'cobranca'),
    ('oricse_banho_tosa_pagamentos', 'cobranca'),
    ('oricse_pagamentos', 'cobranca'),
    ('oricstudio_solicitacoes', 'cobranca')
  ) as regras(tabela, operacao)
  loop
    -- A emissão controlada só usa esta tabela em instalações legadas.
    if regra.tabela = 'oricse_receitas_controladas'
      and to_regclass('public.oricse_receitas_controladas') is null then continue; end if;
    execute format('drop trigger if exists oricse_demo_alvorada on public.%I', regra.tabela);
    execute format(
      'create trigger oricse_demo_alvorada before insert or update on public.%I for each row execute function oricse_private.bloquear_operacao_demo_alvorada(%L)',
      regra.tabela, regra.operacao
    );
  end loop;
end;
$$;

drop policy if exists oricse_selos_leitura_demo on public.oricse_selos_profissionais;
create policy oricse_selos_leitura_demo on public.oricse_selos_profissionais
  as restrictive for select to authenticated using (
    coalesce(lower(auth.jwt() ->> 'email'), '') <> 'alvorada@vetericio.local'
    and coalesce(auth.jwt() -> 'app_metadata' ->> 'oricse_demo_clinica', '') <> 'alvorada'
  );
