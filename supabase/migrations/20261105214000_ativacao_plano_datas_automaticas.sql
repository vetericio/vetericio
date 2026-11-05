-- A vigência e a cobrança derivam exclusivamente do ciclo contratado.
-- Aprovação de isenção não equivale a pagamento efetuado.
create or replace function public.oricse_admin_ativar_contratacao(p_contratacao uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  pedido public.oricse_contratacoes%rowtype;
  clinica public.clinicas%rowtype;
  inicio date := (now() at time zone 'America/Sao_Paulo')::date;
  vencimento date;
  isento boolean;
  dias int;
begin
  if not public.oricse_is_platform_admin() then raise exception 'Somente o administrador geral pode autorizar o funcionamento' using errcode='42501'; end if;
  select * into pedido from public.oricse_contratacoes where id=p_contratacao for update;
  if not found then raise exception 'Solicitação não encontrada' using errcode='P0002'; end if;
  if pedido.excluido_em is not null then raise exception 'Solicitação na lixeira não pode ser ativada' using errcode='22023'; end if;
  if pedido.status not in ('em_configuracao','em_analise','pagamento_aprovado','isento_aguardando_aprovacao') then raise exception 'Solicitação não está pronta para ativação' using errcode='22023'; end if;
  if pedido.clinica_criada_id is null then raise exception 'Prepare o espaço da clínica antes de autorizar' using errcode='22023'; end if;
  select * into clinica from public.clinicas where id=pedido.clinica_criada_id for update;
  if not found or clinica.excluido_em is not null then raise exception 'Clínica inexistente ou na lixeira' using errcode='22023'; end if;
  isento:=pedido.valor_total=0 and pedido.promo_codigo is not null and pedido.promo_valor_original>0
    and pedido.promo_desconto>=pedido.promo_valor_original and pedido.promo_valor_final=0;
  if not isento and (pedido.pagamento_id is null or pedido.pagamento_aprovado_em is null) then
    raise exception 'Não há pagamento confirmado nem cupom integral válido' using errcode='22023';
  end if;
  vencimento:=case pedido.ciclo
    when 'mensal' then (inicio + interval '1 month')::date
    when 'trimestral' then (inicio + interval '3 months')::date
    when 'semestral' then (inicio + interval '6 months')::date
    when 'anual' then (inicio + interval '1 year')::date
    when 'bienal' then (inicio + interval '2 years')::date
    when 'teste' then inicio + 7
    else null end;
  if vencimento is null then raise exception 'Ciclo da contratação inválido' using errcode='22023'; end if;
  if exists(select 1 from public.oricse_assinaturas where clinica_id=clinica.id and status='ativa') then
    raise exception 'Já existe assinatura ativa para a clínica. Verifique antes de autorizar.' using errcode='23505';
  end if;
  insert into public.oricse_assinaturas
    (clinica_id,contratacao_id,plano_codigo,ciclo,modo_renovacao,status,inicio_em,proximo_vencimento_em,dia_ancora,
      ultimo_pagamento_id,ultimo_pagamento_em)
    values (clinica.id,pedido.id,pedido.plano_codigo,pedido.ciclo,
      coalesce(nullif(pedido.modo_renovacao,''),'manual'),'ativa',inicio,vencimento,
      extract(day from inicio)::smallint,case when isento then null else pedido.pagamento_id end,
      case when isento then null else pedido.pagamento_aprovado_em end);
  update public.clinicas set status='ativa',status_financeiro=case when isento then 'isento' else 'em_dia' end,
    ultimo_pagamento_em=case when isento then null else pedido.pagamento_aprovado_em end,
    proximo_pagamento_em=vencimento::timestamptz,
    acesso_ate=vencimento::timestamptz,
    plano=pedido.plano_codigo,updated_at=now()
    where id=clinica.id;
  update public.oricse_contratacoes set status='ativada',updated_at=now() where id=pedido.id;
  return jsonb_build_object('ok',true,'clinica_id',clinica.id,'inicio_em',inicio,'proximo_vencimento_em',vencimento,'isento',isento);
end $$;
revoke all on function public.oricse_admin_ativar_contratacao(uuid) from public,anon;
grant execute on function public.oricse_admin_ativar_contratacao(uuid) to authenticated;
