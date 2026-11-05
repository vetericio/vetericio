-- Exclusão permanente manual da lixeira, somente para administrador geral.
-- Não executar cascatas de exclusão de dados clínicos, financeiros ou compartilhados.
-- A remoção e o registro da auditoria ocorrem na mesma transação.
create table if not exists public.oricse_lixeira_auditoria_permanente (
  id bigint generated always as identity primary key,
  item_tipo text not null check (item_tipo in ('solicitacao','clinica')),
  item_id uuid not null,
  item_nome text not null,
  excluido_por uuid not null,
  excluido_em timestamptz not null default now(),
  acao text not null default 'exclusao_permanente',
  detalhe text not null default 'A exclusão permanente foi solicitada pelo administrador geral.'
);
alter table public.oricse_lixeira_auditoria_permanente enable row level security;
revoke all on public.oricse_lixeira_auditoria_permanente from anon,authenticated;
grant select on public.oricse_lixeira_auditoria_permanente to authenticated;
drop policy if exists oricse_lixeira_auditoria_admin_leitura on public.oricse_lixeira_auditoria_permanente;
create policy oricse_lixeira_auditoria_admin_leitura on public.oricse_lixeira_auditoria_permanente
  for select to authenticated using (public.oricse_is_platform_admin());

create or replace function public.oricse_admin_lixeira_excluir_permanentemente(
  p_tipo text, p_id uuid, p_confirmacao text
) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_tabela regclass;
  v_nome text;
  v_id_clinica uuid;
  v_expira timestamptz;
  v_con record;
  v_coluna text;
  v_tem_vinculo boolean;
  v_tabela_vinculo text;
begin
  if not public.oricse_is_platform_admin() then
    raise exception 'Somente o administrador geral pode excluir permanentemente.' using errcode = '42501';
  end if;
  if p_confirmacao is distinct from 'APAGAR' or p_id is null then
    raise exception 'Digite APAGAR para confirmar a exclusão permanente.' using errcode = '22023';
  end if;

  if p_tipo='solicitacao' then
    v_tabela := 'public.oricse_contratacoes'::regclass;
    select clinica_nome, clinica_criada_id, expira_lixeira_em
      into v_nome, v_id_clinica, v_expira
      from public.oricse_contratacoes
      where id=p_id and excluido_em is not null for update;
    if not found then
      raise exception 'A solicitação não está na Lixeira.' using errcode = 'P0002';
    end if;
    if v_id_clinica is not null and exists(
      select 1 from public.clinicas where id=v_id_clinica and excluido_em is null
    ) then
      raise exception 'Existe uma clínica ativa ou cadastrada ligada ao pedido. Envie essa clínica à Lixeira antes de excluir a solicitação permanentemente.' using errcode='23503';
    end if;
  elsif p_tipo='clinica' then
    v_tabela := 'public.clinicas'::regclass;
    select nome, expira_lixeira_em
      into v_nome, v_expira
      from public.clinicas
      where id=p_id and excluido_em is not null for update;
    if not found then
      raise exception 'A clínica não está na Lixeira.' using errcode = 'P0002';
    end if;
  else
    raise exception 'Tipo de registro não permitido.' using errcode='22023';
  end if;

  -- Protege qualquer FK que, de outro modo, poderia apagar dados em cascata,
  -- deixar referências órfãs ou reatribuir relações financeiras.
  for v_con in
    select c.conrelid, c.conkey, c.conname
    from pg_catalog.pg_constraint c
    where c.contype='f' and c.confrelid=v_tabela
  loop
    if pg_catalog.array_length(v_con.conkey,1) <> 1 then
      raise exception 'A exclusão requer revisão técnica: referência composta em %. Nenhum dado foi apagado.',v_con.conrelid::regclass using errcode='23503';
    end if;
    select a.attname into v_coluna
    from pg_catalog.pg_attribute a
    where a.attrelid=v_con.conrelid and a.attnum=v_con.conkey[1];
    if v_coluna is null then
      raise exception 'Não foi possível verificar todos os vínculos. Exclusão bloqueada.' using errcode='23503';
    end if;
    execute pg_catalog.format('select exists (select 1 from %s where %I=$1 limit 1)',
      v_con.conrelid::regclass,v_coluna
    ) into v_tem_vinculo using p_id;
    if v_tem_vinculo then
      v_tabela_vinculo:=v_con.conrelid::regclass::text;
      raise exception 'Exclusão bloqueada: o registro possui dados vinculados em %. Nenhum registro foi apagado.',v_tabela_vinculo using errcode='23503';
    end if;
  end loop;

  insert into public.oricse_lixeira_auditoria_permanente
    (item_tipo,item_id,item_nome,excluido_por)
  values (p_tipo,p_id,v_nome,(select auth.uid()));

  if p_tipo='solicitacao' then
    delete from public.oricse_contratacoes where id=p_id and excluido_em is not null;
  else
    delete from public.clinicas where id=p_id and excluido_em is not null;
  end if;
  if not found then
    raise exception 'A exclusão não foi concluída, nenhum registro foi removido.' using errcode='P0002';
  end if;
  return jsonb_build_object('ok',true,'tipo',p_tipo,'id',p_id,'nome',v_nome);
end
$$;

revoke all on function public.oricse_admin_lixeira_excluir_permanentemente(text,uuid,text) from public,anon;
grant execute on function public.oricse_admin_lixeira_excluir_permanentemente(text,uuid,text) to authenticated;
