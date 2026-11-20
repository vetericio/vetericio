create function public.oricse_validar_cpf_contratacao()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  cpf text := btrim(coalesce(new.dados->>'responsavel_cpf', new.responsavel_cpf, ''));
  digitos text;
  primeiro integer;
  segundo integer;
begin
  if cpf !~ '^([0-9]{11}|[0-9]{3}[.][0-9]{3}[.][0-9]{3}-[0-9]{2})$' then
    raise exception 'CPF inválido. Confira os 11 dígitos informados.' using errcode = '23514';
  end if;

  digitos := translate(cpf, '.-', '');
  select mod(mod(sum(substr(digitos, i, 1)::integer * (11 - i)) filter (where i < 10) * 10, 11), 10),
         mod(mod(sum(substr(digitos, i, 1)::integer * (12 - i)) * 10, 11), 10)
    into primeiro, segundo
    from generate_series(1, 10) as digito(i);

  if digitos = repeat(left(digitos, 1), 11)
    or primeiro <> substr(digitos, 10, 1)::integer
    or segundo <> substr(digitos, 11, 1)::integer then
    raise exception 'CPF inválido. Confira os 11 dígitos informados.' using errcode = '23514';
  end if;

  new.responsavel_cpf := digitos;
  return new;
end;
$$;

revoke execute on function public.oricse_validar_cpf_contratacao() from public, anon, authenticated;

create trigger oricse_contratacao_valida_cpf
before insert on public.oricse_contratacoes
for each row when (new.ciclo <> 'teste')
execute function public.oricse_validar_cpf_contratacao();
