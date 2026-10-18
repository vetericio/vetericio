-- Preços por área e simulação protegida de tarifas efetivas.
alter table public.oricse_precos_portal add column if not exists area text not null default 'portal'
  check (area in ('consulta','portal','outros'));

create or replace function public.oricse_previsualizar_cobranca(
 p_modo text,p_valor_centavos integer,p_modalidade text default 'pix'
) returns table(cobrado_tutor_centavos integer,liquido_clinica_centavos integer,
 desconto_mp_centavos integer,comissao_oricse_centavos integer)
language plpgsql security definer set search_path=public as $$
declare cid uuid; tx record; taxa integer; com integer; bruto integer; liquido integer;
 lo integer; hi integer; mid integer;
begin
 select cu.clinica_id into cid from public.clinica_usuarios cu
 where cu.user_id=auth.uid() and cu.ativo=true limit 1;
 if cid is null then raise exception 'Clínica não identificada'; end if;
 if p_modo not in ('receber','cobrar') or p_modalidade not in ('pix','cartao','boleto')
 or p_valor_centavos is null or p_valor_centavos<=0 or p_valor_centavos>100000000
 then raise exception 'Parâmetros inválidos'; end if;
 select t.mp_percentual,t.mp_fixo_centavos,t.oricse_percentual into tx
 from public.oricse_taxas_modalidade t
 where t.modalidade=p_modalidade and t.ativo=true and (t.clinica_id=cid or t.clinica_id is null)
 order by (t.clinica_id is not null) desc limit 1;
 if not found then raise exception 'Taxas ainda não configuradas para este meio de pagamento'; end if;
 if p_modo='receber' then
  lo:=p_valor_centavos;hi:=2000000000;
  while lo<hi loop
   mid:=lo+(hi-lo)/2;
   taxa:=least(mid,round(mid*tx.mp_percentual/100)::integer+tx.mp_fixo_centavos);
   com:=round((mid-taxa)*tx.oricse_percentual/100)::integer;
   if mid-taxa-com>=p_valor_centavos then hi:=mid;else lo:=mid+1;end if;
  end loop;
  bruto:=lo;
 else bruto:=p_valor_centavos; end if;
 taxa:=least(bruto,round(bruto*tx.mp_percentual/100)::integer+tx.mp_fixo_centavos);
 com:=round((bruto-taxa)*tx.oricse_percentual/100)::integer;
 liquido:=bruto-taxa-com;
 return query select bruto,liquido,taxa,com;
end $$;
create or replace function public.oricse_salvar_preco_portal(p_id uuid,p_titulo text,p_modo text,p_valor_centavos integer,p_area text default 'portal')
returns uuid language plpgsql security definer set search_path=public as $$
declare cid uuid; rid uuid;
begin
 select cu.clinica_id into cid from public.clinica_usuarios cu where cu.user_id=auth.uid() and cu.ativo=true limit 1;
 if cid is null then raise exception 'Clínica não vinculada'; end if;
 if p_area not in ('consulta','portal','outros') or p_titulo is null or length(trim(p_titulo))<2
 or p_modo not in ('receber','cobrar') or p_valor_centavos is null or p_valor_centavos<=0 then
 raise exception 'Preço inválido';end if;
 if p_id is null then
  insert into public.oricse_precos_portal(clinica_id,titulo,modo,valor_centavos,area)
  values(cid,trim(p_titulo),p_modo,p_valor_centavos,p_area) returning id into rid;
 else
  update public.oricse_precos_portal set titulo=trim(p_titulo),modo=p_modo,valor_centavos=p_valor_centavos,area=p_area,updated_at=now()
  where id=p_id and clinica_id=cid returning id into rid;
  if rid is null then raise exception 'Preço não encontrado nesta clínica';end if;
 end if;
 return rid;
end $$;
drop function if exists public.oricse_listar_precos_portal();
create function public.oricse_listar_precos_portal()
returns table(id uuid,titulo text,modo text,valor_centavos integer,ativo boolean,area text)
language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Sessão necessária';end if;
 return query select p.id,p.titulo,p.modo,p.valor_centavos,p.ativo,p.area
 from public.oricse_precos_portal p
 where exists(select 1 from public.clinica_usuarios cu
  where cu.user_id=auth.uid() and cu.ativo=true and cu.clinica_id=p.clinica_id)
 order by p.area,p.titulo;
end $$;
revoke all on function public.oricse_previsualizar_cobranca(text,integer,text) from public;
revoke all on function public.oricse_salvar_preco_portal(uuid,text,text,integer,text) from public;
revoke all on function public.oricse_listar_precos_portal() from public;
grant execute on function public.oricse_previsualizar_cobranca(text,integer,text) to authenticated;
grant execute on function public.oricse_salvar_preco_portal(uuid,text,text,integer,text) to authenticated;
grant execute on function public.oricse_listar_precos_portal() to authenticated;
