-- Grade profissional de pagamentos, repasses e comissões por segmento.
-- Referência pública: Mercado Pago Link/Checkout online. A tarifa real pode variar por conta e deve ser conciliada pelo webhook.

alter table public.oricse_taxas_modalidade
  add column if not exists prazo_recebimento_dias smallint not null default 0,
  add column if not exists parcelas smallint not null default 1,
  add column if not exists descricao text not null default '',
  add column if not exists fonte text not null default 'manual',
  add column if not exists fonte_url text,
  add column if not exists referencia_verificada_em date;
alter table public.oricse_taxas_modalidade drop constraint if exists oricse_taxas_modalidade_modalidade_check;
update public.oricse_taxas_modalidade set modalidade='cartao_credito' where modalidade='cartao';
alter table public.oricse_taxas_modalidade
  add constraint oricse_taxas_modalidade_modalidade_check check (modalidade in ('pix','cartao_debito','cartao_credito','saldo_mercado_pago','boleto')),
  add constraint oricse_taxas_modalidade_prazo_check check (prazo_recebimento_dias in (0,3,7,14,30)),
  add constraint oricse_taxas_modalidade_parcelas_check check (parcelas between 1 and 18);

drop index if exists public.oricse_taxas_modalidade_global_uniq;
drop index if exists public.oricse_taxas_modalidade_clinica_uniq;
create unique index if not exists oricse_taxas_modalidade_global_grade_uniq on public.oricse_taxas_modalidade(modalidade,prazo_recebimento_dias,parcelas) where clinica_id is null;
create unique index if not exists oricse_taxas_modalidade_clinica_grade_uniq on public.oricse_taxas_modalidade(clinica_id,modalidade,prazo_recebimento_dias,parcelas) where clinica_id is not null;

create table if not exists public.oricse_taxas_oricse_segmento (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid references public.clinicas(id) on delete cascade,
  segmento text not null check (segmento in ('clinica','banho_tosa','hotelzinho','pet_shop','portal_tutor')),
  oricse_percentual numeric(7,4) not null check (oricse_percentual >= 0 and oricse_percentual < 100),
  ativo boolean not null default true,
  updated_at timestamptz not null default now()
);
create unique index if not exists oricse_taxas_oricse_segmento_global_uniq on public.oricse_taxas_oricse_segmento(segmento) where clinica_id is null;
create unique index if not exists oricse_taxas_oricse_segmento_clinica_uniq on public.oricse_taxas_oricse_segmento(clinica_id,segmento) where clinica_id is not null;
alter table public.oricse_taxas_oricse_segmento enable row level security;
revoke all on public.oricse_taxas_oricse_segmento from anon,authenticated;

with bases(prazo,base_percentual,descricao) as (
  values (0::smallint,4.98::numeric,'na hora'),(14::smallint,4.48::numeric,'recebe em 14 dias'),(30::smallint,3.99::numeric,'recebe em 30 dias')
), parcelas(parcelas,adicional) as (
  values (1::smallint,0::numeric),(2::smallint,2.53::numeric),(3::smallint,4.62::numeric),(4::smallint,6.69::numeric),
    (5::smallint,8.66::numeric),(6::smallint,9.96::numeric),(7::smallint,11.24::numeric),(8::smallint,12.50::numeric),
    (9::smallint,13.73::numeric),(10::smallint,14.93::numeric),(11::smallint,16.12::numeric),(12::smallint,17.28::numeric)
), referencia as (
  select 'pix'::text modalidade,0::smallint prazo,1::smallint parcelas,'PIX — na hora'::text descricao,0.99::numeric percentual
  union all select 'cartao_debito',0,1,'Débito virtual CAIXA — na hora',3.99
  union all select 'saldo_mercado_pago',0,1,'Saldo Mercado Pago / Linha de Crédito — na hora',4.99
  union all select 'boleto',3,1,'Boleto — em até 3 dias',3.99
  union all select 'cartao_credito',b.prazo,p.parcelas,'Crédito '||p.parcelas||'x sem acréscimo — '||b.descricao,b.base_percentual+p.adicional from bases b cross join parcelas p
)
insert into public.oricse_taxas_modalidade(clinica_id,modalidade,prazo_recebimento_dias,parcelas,descricao,mp_percentual,mp_fixo_centavos,oricse_percentual,fonte,fonte_url,referencia_verificada_em)
select null,modalidade,prazo,parcelas,descricao,percentual,0,0,'referencia_publica_mercado_pago','https://www.mercadopago.com.br/ferramentas-para-vender/link-de-pagamento',current_date from referencia
on conflict (modalidade,prazo_recebimento_dias,parcelas) where clinica_id is null do nothing;

insert into public.oricse_taxas_oricse_segmento(clinica_id,segmento,oricse_percentual)
values (null,'clinica',10),(null,'banho_tosa',10),(null,'hotelzinho',10),(null,'pet_shop',10),(null,'portal_tutor',10)
on conflict (segmento) where clinica_id is null do nothing;

create or replace function public.oricse_listar_grade_taxas_pagamento()
returns jsonb language plpgsql security definer set search_path=public as $$
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
    ) order by clinica_id nulls first,segmento) from public.oricse_taxas_oricse_segmento),'[]'::jsonb)
  );
end $$;

create or replace function public.oricse_salvar_grade_taxas_pagamento(p_clinica_id uuid,p_modalidades jsonb,p_segmentos jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare r record;
begin
  if auth.uid() is null or not exists(select 1 from public.app_users where user_id=auth.uid() and role='admin') then raise exception 'Apenas o administrador pode configurar tarifas'; end if;
  if jsonb_typeof(p_modalidades)<>'array' or jsonb_typeof(p_segmentos)<>'array' then raise exception 'Grade de tarifas inválida'; end if;
  for r in select * from jsonb_to_recordset(p_modalidades) as x(modalidade text,prazo_recebimento_dias smallint,parcelas smallint,descricao text,mp_percentual numeric,mp_fixo_centavos integer,ativo boolean,fonte text,fonte_url text,referencia_verificada_em date)
  loop
    if r.modalidade not in ('pix','cartao_debito','cartao_credito','saldo_mercado_pago','boleto') or r.prazo_recebimento_dias not in (0,3,7,14,30) or r.parcelas not between 1 and 18 or r.mp_percentual<0 or r.mp_percentual>=100 or r.mp_fixo_centavos<0 or coalesce(length(trim(r.descricao)),0)<3 then raise exception 'Linha de tarifa inválida'; end if;
    if p_clinica_id is null then
      insert into public.oricse_taxas_modalidade(clinica_id,modalidade,prazo_recebimento_dias,parcelas,descricao,mp_percentual,mp_fixo_centavos,oricse_percentual,ativo,fonte,fonte_url,referencia_verificada_em,updated_at)
      values(null,r.modalidade,r.prazo_recebimento_dias,r.parcelas,trim(r.descricao),r.mp_percentual,r.mp_fixo_centavos,0,coalesce(r.ativo,true),coalesce(nullif(trim(r.fonte),''),'manual'),nullif(trim(r.fonte_url),''),r.referencia_verificada_em,now())
      on conflict (modalidade,prazo_recebimento_dias,parcelas) where clinica_id is null do update set descricao=excluded.descricao,mp_percentual=excluded.mp_percentual,mp_fixo_centavos=excluded.mp_fixo_centavos,ativo=excluded.ativo,fonte=excluded.fonte,fonte_url=excluded.fonte_url,referencia_verificada_em=excluded.referencia_verificada_em,updated_at=now();
    else
      insert into public.oricse_taxas_modalidade(clinica_id,modalidade,prazo_recebimento_dias,parcelas,descricao,mp_percentual,mp_fixo_centavos,oricse_percentual,ativo,fonte,fonte_url,referencia_verificada_em,updated_at)
      values(p_clinica_id,r.modalidade,r.prazo_recebimento_dias,r.parcelas,trim(r.descricao),r.mp_percentual,r.mp_fixo_centavos,0,coalesce(r.ativo,true),coalesce(nullif(trim(r.fonte),''),'manual'),nullif(trim(r.fonte_url),''),r.referencia_verificada_em,now())
      on conflict (clinica_id,modalidade,prazo_recebimento_dias,parcelas) where clinica_id is not null do update set descricao=excluded.descricao,mp_percentual=excluded.mp_percentual,mp_fixo_centavos=excluded.mp_fixo_centavos,ativo=excluded.ativo,fonte=excluded.fonte,fonte_url=excluded.fonte_url,referencia_verificada_em=excluded.referencia_verificada_em,updated_at=now();
    end if;
  end loop;
  for r in select * from jsonb_to_recordset(p_segmentos) as x(segmento text,oricse_percentual numeric,ativo boolean)
  loop
    if r.segmento not in ('clinica','banho_tosa','hotelzinho','pet_shop','portal_tutor') or r.oricse_percentual<0 or r.oricse_percentual>=100 then raise exception 'Comissão ORICSE inválida'; end if;
    if p_clinica_id is null then
      insert into public.oricse_taxas_oricse_segmento(clinica_id,segmento,oricse_percentual,ativo,updated_at) values(null,r.segmento,r.oricse_percentual,coalesce(r.ativo,true),now())
      on conflict (segmento) where clinica_id is null do update set oricse_percentual=excluded.oricse_percentual,ativo=excluded.ativo,updated_at=now();
    else
      insert into public.oricse_taxas_oricse_segmento(clinica_id,segmento,oricse_percentual,ativo,updated_at) values(p_clinica_id,r.segmento,r.oricse_percentual,coalesce(r.ativo,true),now())
      on conflict (clinica_id,segmento) where clinica_id is not null do update set oricse_percentual=excluded.oricse_percentual,ativo=excluded.ativo,updated_at=now();
    end if;
  end loop;
end $$;

revoke all on function public.oricse_listar_grade_taxas_pagamento() from public;
revoke all on function public.oricse_salvar_grade_taxas_pagamento(uuid,jsonb,jsonb) from public;
grant execute on function public.oricse_listar_grade_taxas_pagamento() to authenticated;
grant execute on function public.oricse_salvar_grade_taxas_pagamento(uuid,jsonb,jsonb) to authenticated;
