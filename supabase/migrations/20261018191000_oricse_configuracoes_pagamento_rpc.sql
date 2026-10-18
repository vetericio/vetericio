-- Configuração segura dos percentuais. Executar após 20261018190000_oricse_split_pagamentos_base.sql.
-- Escopo administrativo verificado dentro do banco, nunca por valores enviados pela interface.
create or replace function public.oricse_configurar_taxa_pagamento(
 p_clinica_id uuid, p_modalidade text, p_mp_percentual numeric,
 p_mp_fixo_centavos integer, p_oricse_percentual numeric
) returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null or not exists (select 1 from public.app_users u where u.user_id=auth.uid() and u.role='admin')
 then raise exception 'Apenas o administrador pode configurar tarifas'; end if;
 if p_modalidade is null or p_modalidade not in ('pix','cartao','boleto') or p_mp_percentual is null or p_oricse_percentual is null
 or p_mp_percentual<0 or p_mp_percentual>=100 or p_oricse_percentual<0 or p_oricse_percentual>=100
 or p_mp_fixo_centavos is null or p_mp_fixo_centavos<0 then raise exception 'Tarifas inválidas'; end if;
 if p_clinica_id is null then
  insert into public.oricse_taxas_modalidade(clinica_id,modalidade,mp_percentual,mp_fixo_centavos,oricse_percentual)
  values(null,p_modalidade,p_mp_percentual,p_mp_fixo_centavos,p_oricse_percentual)
  on conflict (modalidade) where clinica_id is null
  do update set mp_percentual=excluded.mp_percentual,mp_fixo_centavos=excluded.mp_fixo_centavos,oricse_percentual=excluded.oricse_percentual,updated_at=now();
 else
  insert into public.oricse_taxas_modalidade(clinica_id,modalidade,mp_percentual,mp_fixo_centavos,oricse_percentual)
  values(p_clinica_id,p_modalidade,p_mp_percentual,p_mp_fixo_centavos,p_oricse_percentual)
  on conflict (clinica_id,modalidade) where clinica_id is not null
  do update set mp_percentual=excluded.mp_percentual,mp_fixo_centavos=excluded.mp_fixo_centavos,oricse_percentual=excluded.oricse_percentual,updated_at=now();
 end if;
end $$;
create or replace function public.oricse_listar_taxas_pagamento()
returns table (clinica_id uuid,modalidade text,mp_percentual numeric,mp_fixo_centavos integer,oricse_percentual numeric)
language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null or not exists(select 1 from public.app_users where user_id=auth.uid() and role='admin')
 then raise exception 'Não autorizado'; end if;
 return query select t.clinica_id,t.modalidade,t.mp_percentual,t.mp_fixo_centavos,t.oricse_percentual from public.oricse_taxas_modalidade t;
end $$;
create or replace function public.oricse_salvar_preco_portal(p_id uuid,p_titulo text,p_modo text,p_valor_centavos integer)
returns uuid language plpgsql security definer set search_path=public as $$
declare cid uuid; rid uuid;
begin
 select cu.clinica_id into cid from public.clinica_usuarios cu
 where cu.user_id=auth.uid() and cu.ativo=true order by cu.clinica_id limit 1;
 if cid is null then raise exception 'Clínica não vinculada'; end if;
 if p_titulo is null or length(trim(p_titulo))<2 or p_modo not in ('receber','cobrar')
 or p_valor_centavos is null or p_valor_centavos<=0 then raise exception 'Preço inválido'; end if;
 if p_id is null then
  insert into public.oricse_precos_portal(clinica_id,titulo,modo,valor_centavos)
  values(cid,trim(p_titulo),p_modo,p_valor_centavos) returning id into rid;
 else
  update public.oricse_precos_portal set titulo=trim(p_titulo),modo=p_modo,valor_centavos=p_valor_centavos,updated_at=now()
  where id=p_id and clinica_id=cid returning id into rid;
  if rid is null then raise exception 'Preço não encontrado nesta clínica'; end if;
 end if;
 return rid;
end $$;
create or replace function public.oricse_listar_precos_portal()
returns table(id uuid,titulo text,modo text,valor_centavos integer,ativo boolean)
language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Sessão necessária'; end if;
 return query select p.id,p.titulo,p.modo,p.valor_centavos,p.ativo
 from public.oricse_precos_portal p where exists(select 1 from public.clinica_usuarios cu
 where cu.user_id=auth.uid() and cu.clinica_id=p.clinica_id and cu.ativo=true)
 order by p.titulo;
end $$;
revoke all on function public.oricse_configurar_taxa_pagamento(uuid,text,numeric,integer,numeric) from public;
revoke all on function public.oricse_listar_taxas_pagamento() from public;
revoke all on function public.oricse_salvar_preco_portal(uuid,text,text,integer) from public;
revoke all on function public.oricse_listar_precos_portal() from public;
grant execute on function public.oricse_configurar_taxa_pagamento(uuid,text,numeric,integer,numeric) to authenticated;
grant execute on function public.oricse_listar_taxas_pagamento() to authenticated;
grant execute on function public.oricse_salvar_preco_portal(uuid,text,text,integer) to authenticated;
grant execute on function public.oricse_listar_precos_portal() to authenticated;
