-- Catálogo central de serviços: Banho e Tosa utiliza os mesmos preços do cadastro geral.
-- Mantém IDs antigos dos serviços para não invalidar agendamentos.
alter table public.oricse_banho_tosa_servicos
  add column if not exists catalogo_item_id uuid references public.oricse_catalogo_itens(id) on delete set null;
create unique index if not exists oricse_banho_servico_catalogo_unico
  on public.oricse_banho_tosa_servicos (catalogo_item_id) where catalogo_item_id is not null;

-- Migrar os serviços antigos sem perder a duração existente.
do $$
declare s record; c uuid;
begin
  for s in select * from public.oricse_banho_tosa_servicos
    where catalogo_item_id is null order by created_at,id loop
    select i.id into c from public.oricse_catalogo_itens i
      where i.clinica_id=s.clinica_id and i.tipo='servico'
        and lower(btrim(i.categoria))='banho e tosa'
        and lower(btrim(i.nome))=lower(btrim(s.nome))
        and not exists(select 1 from public.oricse_banho_tosa_servicos b where b.catalogo_item_id=i.id)
      order by i.created_at limit 1;
    if c is null then
      insert into public.oricse_catalogo_itens(clinica_id,tipo,nome,categoria,valor,ativo)
      values (s.clinica_id,'servico',s.nome,'Banho e tosa',s.preco_centavos::numeric/100,s.ativo)
      returning id into c;
    end if;
    update public.oricse_banho_tosa_servicos
      set catalogo_item_id=c where id=s.id;
  end loop;
end $$;

-- Serviços de banho já existentes no catálogo que não foram vinculados.
insert into public.oricse_banho_tosa_servicos
  (clinica_id,nome,duracao_min,preco_centavos,ativo,catalogo_item_id)
select i.clinica_id,i.nome,60,round(i.valor*100)::integer,i.ativo,i.id
from public.oricse_catalogo_itens i
where i.tipo='servico' and lower(btrim(i.categoria))='banho e tosa'
  and not exists (select 1 from public.oricse_banho_tosa_servicos b where b.catalogo_item_id=i.id)
  and i.valor<=21474836;

create or replace function public.oricse_sincronizar_servico_banho_catalogo()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.tipo='servico' and lower(btrim(new.categoria))='banho e tosa' then
    if new.valor>21474836 then
      raise exception 'O valor do serviço supera o limite permitido para a agenda.'; end if;
    insert into public.oricse_banho_tosa_servicos
      (clinica_id,nome,duracao_min,preco_centavos,ativo,catalogo_item_id)
    values (new.clinica_id,new.nome,60,round(new.valor*100)::integer,new.ativo,new.id)
    on conflict (catalogo_item_id) where catalogo_item_id is not null
    do update set nome=excluded.nome,preco_centavos=excluded.preco_centavos,ativo=excluded.ativo;
  elsif tg_op='UPDATE' then
    update public.oricse_banho_tosa_servicos set ativo=false
      where catalogo_item_id=new.id;
  end if;
  return new;
end;
$$;
revoke all on function public.oricse_sincronizar_servico_banho_catalogo() from public,anon,authenticated;
drop trigger if exists oricse_banho_catalogo_sync_trg on public.oricse_catalogo_itens;
create trigger oricse_banho_catalogo_sync_trg
after insert or update of nome,categoria,valor,ativo,tipo on public.oricse_catalogo_itens
for each row execute function public.oricse_sincronizar_servico_banho_catalogo();
