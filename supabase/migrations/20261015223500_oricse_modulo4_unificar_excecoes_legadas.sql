-- Mantém compatibilidade com a tela Admin antiga sem criar duas fontes divergentes.

create or replace function public.oricse_sync_autorizacao_legada_para_excecao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if pg_trigger_depth() > 1 then
    return coalesce(new,old);
  end if;
  if tg_op='DELETE' then
    delete from public.oricse_clinica_funcionalidade_excecoes
    where clinica_id=old.clinica_id and funcionalidade_codigo=old.funcionalidade_codigo;
    return old;
  end if;
  insert into public.oricse_clinica_funcionalidade_excecoes(
    clinica_id,funcionalidade_codigo,permitido,motivo,criado_por,updated_at
  ) values (
    new.clinica_id,new.funcionalidade_codigo,new.decisao='permitir',coalesce(new.motivo,''),new.atualizado_por,now()
  )
  on conflict (clinica_id,funcionalidade_codigo) do update set
    permitido=excluded.permitido,
    motivo=excluded.motivo,
    updated_at=now();
  return new;
end;
$$;

create or replace function public.oricse_sync_excecao_para_autorizacao_legada()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if pg_trigger_depth() > 1 then
    return coalesce(new,old);
  end if;
  if tg_op='DELETE' then
    delete from public.oricse_clinica_autorizacoes
    where clinica_id=old.clinica_id and funcionalidade_codigo=old.funcionalidade_codigo;
    return old;
  end if;
  insert into public.oricse_clinica_autorizacoes(
    clinica_id,funcionalidade_codigo,decisao,motivo,atualizado_por,atualizado_em
  ) values (
    new.clinica_id,new.funcionalidade_codigo,case when new.permitido then 'permitir' else 'bloquear' end,new.motivo,new.criado_por,now()
  )
  on conflict (clinica_id,funcionalidade_codigo) do update set
    decisao=excluded.decisao,
    motivo=excluded.motivo,
    atualizado_por=excluded.atualizado_por,
    atualizado_em=now();
  return new;
end;
$$;

drop trigger if exists oricse_sync_autorizacao_legada on public.oricse_clinica_autorizacoes;
create trigger oricse_sync_autorizacao_legada
after insert or update or delete on public.oricse_clinica_autorizacoes
for each row execute function public.oricse_sync_autorizacao_legada_para_excecao();

drop trigger if exists oricse_sync_excecao_nova on public.oricse_clinica_funcionalidade_excecoes;
create trigger oricse_sync_excecao_nova
after insert or update or delete on public.oricse_clinica_funcionalidade_excecoes
for each row execute function public.oricse_sync_excecao_para_autorizacao_legada();

create or replace function public.oricse_tem_funcionalidade(p_clinica uuid, p_funcionalidade text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.oricse_plano_permite(p_clinica,p_funcionalidade);
$$;

create or replace function public.oricse_verificar_funcionalidade(p_clinica uuid, p_funcionalidade text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.oricse_plano_permite(p_clinica,p_funcionalidade) then
    raise exception 'Funcionalidade não autorizada para esta clínica' using errcode='42501';
  end if;
end;
$$;

revoke all on function public.oricse_sync_autorizacao_legada_para_excecao() from public,anon,authenticated;
revoke all on function public.oricse_sync_excecao_para_autorizacao_legada() from public,anon,authenticated;
revoke all on function public.oricse_tem_funcionalidade(uuid,text) from public,anon;
revoke all on function public.oricse_verificar_funcionalidade(uuid,text) from public,anon;
grant execute on function public.oricse_tem_funcionalidade(uuid,text) to authenticated;
grant execute on function public.oricse_verificar_funcionalidade(uuid,text) to authenticated;
