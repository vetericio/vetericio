alter sequence public.tutor_codigo_global_seq maxvalue 999999 no cycle;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tutores_codigo_numero_formato_check'
      and conrelid = 'public.tutores'::regclass
  ) then
    alter table public.tutores
      add constraint tutores_codigo_numero_formato_check
      check (codigo_numero between 1 and 999999) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'tutores_codigo_publico_formato_check'
      and conrelid = 'public.tutores'::regclass
  ) then
    alter table public.tutores
      add constraint tutores_codigo_publico_formato_check
      check (codigo_publico ~ '^#[A-Z][0-9]{6}$') not valid;
  end if;
end;
$$;

create or replace function public.oricse_preparar_tutor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  clinica_nome text;
  inicial text;
begin
  new.nome := regexp_replace(trim(new.nome), '\s+', ' ', 'g');
  new.nome_chave := public.oricse_normalizar_nome(new.nome);
  new.cpf_digitos := regexp_replace(coalesce(new.cpf, ''), '\D', '', 'g');

  if length(new.cpf_digitos) <> 11 then
    raise exception 'CPF obrigatório e deve conter 11 dígitos.' using errcode = '23514';
  end if;

  new.cpf := new.cpf_digitos;
  new.updated_at := now();

  if tg_op = 'INSERT' then
    if new.codigo_numero is null then
      new.codigo_numero := nextval('public.tutor_codigo_global_seq');
    end if;

    if new.codigo_publico is null or btrim(new.codigo_publico) = '' then
      select c.nome into clinica_nome from public.clinicas c where c.id = new.clinica_id;
      inicial := upper(substring(unaccent(coalesce(clinica_nome, 'Oricse')) from '[A-Za-z]'));
      if coalesce(inicial, '') = '' then inicial := 'O'; end if;
      new.codigo_publico := '#' || inicial || lpad(new.codigo_numero::text, 6, '0');
    end if;
  end if;

  if new.codigo_numero not between 1 and 999999 then
    raise exception 'O número do ID público do tutor deve conter até seis dígitos.' using errcode = '23514';
  end if;

  if new.codigo_publico !~ '^#[A-Z][0-9]{6}$' then
    raise exception 'O ID público do tutor deve seguir o formato #<letra><6 números>.' using errcode = '23514';
  end if;

  return new;
end;
$$;
