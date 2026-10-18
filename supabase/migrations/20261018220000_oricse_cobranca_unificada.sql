alter table public.oricse_precos_portal add column if not exists cobrar_portal boolean not null default false;
alter table public.oricse_precos_portal add column if not exists valor_comanda_centavos integer;
update public.oricse_precos_portal set valor_comanda_centavos=valor_centavos where valor_comanda_centavos is null;
alter table public.oricse_precos_portal add constraint oricse_valor_comanda_positivo check(valor_comanda_centavos>0);
create or replace function public.oricse_salvar_cobranca_integrada(p_id uuid,p_titulo text,p_valor_comanda integer,p_cobrar_portal boolean,p_modo text,p_valor_online integer)
returns uuid language plpgsql security definer set search_path=public as $$
declare cid uuid; papel text; admin_geral boolean; rid uuid;
begin
 select exists(select 1 from public.app_users where user_id=auth.uid() and role='admin') into admin_geral;
 select cu.clinica_id,cu.papel into cid,papel from public.clinica_usuarios cu where cu.user_id=auth.uid() and cu.ativo=true order by cu.created_at limit 1;
 if cid is null then raise exception 'Selecione uma clínica válida';end if;
 if not admin_geral and coalesce(papel,'') not in ('rt','responsavel','admin_clinica','recepcao') then raise exception 'Sem permissão para definir preços';end if;
 if length(trim(coalesce(p_titulo,''))) not between 2 and 120 or p_valor_comanda is null or p_valor_comanda<=0 or p_valor_comanda>100000000 then raise exception 'Preço da comanda inválido';end if;
 if p_modo not in ('cobrar','receber') or p_valor_online is null or p_valor_online<=0 then raise exception 'Preço do portal inválido';end if;
 if p_id is null then
   insert into public.oricse_precos_portal(clinica_id,titulo,area,modo,valor_centavos,valor_comanda_centavos,cobrar_portal)
   values(cid,trim(p_titulo),'consulta',p_modo,p_valor_online,p_valor_comanda,coalesce(p_cobrar_portal,false)) returning id into rid;
 else
   update public.oricse_precos_portal set titulo=trim(p_titulo),modo=p_modo,valor_centavos=p_valor_online,valor_comanda_centavos=p_valor_comanda,cobrar_portal=coalesce(p_cobrar_portal,false),updated_at=now()
   where id=p_id and clinica_id=cid returning id into rid;
   if rid is null then raise exception 'Cobrança não encontrada';end if;
 end if;
 return rid;
end $$;
create or replace function public.oricse_listar_cobrancas_integradas()
returns table(id uuid,titulo text,valor_comanda_centavos integer,cobrar_portal boolean,modo text,valor_centavos integer,ativo boolean)
language plpgsql security definer set search_path=public as $$
declare cid uuid; admin_geral boolean;
begin
 select exists(select 1 from public.app_users where user_id=auth.uid() and role='admin') into admin_geral;
 select cu.clinica_id into cid from public.clinica_usuarios cu where cu.user_id=auth.uid() and cu.ativo=true order by cu.created_at limit 1;
 if cid is null then raise exception 'Clínica não identificada';end if;
 if not admin_geral and not exists(select 1 from public.clinica_usuarios cu where cu.clinica_id=cid and cu.user_id=auth.uid() and cu.ativo=true) then raise exception 'Sem acesso';end if;
 return query select p.id,p.titulo,p.valor_comanda_centavos,p.cobrar_portal,p.modo,p.valor_centavos,p.ativo from public.oricse_precos_portal p where p.clinica_id=cid order by p.titulo;
end $$;
revoke all on function public.oricse_salvar_cobranca_integrada(uuid,text,integer,boolean,text,integer),public.oricse_listar_cobrancas_integradas() from public;
grant execute on function public.oricse_salvar_cobranca_integrada(uuid,text,integer,boolean,text,integer),public.oricse_listar_cobrancas_integradas() to authenticated;