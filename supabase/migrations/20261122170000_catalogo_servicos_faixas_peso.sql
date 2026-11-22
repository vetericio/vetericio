-- Preço por faixas de peso em serviços do catálogo ORICSE.
-- Adição não destrutiva: os serviços antigos e suas cobranças permanecem intactos.
begin;

create or replace function public.oricse_faixas_peso_validas(p_faixas jsonb)
returns boolean
language plpgsql immutable set search_path = ''
as $$
declare
  v_item jsonb;
  v_indice integer := 0;
  v_qtd integer;
  v_anterior numeric := 0;
  v_limite numeric;
  v_valor numeric;
begin
  if p_faixas is null or jsonb_typeof(p_faixas) <> 'array' then return false; end if;
  v_qtd := jsonb_array_length(p_faixas);
  if v_qtd = 0 then return true; end if;
  if v_qtd < 2 or v_qtd > 20 then return false; end if;
  for v_item in select value from jsonb_array_elements(p_faixas)
  loop
    v_indice := v_indice + 1;
    if jsonb_typeof(v_item) is distinct from 'object' or
      jsonb_typeof(v_item->'valor') is distinct from 'number'
    then return false; end if;
    v_valor := (v_item->>'valor')::numeric;
    if v_valor < 0 or v_valor > 9999999 or v_valor <> round(v_valor, 2)
    then return false; end if;

    if v_indice = v_qtd then
      if not (v_item ? 'ateKg') or v_item->'ateKg' <> 'null'::jsonb
      then return false; end if;
    else
      if jsonb_typeof(v_item->'ateKg') is distinct from 'number' then return false; end if;
      v_limite := (v_item->>'ateKg')::numeric;
      if v_limite <= v_anterior or v_limite > 9999 or
         v_limite <> round(v_limite, 3) then return false; end if;
      v_anterior := v_limite;
    end if;
  end loop;
  return true;
exception when others then
  return false;
end;
$$;

alter table public.oricse_catalogo_itens
  add column if not exists faixas_peso jsonb not null default '[]'::jsonb;

alter table public.oricse_catalogo_itens
  drop constraint if exists oricse_catalogo_faixas_peso_validas;

alter table public.oricse_catalogo_itens
  add constraint oricse_catalogo_faixas_peso_validas
  check (public.oricse_faixas_peso_validas(faixas_peso) and
    (tipo = 'servico' or faixas_peso = '[]'::jsonb));

-- Médicos-veterinários e operadores de caixa precisam consultar os preços para
-- sugerir faixas, sem receber autorização de editar serviços.
drop policy if exists oricse_catalogo_leitura_atendimento_preco_peso
  on public.oricse_catalogo_itens;
create policy oricse_catalogo_leitura_atendimento_preco_peso
  on public.oricse_catalogo_itens for select to authenticated
  using (
    public.oricse_usuario_pode_permissao(clinica_id, 'consultorio.atendimentos')
    or public.oricse_usuario_pode_permissao(clinica_id, 'caixa.comandas')
  );


-- A conversão de serviços legados é transacional: ou cria o serviço novo
-- e arquiva TODOS os itens selecionados, ou não muda nenhum deles.
create table if not exists public.oricse_catalogo_agrupamentos_peso (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id),
  novo_servico_id uuid not null references public.oricse_catalogo_itens(id),
  originais_ids uuid[] not null,
  realizado_por uuid not null,
  realizado_em timestamptz not null default now()
);
alter table public.oricse_catalogo_agrupamentos_peso enable row level security;
revoke all on public.oricse_catalogo_agrupamentos_peso from public,anon,authenticated;
grant select,insert on public.oricse_catalogo_agrupamentos_peso to authenticated;
drop policy if exists oricse_agrupamentos_leitura_equipe on public.oricse_catalogo_agrupamentos_peso;
create policy oricse_agrupamentos_leitura_equipe on public.oricse_catalogo_agrupamentos_peso
  for select to authenticated using (
    public.oricse_usuario_pode_permissao(clinica_id,'estoque.catalogo.gerenciar')
  );
drop policy if exists oricse_agrupamentos_registro_gestor on public.oricse_catalogo_agrupamentos_peso;
create policy oricse_agrupamentos_registro_gestor on public.oricse_catalogo_agrupamentos_peso
  for insert to authenticated with check (
    realizado_por=(select auth.uid()) and
    public.oricse_usuario_pode_permissao(clinica_id,'estoque.catalogo.gerenciar')
  );

create or replace function public.oricse_agrupar_servicos_peso(
  p_clinica uuid, p_originais uuid[], p_nome text, p_faixas jsonb
) returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare
  v_qtd integer;
  v_count integer;
  v_categoria text;
  v_novo uuid;
begin
  if (select auth.uid()) is null or
     not public.oricse_usuario_pode_permissao(p_clinica, 'estoque.catalogo.gerenciar') then
    raise exception 'Sem permissão para agrupar serviços desta clínica.' using errcode='42501';
  end if;
  v_qtd := coalesce(array_length(p_originais,1),0);
  if v_qtd < 2 or v_qtd > 20 or
     (select count(distinct id) from unnest(p_originais) as ids(id)) <> v_qtd then
    raise exception 'Selecione entre 2 e 20 serviços diferentes.';
  end if;
  if char_length(btrim(coalesce(p_nome,''))) not between 3 and 120
     or not public.oricse_faixas_peso_validas(p_faixas)
     or jsonb_array_length(p_faixas) <> v_qtd then
    raise exception 'Revise o nome e as faixas do agrupamento.';
  end if;
  select count(*),min(categoria) into v_count,v_categoria
  from (
    select id,categoria from public.oricse_catalogo_itens
      where clinica_id=p_clinica and tipo='servico' and ativo=true
        and id = any(p_originais)
      for update
  ) fix;
  if v_count<>v_qtd then
    raise exception 'Algum serviço não está ativo ou não pertence à clínica.';
  end if;
  if exists (
    select 1 from public.oricse_catalogo_itens
    where clinica_id=p_clinica and ativo=true and lower(nome)=lower(btrim(p_nome))
  ) then
    raise exception 'Já existe um serviço ativo com esse nome.';
  end if;
  -- A faixa é montada com o preço original de cada serviço; a edição
  -- dos valores pode ocorrer depois no novo cadastro.
  if exists (
    select 1
    from unnest(p_originais) with ordinality as origem(id,ord)
    join public.oricse_catalogo_itens item on item.id=origem.id
    join lateral jsonb_array_elements(p_faixas) with ordinality as faixa(dados,ord) on faixa.ord=origem.ord
    where item.valor <> (faixa.dados->>'valor')::numeric
  ) then raise exception 'Os preços mudaram; atualize a lista antes de agrupar.'; end if;

  insert into public.oricse_catalogo_itens
    (clinica_id,tipo,nome,categoria,valor,faixas_peso,criado_por)
  values
    (p_clinica,'servico',btrim(p_nome),coalesce(v_categoria,'Outros'),
      (p_faixas->0->>'valor')::numeric,p_faixas,(select auth.uid()))
  returning id into v_novo;

  update public.oricse_catalogo_itens set ativo=false,updated_at=now()
    where clinica_id=p_clinica and id=any(p_originais);
  insert into public.oricse_catalogo_agrupamentos_peso
    (clinica_id,novo_servico_id,originais_ids,realizado_por)
  values (p_clinica,v_novo,p_originais,(select auth.uid()));
  return v_novo;
end;
$$;
revoke all on function public.oricse_agrupar_servicos_peso(uuid,uuid[],text,jsonb)
  from public,anon;
grant execute on function public.oricse_agrupar_servicos_peso(uuid,uuid[],text,jsonb)
  to authenticated;

comment on column public.oricse_catalogo_itens.faixas_peso is
  'Faixas consecutivas de serviços com peso em kg; ateKg inclusivo; último ateKg null. A escolha exige aprovação explícita antes da comanda.';
commit;
