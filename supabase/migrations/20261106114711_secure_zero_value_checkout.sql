-- O pedido com isenção integral é validado e classificado na mesma transação
-- da criação. Assim o navegador nunca recebe permissão para alterar o status
-- conhecendo apenas um UUID.
create or replace function public.oricse_classificar_isencao_integral()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'aguardando_pagamento'
    and new.valor_total = 0
    and new.promo_codigo is not null
    and new.promo_valor_original > 0
    and new.promo_desconto >= new.promo_valor_original
    and new.promo_valor_final = 0 then
    new.status := 'isento_aguardando_aprovacao';
    new.updated_at := now();
  end if;
  return new;
end;
$$;

revoke all on function public.oricse_classificar_isencao_integral() from public, anon, authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.oricse_contratacoes'::regclass
      and tgname = 'oricse_contratacao_classifica_isencao_integral'
      and not tgisinternal
  ) then
    create trigger oricse_contratacao_classifica_isencao_integral
      before insert or update of status, valor_total, promo_codigo,
        promo_valor_original, promo_desconto, promo_valor_final
      on public.oricse_contratacoes
      for each row execute function public.oricse_classificar_isencao_integral();
  end if;
end;
$$;

-- A função antiga não é mais chamada pela interface. Ela permanece no banco
-- apenas para compatibilidade administrativa, sem acesso direto de clientes.
revoke all on function public.oricse_finalizar_contratacao_isenta(uuid)
  from public, anon, authenticated;
