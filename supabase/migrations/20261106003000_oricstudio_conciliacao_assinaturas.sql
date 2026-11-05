-- OricStúdio 4/5: conciliação de assinaturas, cancelamentos e estornos.
-- Preserva cobrança dos planos ORICSE e preços contratados.
alter table public.oricstudio_solicitacoes
  add column if not exists ultima_conciliacao_em timestamptz,
  add column if not exists cancelamento_em timestamptz,
  add column if not exists mp_ultimo_status text;

alter table public.oricstudio_pagamentos
  add column if not exists status_mp text not null default 'approved'
    check (status_mp in ('approved','refunded','charged_back')),
  add column if not exists estornado_em timestamptz;

create table if not exists public.oricstudio_eventos_cobranca (
  id bigint generated always as identity primary key,
  solicitacao_id uuid not null references public.oricstudio_solicitacoes(id) on delete cascade,
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  tipo text not null check (tipo in ('assinatura_verificada','assinatura_cancelada','pagamento_estornado','fatura_pendente','pagamento_verificado')),
  referencia text,
  detalhes jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now()
);
create index if not exists oricstudio_eventos_cobranca_clinica_idx
on public.oricstudio_eventos_cobranca(clinica_id,criado_em desc);
alter table public.oricstudio_eventos_cobranca enable row level security;
revoke all on public.oricstudio_eventos_cobranca from public,anon,authenticated;
grant select on public.oricstudio_eventos_cobranca to authenticated;
create policy oricstudio_eventos_cobranca_ler on public.oricstudio_eventos_cobranca
for select to authenticated using (
  public.oricstudio_eh_admin() or exists(
    select 1 from public.clinica_usuarios cu
    where cu.clinica_id=oricstudio_eventos_cobranca.clinica_id
      and cu.user_id=(select auth.uid()) and cu.ativo=true
      and cu.papel in ('responsavel','admin_clinica','rt')
  )
);

-- Chamadas exclusivas da Edge Function (service_role), sempre depois da consulta à API Mercado Pago.
create or replace function public.oricstudio_atualizar_estado_mp(
  p_solicitacao uuid,p_status_mp text
)
returns boolean language plpgsql security definer set search_path=''
as $orcstate$
declare p public.oricstudio_solicitacoes;
declare v_cancelada boolean;
begin
  if current_user <> 'service_role' and auth.role() <> 'service_role' then
    raise exception 'Conciliação restrita';
  end if;
  if p_status_mp not in ('authorized','pending','paused','cancelled','canceled') then
    raise exception 'Estado desconhecido da assinatura';
  end if;
  select * into p from public.oricstudio_solicitacoes
    where id=p_solicitacao for update;
  if not found then raise exception 'Contrato inexistente'; end if;
  v_cancelada:=p_status_mp in ('cancelled','canceled');
  update public.oricstudio_solicitacoes
    set mp_assinatura_status=p_status_mp,
        mp_ultimo_status=p_status_mp,
        ultima_conciliacao_em=now(),
        cancelamento_em=case when v_cancelada then coalesce(cancelamento_em,now()) else cancelamento_em end,
        status=case
          when v_cancelada and p.status in ('aguardando_checkout','pagamento_pendente')
            then 'cancelado'
          else p.status end,
        atualizado_em=now()
    where id=p.id;
  -- Cancelar bloqueia cobranças futuras, mas não remove período já pago.
  if v_cancelada and p.mp_ultimo_status is distinct from p_status_mp then
    insert into public.oricstudio_eventos_cobranca(solicitacao_id,clinica_id,tipo,detalhes)
    values(p.id,p.clinica_id,'assinatura_cancelada',jsonb_build_object('origem','mercadopago'));
  end if;
  return true;
end;
$orcstate$;

create or replace function public.oricstudio_registrar_estorno(
  p_mp_pagamento_id text,p_status_mp text
)
returns boolean language plpgsql security definer set search_path=''
as $orcrefund$
declare v_pag public.oricstudio_pagamentos;
declare v_ultimo timestamptz;
begin
  if current_user <> 'service_role' and auth.role() <> 'service_role' then
    raise exception 'Conciliação restrita';
  end if;
  if p_status_mp not in ('refunded','charged_back') then raise exception 'Estorno inválido'; end if;
  select * into v_pag from public.oricstudio_pagamentos
    where mp_pagamento_id=p_mp_pagamento_id for update;
  if not found or v_pag.status_mp=p_status_mp then return false; end if;
  update public.oricstudio_pagamentos set status_mp=p_status_mp,estornado_em=now()
    where id=v_pag.id;
  insert into public.oricstudio_eventos_cobranca(solicitacao_id,clinica_id,tipo,referencia,detalhes)
    values(v_pag.solicitacao_id,v_pag.clinica_id,'pagamento_estornado',p_mp_pagamento_id,
      jsonb_build_object('status',p_status_mp));
  select max(aprovado_em) into v_ultimo from public.oricstudio_pagamentos
    where clinica_id=v_pag.clinica_id and status_mp='approved';
  if v_ultimo is null or v_pag.aprovado_em>=v_ultimo then
    update public.oricstudio_licencas set status='suspenso',
       motivo='Pagamento mais recente estornado: revisão financeira necessária'
       where clinica_id=v_pag.clinica_id and status='ativo';
  end if;
  return true;
end;
$orcrefund$;
revoke all on function public.oricstudio_atualizar_estado_mp(uuid,text)
from public,anon,authenticated;
revoke all on function public.oricstudio_registrar_estorno(text,text)
from public,anon,authenticated;
grant execute on function public.oricstudio_atualizar_estado_mp(uuid,text) to service_role;
grant execute on function public.oricstudio_registrar_estorno(text,text) to service_role;

-- Impede reativação após cancelamento, exceto novo contrato.
create or replace function public.oricstudio_confirmar_pagamento(
  p_solicitacao_id uuid,p_mp_pagamento_id text,p_mp_assinatura_id text,p_aprovado_em timestamptz
)
returns boolean language plpgsql security definer set search_path=''
as $orcpayment$
declare
  p public.oricstudio_solicitacoes;
  v_expira timestamptz;
  v_ins bigint;
begin
  if current_user <> 'service_role' and auth.role() <> 'service_role' then
    raise exception 'Apenas conciliação de pagamentos';
  end if;
  if p_mp_pagamento_id !~ '^[0-9]+$' or length(p_mp_assinatura_id)<8
     or p_aprovado_em is null or p_aprovado_em > now()+interval '1 hour' then
    raise exception 'Pagamento inválido';
  end if;
  select * into p from public.oricstudio_solicitacoes where id=p_solicitacao_id for update;
  if not found then raise exception 'Solicitação desconhecida'; end if;
  if p.mp_assinatura_id is distinct from p_mp_assinatura_id or
     p.status not in ('pagamento_pendente','pago') or
     p.cancelamento_em is not null or
     p.mp_assinatura_status in ('cancelled','canceled','paused') then
    raise exception 'Assinatura não habilitada para renovação';
  end if;
  insert into public.oricstudio_pagamentos (
    solicitacao_id,clinica_id,mp_pagamento_id,mp_assinatura_id,valor_centavos,aprovado_em
  ) values (
    p.id,p.clinica_id,p_mp_pagamento_id,p_mp_assinatura_id,p.valor_mensal_centavos,p_aprovado_em
  ) on conflict (mp_pagamento_id) do nothing returning id into v_ins;
  if v_ins is null then return false; end if;
  select greatest(coalesce(l.expira_em,p_aprovado_em),p_aprovado_em)+interval '1 month'
    into v_expira from public.oricstudio_licencas l where l.clinica_id=p.clinica_id;
  if v_expira is null then v_expira:=p_aprovado_em+interval '1 month'; end if;
  insert into public.oricstudio_licencas(clinica_id,status,quantidade_contas_contratadas,expira_em,motivo)
  values(p.clinica_id,'ativo',p.quantidade_contas,v_expira,'Pagamento confirmado pelo Mercado Pago (OricStúdio)')
  on conflict(clinica_id) do update set
    status='ativo',quantidade_contas_contratadas=excluded.quantidade_contas_contratadas,
    expira_em=excluded.expira_em,motivo=excluded.motivo;
  update public.oricstudio_solicitacoes
    set status='pago',provedor='mercadopago',referencia_pagamento=p_mp_pagamento_id,
        mp_assinatura_status='authorized',pagamento_confirmado_em=p_aprovado_em,
        atualizado_em=now()
    where id=p.id;
  return true;
end;
$orcpayment$;
revoke all on function public.oricstudio_confirmar_pagamento(uuid,text,text,timestamptz)
from public,anon,authenticated;
grant execute on function public.oricstudio_confirmar_pagamento(uuid,text,text,timestamptz)
to service_role;
