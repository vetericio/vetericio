begin;

create table if not exists public.oricse_estoque_contagens (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete restrict,
  produto_id uuid not null,
  produto_nome text not null,
  saldo_sistema numeric(12,3),
  saldo_contado numeric(12,3) not null check (saldo_contado >= 0),
  diferenca numeric(13,3) generated always as (saldo_contado - saldo_sistema) stored,
  saldo_referencia_em timestamptz not null,
  motivo text not null check (char_length(btrim(motivo)) between 5 and 300),
  operador_id uuid not null,
  registrado_em timestamptz not null default now(),
  requisicao_id uuid not null,
  foreign key (clinica_id, produto_id) references public.oricse_catalogo_itens(clinica_id, id) on delete restrict,
  unique (clinica_id, operador_id, requisicao_id)
);
create index if not exists oricse_estoque_contagens_clinica_data
  on public.oricse_estoque_contagens(clinica_id, registrado_em desc, id desc);

alter table public.oricse_estoque_contagens enable row level security;
revoke all on public.oricse_estoque_contagens from public, anon, authenticated;
grant select on public.oricse_estoque_contagens to authenticated;
drop policy if exists oricse_estoque_contagens_ler on public.oricse_estoque_contagens;
create policy oricse_estoque_contagens_ler on public.oricse_estoque_contagens
for select to authenticated using (
  (select auth.uid()) is not null and (
    public.oricse_usuario_pode_permissao(clinica_id,'estoque.catalogo.visualizar')
    or public.oricse_usuario_pode_permissao(clinica_id,'estoque.catalogo.gerenciar')
    or public.oricse_usuario_pode_permissao(clinica_id,'estoque.movimentar')
  )
);

create or replace function public.oricse_estoque_registrar_contagem(
  p_clinica_id uuid, p_produto_id uuid, p_saldo_contado numeric,
  p_saldo_esperado numeric, p_referencia_em timestamptz, p_motivo text, p_requisicao_id uuid
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  ator uuid := (select auth.uid());
  produto public.oricse_catalogo_itens%rowtype;
  registro public.oricse_estoque_contagens%rowtype;
  motivo text := btrim(coalesce(p_motivo,''));
begin
  if ator is null or not coalesce(public.oricse_usuario_pode_permissao(p_clinica_id,'estoque.movimentar'),false)
    or exists (select 1 from auth.users u where u.id=ator and (
      lower(coalesce(u.email,''))='alvorada@vetericio.local'
      or coalesce(u.raw_app_meta_data->>'oricse_demo_clinica','')='alvorada'
    )) then
    raise exception 'Sem permissão para registrar contagem nesta clínica.' using errcode='42501';
  end if;
  if p_clinica_id is null or p_produto_id is null or p_referencia_em is null or p_requisicao_id is null
    or p_saldo_contado is null or p_saldo_contado < 0 or p_saldo_contado > 999999999.999
    or p_saldo_contado <> round(p_saldo_contado,3)
    or char_length(motivo) not between 5 and 300 then
    raise exception 'Informe quantidade válida (até três decimais) e um motivo de 5 a 300 caracteres.' using errcode='22023';
  end if;

  -- Serializa o ajuste com PDV e movimentação manual. O valor esperado também
  -- é comparado caso um escritor antigo não altere updated_at.
  select i.* into produto from public.oricse_catalogo_itens i
  where i.clinica_id=p_clinica_id and i.id=p_produto_id and i.tipo='produto'
  for update;
  if not found then
    raise exception 'Produto não encontrado nesta clínica.' using errcode='22023';
  end if;

  select r.* into registro from public.oricse_estoque_contagens r
  where r.clinica_id=p_clinica_id and r.operador_id=ator and r.requisicao_id=p_requisicao_id;
  if found then
    if registro.produto_id is distinct from p_produto_id
      or registro.saldo_contado is distinct from p_saldo_contado
      or registro.saldo_sistema is distinct from p_saldo_esperado
      or registro.saldo_referencia_em is distinct from p_referencia_em
      or registro.motivo is distinct from motivo then
      raise exception 'Esta confirmação já foi usada com outros dados.' using errcode='22023';
    end if;
    return jsonb_build_object('id',registro.id,'saldo_contado',registro.saldo_contado);
  end if;

  if not produto.ativo then
    raise exception 'Produto inativo.' using errcode='22023';
  end if;
  if produto.updated_at is distinct from p_referencia_em or produto.estoque_atual is distinct from p_saldo_esperado then
    raise exception 'O estoque mudou. Atualize o produto e confira novamente a contagem.' using errcode='40001';
  end if;

  insert into public.oricse_estoque_contagens (
    clinica_id, produto_id, produto_nome, saldo_sistema, saldo_contado, saldo_referencia_em, motivo, operador_id, requisicao_id
  ) values (
    p_clinica_id, p_produto_id, produto.nome, produto.estoque_atual, p_saldo_contado, p_referencia_em, motivo, ator, p_requisicao_id
  ) returning * into registro;

  if produto.estoque_atual is distinct from p_saldo_contado then
    update public.oricse_catalogo_itens
      set estoque_atual=p_saldo_contado, updated_at=clock_timestamp()
    where clinica_id=p_clinica_id and id=p_produto_id;
  end if;
  return jsonb_build_object('id',registro.id,'saldo_contado',registro.saldo_contado);
end;
$$;
revoke all on function public.oricse_estoque_registrar_contagem(uuid,uuid,numeric,numeric,timestamptz,text,uuid) from public,anon,authenticated;
grant execute on function public.oricse_estoque_registrar_contagem(uuid,uuid,numeric,numeric,timestamptz,text,uuid) to authenticated;

-- Retorna exclusivamente saldo e quantidade agregada por produto. Não
-- fornece dados do caixa, preços, operadores ou metadados das vendas.
create or replace function public.oricse_estoque_observado(p_clinica_id uuid, p_busca text default '')
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  fuso constant text := 'America/Sao_Paulo';
  hoje date := (current_timestamp at time zone fuso)::date;
  primeira_venda date;
  branco constant text := 'áàâãäéèêëíìîïóòôõöúùûüç';
  sem_acento constant text := 'aaaaaeeeeiiiiooooouuuuc';
  consulta text := translate(lower(btrim(coalesce(p_busca,''))),branco,sem_acento);
  resultado jsonb;
begin
  if (select auth.uid()) is null or not coalesce((
    public.oricse_usuario_pode_permissao(p_clinica_id,'estoque.catalogo.visualizar')
    or public.oricse_usuario_pode_permissao(p_clinica_id,'estoque.catalogo.gerenciar')
    or public.oricse_usuario_pode_permissao(p_clinica_id,'estoque.movimentar')
  ),false) then
    raise exception 'Sem permissão para consultar estoque nesta clínica.' using errcode='42501';
  end if;
  if char_length(consulta) > 90 then
    raise exception 'Busque por um nome ou código de até 90 caracteres.' using errcode='22023';
  end if;
  select (v.registrada_em at time zone fuso)::date into primeira_venda
  from public.oricse_vendas_expressas v where v.clinica_id=p_clinica_id
  order by v.registrada_em limit 1;

  with produtos as materialized (
    select i.id,i.nome,i.codigo_barras,i.estoque_atual,i.estoque_minimo,i.venda_por_peso,i.updated_at,
      case when primeira_venda is not null
        then greatest(hoje-30, primeira_venda+1, (i.created_at at time zone fuso)::date+1)
      end as inicio
    from public.oricse_catalogo_itens i
    where i.clinica_id=p_clinica_id and i.tipo='produto' and i.ativo
      and (
        consulta='' or strpos(translate(lower(i.nome),branco,sem_acento),consulta)>0
        or strpos(lower(coalesce(i.codigo_barras,'')),consulta)>0
      )
    order by i.nome,i.id limit 81
  ), consumo as (
    select it.item_id,sum(it.quantidade) as quantidade
    from public.oricse_vendas_expressas v
    join public.oricse_vendas_expressas_itens it on it.clinica_id=v.clinica_id and it.venda_id=v.id
    join produtos p on p.id=it.item_id
    where v.clinica_id=p_clinica_id and p.inicio<hoje
      and v.registrada_em >= ((hoje-30)::timestamp at time zone fuso)
      and v.registrada_em < (hoje::timestamp at time zone fuso)
      and v.registrada_em >= (p.inicio::timestamp at time zone fuso)
    group by it.item_id
  ), medidas as (
    select p.id,p.nome,p.codigo_barras,p.estoque_atual,p.estoque_minimo,p.venda_por_peso,p.updated_at,
      case when p.inicio<hoje then p.inicio end as inicio,
      hoje-1 as fim,
      case when p.inicio<hoje then hoje-p.inicio else 0 end as dias,
      case when p.inicio<hoje then coalesce(m.quantidade,0) end as quantidade
    from produtos p left join consumo m on m.item_id=p.id
    order by p.nome,p.id limit 80
  )
  select jsonb_build_object(
    'produtos', coalesce((select jsonb_agg(to_jsonb(m) order by m.nome,m.id) from medidas m),'[]'::jsonb),
    'limite', (select count(*) from produtos)>80
  ) into resultado;
  return resultado;
end;
$$;
revoke all on function public.oricse_estoque_observado(uuid,text) from public,anon,authenticated;
grant execute on function public.oricse_estoque_observado(uuid,text) to authenticated;

commit;
