-- Comissão ORICSE por forma de pagamento e segmento.
-- A taxa do Mercado Pago continua sendo a referência do provedor; a comissão é configurada separadamente.

create table if not exists public.oricse_taxas_oricse_modalidade (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid references public.clinicas(id) on delete cascade,
  segmento text not null check (segmento in ('clinica','banho_tosa','hotelzinho','pet_shop','portal_tutor')),
  modalidade text not null check (modalidade in ('pix','cartao_debito','cartao_credito','saldo_mercado_pago','boleto')),
  prazo_recebimento_dias smallint not null check (prazo_recebimento_dias in (0,3,7,14,30)),
  parcelas smallint not null check (parcelas between 1 and 18),
  oricse_percentual numeric(7,4) not null check (oricse_percentual >= 0 and oricse_percentual < 100),
  ativo boolean not null default true,
  updated_at timestamptz not null default now()
);

create unique index if not exists oricse_taxas_oricse_modalidade_global_uniq
  on public.oricse_taxas_oricse_modalidade(segmento,modalidade,prazo_recebimento_dias,parcelas)
  where clinica_id is null;
create unique index if not exists oricse_taxas_oricse_modalidade_clinica_uniq
  on public.oricse_taxas_oricse_modalidade(clinica_id,segmento,modalidade,prazo_recebimento_dias,parcelas)
  where clinica_id is not null;

alter table public.oricse_taxas_oricse_modalidade enable row level security;
revoke all on table public.oricse_taxas_oricse_modalidade from public, anon, authenticated;

-- Mantém a comissão antiga como valor inicial de cada condição, inclusive exceções já existentes.
insert into public.oricse_taxas_oricse_modalidade (
  clinica_id, segmento, modalidade, prazo_recebimento_dias, parcelas, oricse_percentual, ativo
)
select
  s.clinica_id, s.segmento, m.modalidade, m.prazo_recebimento_dias, m.parcelas,
  s.oricse_percentual, s.ativo
from public.oricse_taxas_oricse_segmento s
cross join public.oricse_taxas_modalidade m
where m.clinica_id is null
on conflict (segmento,modalidade,prazo_recebimento_dias,parcelas) where clinica_id is null
do update set
  oricse_percentual = excluded.oricse_percentual,
  ativo = excluded.ativo,
  updated_at = now();

CREATE OR REPLACE FUNCTION public.oricse_listar_grade_taxas_pagamento()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is null or not exists(select 1 from public.app_users where user_id=auth.uid() and role='admin') then raise exception 'Não autorizado'; end if;
  return jsonb_build_object(
    'modalidades',coalesce((select jsonb_agg(jsonb_build_object(
      'id',id,'clinica_id',clinica_id,'modalidade',modalidade,'prazo_recebimento_dias',prazo_recebimento_dias,'parcelas',parcelas,
      'descricao',descricao,'mp_percentual',mp_percentual,'mp_fixo_centavos',mp_fixo_centavos,'ativo',ativo,'fonte',fonte,
      'fonte_url',fonte_url,'referencia_verificada_em',referencia_verificada_em,'updated_at',updated_at
    ) order by clinica_id nulls first,modalidade,prazo_recebimento_dias,parcelas) from public.oricse_taxas_modalidade),'[]'::jsonb),
    'segmentos',coalesce((select jsonb_agg(jsonb_build_object(
      'id',id,'clinica_id',clinica_id,'segmento',segmento,'oricse_percentual',oricse_percentual,'ativo',ativo,'updated_at',updated_at
    ) order by clinica_id nulls first,segmento) from public.oricse_taxas_oricse_segmento),'[]'::jsonb),
    'comissoes',coalesce((select jsonb_agg(jsonb_build_object(
      'id',id,'clinica_id',clinica_id,'segmento',segmento,'modalidade',modalidade,
      'prazo_recebimento_dias',prazo_recebimento_dias,'parcelas',parcelas,
      'oricse_percentual',oricse_percentual,'ativo',ativo,'updated_at',updated_at
    ) order by clinica_id nulls first,segmento,modalidade,prazo_recebimento_dias,parcelas) from public.oricse_taxas_oricse_modalidade),'[]'::jsonb)
  );
end $function$;

CREATE OR REPLACE FUNCTION public.oricse_salvar_comissoes_oricse(p_clinica_id uuid, p_comissoes jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r record;
begin
  if auth.uid() is null or not exists(select 1 from public.app_users where user_id=auth.uid() and role='admin') then raise exception 'Apenas o administrador pode configurar comissões'; end if;
  if jsonb_typeof(p_comissoes)<>'array' then raise exception 'Comissões inválidas'; end if;
  for r in select * from jsonb_to_recordset(p_comissoes) as x(
    segmento text,modalidade text,prazo_recebimento_dias smallint,parcelas smallint,oricse_percentual numeric,ativo boolean
  )
  loop
    if r.segmento not in ('clinica','banho_tosa','hotelzinho','pet_shop','portal_tutor')
      or r.modalidade not in ('pix','cartao_debito','cartao_credito','saldo_mercado_pago','boleto')
      or r.prazo_recebimento_dias not in (0,3,7,14,30)
      or r.parcelas not between 1 and 18
      or r.oricse_percentual<0 or r.oricse_percentual>=100 then raise exception 'Linha de comissão inválida'; end if;
    if p_clinica_id is null then
      insert into public.oricse_taxas_oricse_modalidade(clinica_id,segmento,modalidade,prazo_recebimento_dias,parcelas,oricse_percentual,ativo,updated_at)
      values(null,r.segmento,r.modalidade,r.prazo_recebimento_dias,r.parcelas,r.oricse_percentual,coalesce(r.ativo,true),now())
      on conflict (segmento,modalidade,prazo_recebimento_dias,parcelas) where clinica_id is null
      do update set oricse_percentual=excluded.oricse_percentual,ativo=excluded.ativo,updated_at=now();
    else
      insert into public.oricse_taxas_oricse_modalidade(clinica_id,segmento,modalidade,prazo_recebimento_dias,parcelas,oricse_percentual,ativo,updated_at)
      values(p_clinica_id,r.segmento,r.modalidade,r.prazo_recebimento_dias,r.parcelas,r.oricse_percentual,coalesce(r.ativo,true),now())
      on conflict (clinica_id,segmento,modalidade,prazo_recebimento_dias,parcelas) where clinica_id is not null
      do update set oricse_percentual=excluded.oricse_percentual,ativo=excluded.ativo,updated_at=now();
    end if;
  end loop;
end $function$;

CREATE OR REPLACE FUNCTION public.oricse_previsualizar_cobranca(p_modo text, p_valor_centavos integer, p_modalidade text DEFAULT 'pix'::text)
 RETURNS TABLE(cobrado_tutor_centavos integer, liquido_clinica_centavos integer, desconto_mp_centavos integer, comissao_oricse_centavos integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare cid uuid; tx record; taxa integer; com integer; bruto integer; liquido integer; ori numeric;
  lo integer; hi integer; mid integer; modalidade_normalizada text;
begin
  select cu.clinica_id into cid from public.clinica_usuarios cu where cu.user_id=auth.uid() and cu.ativo=true limit 1;
  if cid is null then raise exception 'Clínica não identificada'; end if;
  modalidade_normalizada := case when p_modalidade='cartao' then 'cartao_credito' else p_modalidade end;
  if p_modo not in ('receber','cobrar') or modalidade_normalizada not in ('pix','cartao_debito','cartao_credito','saldo_mercado_pago','boleto') or p_valor_centavos is null or p_valor_centavos<=0 or p_valor_centavos>100000000 then raise exception 'Parâmetros inválidos'; end if;
  select t.mp_percentual,t.mp_fixo_centavos into tx from public.oricse_taxas_modalidade t
   where t.modalidade=modalidade_normalizada and t.prazo_recebimento_dias=0 and t.parcelas=1 and t.ativo=true and (t.clinica_id=cid or t.clinica_id is null)
   order by (t.clinica_id is not null) desc limit 1;
  if not found then raise exception 'Taxas ainda não configuradas para este meio de pagamento'; end if;
  select c.oricse_percentual into ori from public.oricse_taxas_oricse_modalidade c
   where c.segmento='portal_tutor' and c.modalidade=modalidade_normalizada and c.prazo_recebimento_dias=0 and c.parcelas=1 and c.ativo=true and (c.clinica_id=cid or c.clinica_id is null)
   order by (c.clinica_id is not null) desc limit 1;
  ori:=coalesce(ori,0);
  if p_modo='receber' then
    lo:=p_valor_centavos; hi:=2000000000;
    while lo<hi loop
      mid:=lo+(hi-lo)/2; taxa:=least(mid,round(mid*tx.mp_percentual/100)::integer+tx.mp_fixo_centavos); com:=round((mid-taxa)*ori/100)::integer;
      if mid-taxa-com>=p_valor_centavos then hi:=mid;else lo:=mid+1;end if;
    end loop; bruto:=lo;
  else bruto:=p_valor_centavos; end if;
  taxa:=least(bruto,round(bruto*tx.mp_percentual/100)::integer+tx.mp_fixo_centavos); com:=round((bruto-taxa)*ori/100)::integer; liquido:=bruto-taxa-com;
  return query select bruto,liquido,taxa,com;
end $function$;

revoke all on function public.oricse_listar_grade_taxas_pagamento() from public, anon;
revoke all on function public.oricse_salvar_comissoes_oricse(uuid,jsonb) from public, anon;
revoke all on function public.oricse_previsualizar_cobranca(text,integer,text) from public, anon;
grant execute on function public.oricse_listar_grade_taxas_pagamento() to authenticated;
grant execute on function public.oricse_salvar_comissoes_oricse(uuid,jsonb) to authenticated;
grant execute on function public.oricse_previsualizar_cobranca(text,integer,text) to authenticated;
