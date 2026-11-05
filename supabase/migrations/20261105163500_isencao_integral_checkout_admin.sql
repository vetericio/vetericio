-- Pedidos com cupom integral não passam pelo Mercado Pago; aguardam avaliação administrativa.
create or replace function public.oricse_finalizar_contratacao_isenta(p_contratacao uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare pedido public.oricse_contratacoes;
begin
  select * into pedido from public.oricse_contratacoes where id=p_contratacao for update;
  if not found then raise exception 'Pedido não encontrado' using errcode='P0002'; end if;
  if pedido.status='isento_aguardando_aprovacao' then
    return jsonb_build_object('id',pedido.id,'status',pedido.status,'valor_total',pedido.valor_total);
  end if;
  if pedido.status<>'aguardando_pagamento' then
    raise exception 'Pedido já encaminhado ou não elegível.' using errcode='22023';
  end if;
  if pedido.valor_total is distinct from 0 or pedido.promo_codigo is null
    or pedido.promo_valor_original is null or pedido.promo_valor_original<=0
    or pedido.promo_desconto is null or pedido.promo_desconto<pedido.promo_valor_original
    or pedido.promo_valor_final is distinct from 0 then
    raise exception 'Pedido não possui isenção integral validada.' using errcode='22023';
  end if;
  update public.oricse_contratacoes
    set status='isento_aguardando_aprovacao',updated_at=now()
    where id=p_contratacao;
  return jsonb_build_object('id',pedido.id,'status','isento_aguardando_aprovacao','valor_total',0);
end $$;
revoke all on function public.oricse_finalizar_contratacao_isenta(uuid) from public;
grant execute on function public.oricse_finalizar_contratacao_isenta(uuid) to anon,authenticated;

-- Permitir criação de clínica pelo administrador para isenção integral verificada,
-- sem fabricar aprovação de pagamento ou transação financeira.
CREATE OR REPLACE FUNCTION public.oricse_admin_preparar_clinica(p_contratacao uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare pedido public.oricse_contratacoes; novo uuid; slug_base text;
begin
  if auth.uid() is null or not exists (
    select 1 from public.app_users where user_id=auth.uid() and role='admin'
  ) then raise exception 'Somente administradores podem preparar clínicas' using errcode='42501'; end if;
  select * into pedido from public.oricse_contratacoes where id=p_contratacao for update;
  if not found then raise exception 'Solicitação não encontrada'; end if;
  if pedido.clinica_criada_id is not null then return pedido.clinica_criada_id; end if;
  if pedido.status not in ('pagamento_aprovado','em_analise','isento_aguardando_aprovacao') then
    raise exception 'Pagamento não confirmado ou solicitação não elegível';
  end if;
  if not ((pedido.valor_total = 0 and pedido.promo_codigo is not null
    and pedido.promo_valor_original > 0
    and pedido.promo_desconto >= pedido.promo_valor_original
    and pedido.promo_valor_final = 0) or (pedido.pagamento_aprovado_em is not null and pedido.pagamento_id is not null)) then
    raise exception 'Confirmação financeira ou isenção integral validada ausente';
  end if;
  slug_base := lower(regexp_replace(coalesce(nullif(pedido.slug_desejado,''), 'clinica-'||left(pedido.id::text,8)), '[^a-zA-Z0-9_-]', '', 'g'));
  if slug_base='' then slug_base:='clinica-'||left(pedido.id::text,8); end if;
  if exists(select 1 from public.clinicas where slug=slug_base) then
    raise exception 'Identificador público já utilizado. Ajuste o @ antes de preparar o espaço.';
  end if;
  insert into public.clinicas(nome,slug,tipo_publico,status,plano,limite_usuarios,status_financeiro,ultimo_pagamento_em,observacoes)
  values(coalesce(nullif(pedido.dados->>'nome_publico',''),pedido.clinica_nome),slug_base,
  case when pedido.tipo_operacao='petshop' then 'pet' else 'vet' end,
  'bloqueada',CASE WHEN pedido.plano_codigo LIKE '%-2026' THEN pedido.plano_codigo ELSE pedido.plano_nome END,greatest(1,coalesce(pedido.quantidade_usuarios,1)),
  'em_dia',coalesce(pedido.pagamento_aprovado_em,now()),'Criada a partir da contratação '||pedido.id::text||'. '||case when pedido.valor_total=0 then 'Isenção promocional integral aprovada. ' else '' end||'Aguardando configuração e ativação.')
  returning id into novo;
  update public.oricse_contratacoes set clinica_criada_id=novo,status='em_configuracao',updated_at=now() where id=p_contratacao;
  return novo;
end $function$

