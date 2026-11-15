create or replace function public.oricse_preparar_tutor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  clinica_nome text;
  inicial text;
  digitos integer[];
  primeiro integer;
  segundo integer;
begin
  new.nome := regexp_replace(trim(new.nome), '\s+', ' ', 'g');
  new.nome_chave := public.oricse_normalizar_nome(new.nome);
  new.cpf_digitos := regexp_replace(coalesce(new.cpf, ''), '\D', '', 'g');

  if length(new.cpf_digitos) <> 11 then
    raise exception 'CPF obrigatório e deve conter 11 dígitos.' using errcode = '23514';
  end if;

  -- Cadastros novos e alterações de CPF devem passar pelos dígitos verificadores.
  -- Permite corrigir outros campos de um cadastro legado sem mudar seu CPF.
  if tg_op = 'INSERT' or
      new.cpf_digitos is distinct from old.cpf_digitos then
    digitos := array(
      select substr(new.cpf_digitos, posicao, 1)::integer
      from generate_series(1, 11) as serie(posicao)
      order by posicao
    );
    select mod(mod(sum(digitos[posicao] * (11 - posicao))::integer * 10, 11), 10)
      into primeiro from generate_series(1, 9) as serie(posicao);
    select mod(mod(sum(digitos[posicao] * (12 - posicao))::integer * 10, 11), 10)
      into segundo from generate_series(1, 10) as serie(posicao);

    if new.cpf_digitos = repeat(left(new.cpf_digitos, 1), 11)
        or primeiro <> digitos[10] or segundo <> digitos[11] then
      raise exception 'CPF inválido. Confira os 11 dígitos informados.' using errcode = '23514';
    end if;
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
