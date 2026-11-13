-- Trilha imutável de movimentações de estoque (a partir desta migração).
-- Não altera saldos, preços, vendas ou cobranças.
create table if not exists public.oricse_historico_estoque (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete restrict,
  item_id uuid references public.oricse_catalogo_itens(id) on delete set null,
  item_nome text not null,
  tipo text not null check (tipo in ('entrada','saida')),
  quantidade numeric(15,3) not null check (quantidade > 0),
  estoque_anterior numeric(15,3) not null,
  estoque_posterior numeric(15,3) not null,
  usuario_id uuid,
  registrado_em timestamptz not null default now()
);
create index if not exists oricse_historico_estoque_clinica_data
  on public.oricse_historico_estoque (clinica_id,registrado_em desc);
alter table public.oricse_historico_estoque enable row level security;
revoke all on public.oricse_historico_estoque from public,anon,authenticated;
grant select on public.oricse_historico_estoque to authenticated;
drop policy if exists historico_estoque_leitura on public.oricse_historico_estoque;
create policy historico_estoque_leitura on public.oricse_historico_estoque for select to authenticated
using (
  public.oricse_usuario_pode_permissao(clinica_id,'estoque.catalogo.visualizar')
  or public.oricse_usuario_pode_permissao(clinica_id,'estoque.movimentar')
);
create or replace function public.oricse_auditar_estoque()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  anterior numeric(15,3);
  posterior numeric(15,3);
  diferenca numeric(15,3);
begin
  if new.tipo <> 'produto' then return new; end if;
  anterior := case when tg_op='INSERT' then 0 else coalesce(old.estoque_atual,0) end;
  posterior := coalesce(new.estoque_atual,0);
  diferenca := posterior-anterior;
  if diferenca=0 then return new; end if;
  insert into public.oricse_historico_estoque
    (clinica_id,item_id,item_nome,tipo,quantidade,estoque_anterior,estoque_posterior,usuario_id)
  values
    (new.clinica_id,new.id,new.nome,case when diferenca>0 then 'entrada' else 'saida' end,
     abs(diferenca),anterior,posterior,(select auth.uid()));
  return new;
end;
$$;
revoke all on function public.oricse_auditar_estoque() from public,anon,authenticated;
drop trigger if exists oricse_catalogo_historico_estoque_trg on public.oricse_catalogo_itens;
create trigger oricse_catalogo_historico_estoque_trg
after insert or update of estoque_atual on public.oricse_catalogo_itens
for each row execute function public.oricse_auditar_estoque();
