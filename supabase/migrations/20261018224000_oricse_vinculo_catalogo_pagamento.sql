alter table public.oricse_precos_portal add column if not exists catalogo_item_id uuid;
create unique index if not exists oricse_precos_catalogo_unico on public.oricse_precos_portal(clinica_id,catalogo_item_id) where catalogo_item_id is not null;
create or replace function public.oricse_configurar_pagamento_catalogo(
 p_catalogo_item_id uuid,p_titulo text,p_valor_referencia integer,
 p_cobrar_portal boolean,p_modo text,p_valor_online integer
) returns uuid language plpgsql security definer set search_path=public as $$
declare cid uuid; papel text; geral boolean; rid uuid;
begin
 select exists(select 1 from public.app_users where user_id=auth.uid() and role='admin') into geral;
 select cu.clinica_id,cu.papel into cid,papel from public.clinica_usuarios cu where cu.user_id=auth.uid() and cu.ativo=true order by cu.created_at limit 1;
 if cid is null then raise exception 'Clínica não identificada';end if;
 if not geral and coalesce(papel,'') not in ('rt','responsavel','admin_clinica','recepcao') then raise exception 'Sem permissão';end if;
 if p_catalogo_item_id is null or length(trim(coalesce(p_titulo,''))) not between 2 and 120
 or p_valor_referencia is null or p_valor_referencia<0 or p_valor_referencia>100000000
 or p_modo not in ('cobrar','receber') or p_valor_online is null or p_valor_online<=0 then raise exception 'Configuração inválida';end if;
 insert into public.oricse_precos_portal(clinica_id,catalogo_item_id,titulo,area,modo,valor_centavos,valor_comanda_centavos,cobrar_portal)
 values(cid,p_catalogo_item_id,trim(p_titulo),'consulta',p_modo,p_valor_online,greatest(p_valor_referencia,1),coalesce(p_cobrar_portal,false))
 on conflict (clinica_id,catalogo_item_id) where catalogo_item_id is not null
 do update set titulo=excluded.titulo,modo=excluded.modo,valor_centavos=excluded.valor_centavos,
 valor_comanda_centavos=excluded.valor_comanda_centavos,cobrar_portal=excluded.cobrar_portal,updated_at=now()
 returning id into rid;
 return rid;
end $$;
create or replace function public.oricse_listar_pagamentos_catalogo()
returns table(catalogo_item_id uuid,cobrar_portal boolean,modo text,valor_centavos integer)
language plpgsql security definer set search_path=public as $$
declare cid uuid;
begin
 select cu.clinica_id into cid from public.clinica_usuarios cu where cu.user_id=auth.uid() and cu.ativo=true order by cu.created_at limit 1;
 if cid is null then raise exception 'Clínica não identificada';end if;
 return query select p.catalogo_item_id,p.cobrar_portal,p.modo,p.valor_centavos
 from public.oricse_precos_portal p where p.clinica_id=cid and p.catalogo_item_id is not null;
end $$;
revoke all on function public.oricse_configurar_pagamento_catalogo(uuid,text,integer,boolean,text,integer) from public;
revoke all on function public.oricse_listar_pagamentos_catalogo() from public;
grant execute on function public.oricse_configurar_pagamento_catalogo(uuid,text,integer,boolean,text,integer) to authenticated;
grant execute on function public.oricse_listar_pagamentos_catalogo() to authenticated;