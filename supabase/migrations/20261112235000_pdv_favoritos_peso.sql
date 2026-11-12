-- Venda por peso com três casas decimais e favoritos exclusivos por operador.
alter table public.oricse_catalogo_itens
  add column if not exists venda_por_peso boolean not null default false;

alter table public.oricse_vendas_expressas_itens
  alter column quantidade type numeric(12,3) using quantidade::numeric(12,3);

create table if not exists public.oricse_pdv_favoritos (
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null,
  criado_em timestamptz not null default now(),
  primary key (clinica_id,usuario_id,item_id),
  foreign key (clinica_id,item_id) references public.oricse_catalogo_itens(clinica_id,id) on delete cascade
);
create index if not exists oricse_pdv_favoritos_usuario_idx
 on public.oricse_pdv_favoritos(usuario_id,clinica_id);
alter table public.oricse_pdv_favoritos enable row level security;
revoke all on public.oricse_pdv_favoritos from public,anon;
grant select,insert,delete on public.oricse_pdv_favoritos to authenticated;
drop policy if exists pdv_favoritos_select on public.oricse_pdv_favoritos;
create policy pdv_favoritos_select on public.oricse_pdv_favoritos for select to authenticated
using (usuario_id=(select auth.uid()) and
 (public.oricse_usuario_pode_permissao(clinica_id,'caixa.comandas')
  or public.oricse_usuario_pode_permissao(clinica_id,'caixa.financeiro.gerenciar')));
drop policy if exists pdv_favoritos_insert on public.oricse_pdv_favoritos;
create policy pdv_favoritos_insert on public.oricse_pdv_favoritos for insert to authenticated
with check (usuario_id=(select auth.uid()) and
 (public.oricse_usuario_pode_permissao(clinica_id,'caixa.comandas')
  or public.oricse_usuario_pode_permissao(clinica_id,'caixa.financeiro.gerenciar')));
drop policy if exists pdv_favoritos_delete on public.oricse_pdv_favoritos;
create policy pdv_favoritos_delete on public.oricse_pdv_favoritos for delete to authenticated
using (usuario_id=(select auth.uid()) and
 (public.oricse_usuario_pode_permissao(clinica_id,'caixa.comandas')
  or public.oricse_usuario_pode_permissao(clinica_id,'caixa.financeiro.gerenciar')));

-- O servidor continua calculando preços e totais, sem confiar em valores do navegador.
-- Quantidades fracionárias só são aceitas se o produto estiver marcado como vendido por peso.
create or replace function public.oricse_venda_expressa_finalizar(
  p_clinica_id uuid,
  p_idempotencia uuid,
  p_itens jsonb,
  p_forma_pagamento text,
  p_recebido_centavos integer default null
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  usuario uuid := (select auth.uid());
  venda_id uuid;
  anterior record;
  detalhe record;
  produto record;
  total bigint := 0;
  subtotal bigint;
  contagem integer := 0;
  recebido integer;
  troco integer := 0;
begin
  if usuario is null then raise exception 'Faça login para vender.' using errcode='42501'; end if;
  if not exists(select 1 from public.clinicas c where c.id=p_clinica_id and c.status='ativa' and c.excluido_em is null)
    then raise exception 'Clínica não está ativa.' using errcode='42501'; end if;
  if not (public.oricse_usuario_pode_permissao(p_clinica_id,'caixa.financeiro.gerenciar')
    or public.oricse_usuario_pode_permissao(p_clinica_id,'caixa.comandas'))
    then raise exception 'Sem permissão para operar o caixa.' using errcode='42501'; end if;
  if p_idempotencia is null then raise exception 'Identificador da venda obrigatório.'; end if;
  -- Bloqueia retries concorrentes sem possibilitar uma segunda venda.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_clinica_id::text || p_idempotencia::text, 0));
  select id,valor_centavos,troco_centavos into anterior from public.oricse_vendas_expressas
    where clinica_id=p_clinica_id and idempotencia=p_idempotencia;
  if found then
    return pg_catalog.jsonb_build_object('id',anterior.id,'total_centavos',anterior.valor_centavos,
      'troco_centavos',anterior.troco_centavos,'repetida',true);
  end if;
  if p_forma_pagamento not in ('Dinheiro','Pix','Cartão de débito','Cartão de crédito')
    then raise exception 'Forma de pagamento não permitida.'; end if;
  if pg_catalog.jsonb_typeof(p_itens) <> 'array' or pg_catalog.jsonb_array_length(p_itens) < 1
    or pg_catalog.jsonb_array_length(p_itens) > 100
    then raise exception 'Informe entre 1 e 100 itens.'; end if;
  -- Quantidades inteiras por produto, sem duplicatas, calculadas no servidor.
  for detalhe in
    select (j->>'id')::uuid as id, sum((j->>'quantidade')::numeric) as quantidade
    from pg_catalog.jsonb_array_elements(p_itens) as j
    group by (j->>'id')::uuid order by (j->>'id')::uuid
  loop
    if detalhe.quantidade <= 0 or detalhe.quantidade > 10000 or detalhe.quantidade <> pg_catalog.round(detalhe.quantidade,3)
      then raise exception 'Quantidade inválida.'; end if;
    select i.* into produto from public.oricse_catalogo_itens i
      where i.clinica_id=p_clinica_id and i.id=detalhe.id and i.tipo='produto' and i.ativo=true
      for update;
    if not found then raise exception 'Produto não encontrado ou inativo.'; end if;
    if not produto.venda_por_peso and detalhe.quantidade <> pg_catalog.trunc(detalhe.quantidade) then
      raise exception 'O produto % é vendido apenas em unidades inteiras.',produto.nome;
    end if;
    if produto.estoque_atual is null then
      raise exception 'Configure o estoque de % antes de vender.', produto.nome;
    end if;
    if produto.estoque_atual < detalhe.quantidade
      then raise exception 'Estoque insuficiente para % (disponível: %).',produto.nome,produto.estoque_atual; end if;
    subtotal := pg_catalog.round(produto.valor * detalhe.quantidade * 100)::bigint;
    if subtotal < 0 then raise exception 'Preço inválido.'; end if;
    total := total + subtotal;
    contagem := contagem + 1;
  end loop;
  if total <= 0 or total > 2147483647 then raise exception 'Valor total da venda inválido.'; end if;
  if p_forma_pagamento='Dinheiro' then
    recebido := p_recebido_centavos;
    if recebido is null or recebido < total then raise exception 'Dinheiro recebido insuficiente.'; end if;
    troco := recebido - total;
  else
    recebido := total::integer;
    troco := 0;
  end if;
  perform pg_catalog.set_config('oricse.pdv_clinica',p_clinica_id::text,true);
  insert into public.oricse_vendas_expressas
    (clinica_id,idempotencia,operador_id,valor_centavos,forma_pagamento,recebido_centavos,troco_centavos)
  values (p_clinica_id,p_idempotencia,usuario,total::integer,p_forma_pagamento,recebido,troco)
  returning id into venda_id;
  for detalhe in
    select (j->>'id')::uuid as id, sum((j->>'quantidade')::numeric) as quantidade
    from pg_catalog.jsonb_array_elements(p_itens) as j
    group by (j->>'id')::uuid order by (j->>'id')::uuid
  loop
    select i.* into produto from public.oricse_catalogo_itens i where i.clinica_id=p_clinica_id and i.id=detalhe.id for update;
    subtotal := pg_catalog.round(produto.valor * detalhe.quantidade * 100)::bigint;
    update public.oricse_catalogo_itens set estoque_atual=estoque_atual-detalhe.quantidade,updated_at=now()
      where clinica_id=p_clinica_id and id=detalhe.id;
    insert into public.oricse_vendas_expressas_itens
      (venda_id,clinica_id,item_id,nome_snapshot,codigo_barras_snapshot,quantidade,preco_unitario_centavos,subtotal_centavos)
    values(venda_id,p_clinica_id,detalhe.id,produto.nome,produto.codigo_barras,
      detalhe.quantidade,pg_catalog.round(produto.valor*100)::integer,subtotal::integer);
  end loop;
  insert into public.oricse_caixa_lancamentos
    (clinica_id,setor,origem_tipo,origem_id,tipo,status,descricao,valor_centavos,forma_pagamento,
     registrado_por,detalhes,data_competencia)
  values(p_clinica_id,'Venda Expressa','venda_expressa',venda_id,'entrada','pago',
    'Venda Expressa · ' || contagem || ' produto(s)',total::integer,p_forma_pagamento,
    usuario,pg_catalog.jsonb_build_object('venda_id',venda_id,'troco_centavos',troco),current_date);
  return pg_catalog.jsonb_build_object('id',venda_id,'total_centavos',total,
    'troco_centavos',troco,'repetida',false);
end $$;
revoke all on function public.oricse_venda_expressa_finalizar(uuid,uuid,jsonb,text,integer) from public,anon;
grant execute on function public.oricse_venda_expressa_finalizar(uuid,uuid,jsonb,text,integer) to authenticated;

