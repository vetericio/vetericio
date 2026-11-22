-- Amplia os preços condicionais do catálogo sem alterar serviços já cadastrados.
begin;

create or replace function public.oricse_faixas_peso_validas(p_faixas jsonb)
returns boolean
language plpgsql immutable set search_path = ''
as $$
declare
  v_item jsonb;
  v_especie text;
  v_sexo text;
  v_indice integer;
  v_qtd integer;
  v_anterior numeric;
  v_limite numeric;
  v_valor numeric;
begin
  if p_faixas is null or jsonb_typeof(p_faixas) <> 'array' then return false; end if;
  v_qtd := jsonb_array_length(p_faixas);
  if v_qtd = 0 then return true; end if;
  if v_qtd > 20 then return false; end if;

  -- Primeiro valida cada preço e as condições opcionais.
  for v_item in select value from jsonb_array_elements(p_faixas)
  loop
    if jsonb_typeof(v_item) is distinct from 'object' or
      jsonb_typeof(v_item->'valor') is distinct from 'number' or
      coalesce(jsonb_typeof(v_item->'ateKg'), 'null') not in ('number','null') or
      coalesce(v_item->>'especie','') not in ('','Cão','Gato') or
      coalesce(v_item->>'sexo','') not in ('','Macho','Fêmea')
    then return false; end if;
    v_valor := (v_item->>'valor')::numeric;
    if v_valor < 0 or v_valor > 9999999 or v_valor <> round(v_valor, 2) then return false; end if;
    if jsonb_typeof(v_item->'ateKg') = 'number' then
      v_limite := (v_item->>'ateKg')::numeric;
      if v_limite <= 0 or v_limite > 9999 or v_limite <> round(v_limite, 3) then return false; end if;
    end if;
  end loop;

  -- Cada combinação de espécie e sexo possui sua própria sequência de peso.
  for v_especie, v_sexo in
    select distinct coalesce(value->>'especie',''), coalesce(value->>'sexo','')
    from jsonb_array_elements(p_faixas)
  loop
    v_indice := 0; v_anterior := 0;
    select count(*) into v_qtd from jsonb_array_elements(p_faixas) as faixa(value)
      where coalesce(faixa.value->>'especie','') = v_especie and coalesce(faixa.value->>'sexo','') = v_sexo;
    for v_item in select value from jsonb_array_elements(p_faixas)
      where coalesce(value->>'especie','') = v_especie and coalesce(value->>'sexo','') = v_sexo
    loop
      v_indice := v_indice + 1;
      if v_indice = v_qtd then
        if v_item->'ateKg' <> 'null'::jsonb then return false; end if;
      else
        v_limite := (v_item->>'ateKg')::numeric;
        if v_limite <= v_anterior then return false; end if;
        v_anterior := v_limite;
      end if;
    end loop;
  end loop;
  return true;
exception when others then return false;
end;
$$;

comment on column public.oricse_catalogo_itens.faixas_peso is
  'Preços condicionais por espécie, sexo e faixa de peso; a última faixa de cada combinação não possui limite superior.';
commit;
