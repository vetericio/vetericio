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
    if jsonb_typeof(v_item) <> 'object' or jsonb_typeof(v_item->'valor') <> 'number'
    then return false; end if;
    v_valor := (v_item->>'valor')::numeric;
    if v_valor < 0 or v_valor > 9999999 or v_valor <> round(v_valor, 2)
    then return false; end if;

    if v_indice = v_qtd then
      if v_item->'ateKg' <> 'null'::jsonb then return false; end if;
    else
      if jsonb_typeof(v_item->'ateKg') <> 'number' then return false; end if;
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

comment on column public.oricse_catalogo_itens.faixas_peso is
  'Faixas consecutivas de serviços com peso em kg; ateKg inclusivo; último ateKg null. A escolha exige aprovação explícita antes da comanda.';
commit;
