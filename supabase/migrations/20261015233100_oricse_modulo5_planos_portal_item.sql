update public.oricse_planos
set itens = case
  when codigo='plus-clinica' and not (itens ? 'Portal do tutor') then itens || to_jsonb('Portal do tutor'::text)
  when codigo='master-equipe' and not (itens ? 'Portal do tutor') then itens || to_jsonb('Portal do tutor'::text)
  else itens
end,
updated_at=now()
where codigo in ('plus-clinica','master-equipe');
