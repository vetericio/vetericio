create or replace function public.oricse_guardar_movimentacao_estoque()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.tipo = 'produto'
       and coalesce(new.estoque_atual, 0) <> 0
       and not public.oricse_usuario_pode_permissao(new.clinica_id, 'estoque.movimentar') then
      raise exception 'Sem permissão para definir estoque inicial.' using errcode='42501';
    end if;
  elsif tg_op = 'UPDATE' then
    if new.estoque_atual is distinct from old.estoque_atual
       and not public.oricse_usuario_pode_permissao(new.clinica_id, 'estoque.movimentar') then
      raise exception 'Sem permissão para movimentar estoque.' using errcode='42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists oricse_catalogo_guardar_estoque_trg on public.oricse_catalogo_itens;
create trigger oricse_catalogo_guardar_estoque_trg
before insert or update of estoque_atual on public.oricse_catalogo_itens
for each row execute function public.oricse_guardar_movimentacao_estoque();

revoke all on function public.oricse_guardar_movimentacao_estoque() from public,anon,authenticated;
