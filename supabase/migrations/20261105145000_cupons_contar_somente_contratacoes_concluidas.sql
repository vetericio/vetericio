-- Aplicar o cupom não é consumi-lo. Contabilizar somente contratação concluída.
-- Pedidos pendentes, cancelados ou recusados não ocupam os limites.
CREATE OR REPLACE FUNCTION public.oricse_validar_codigo_promocional(p_codigo text, p_plano_codigo text, p_documento text, p_valor_base numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  promo public.oricse_codigos_promocionais;
  documento text := regexp_replace(coalesce(p_documento, ''), '\D', '', 'g');
  usos_total bigint;
  usos_documento bigint;
  valor_base numeric(12,2) := greatest(0, coalesce(p_valor_base, 0));
  desconto numeric(12,2);
begin
  select * into promo
  from public.oricse_codigos_promocionais p
  where p.codigo = upper(regexp_replace(trim(coalesce(p_codigo, '')), '\s+', '-', 'g'))
    and p.ativo;

  if not found then
    return jsonb_build_object('valido', false, 'mensagem', 'Código promocional inválido ou inativo.');
  end if;
  if promo.valido_de is not null and promo.valido_de > now()
     or promo.valido_ate is not null and promo.valido_ate < now() then
    return jsonb_build_object('valido', false, 'mensagem', 'Este código promocional está fora do período de validade.');
  end if;
  if cardinality(promo.planos) > 0 and not (p_plano_codigo = any(promo.planos)) then
    return jsonb_build_object('valido', false, 'mensagem', 'Este código não é válido para o plano selecionado.');
  end if;

  select count(*) into usos_total
  from public.oricse_codigo_promocional_usos u
  join public.oricse_contratacoes c on c.id = u.contratacao_id
  where u.codigo_id = promo.id
    and (
      c.pagamento_aprovado_em is not null
      or (c.valor_total = 0 and c.status in ('pagamento_aprovado','aprovada','ativa','ativada'))
    )
    and c.status not in ('cancelada','recusada');
  if promo.limite_usos is not null and usos_total >= promo.limite_usos then
    return jsonb_build_object('valido', false, 'mensagem', 'Este código promocional atingiu o limite de usos.');
  end if;

  if documento <> '' then
    select count(*) into usos_documento
    from public.oricse_codigo_promocional_usos u
    join public.oricse_contratacoes c on c.id = u.contratacao_id
    where u.codigo_id = promo.id and u.documento_normalizado = documento
      and (
      c.pagamento_aprovado_em is not null
      or (c.valor_total = 0 and c.status in ('pagamento_aprovado','aprovada','ativa','ativada'))
    )
    and c.status not in ('cancelada','recusada');
    if promo.limite_por_documento is not null and usos_documento >= promo.limite_por_documento then
      return jsonb_build_object('valido', false, 'mensagem', 'Este documento já atingiu o limite de uso do código.');
    end if;
  end if;

  if promo.somente_primeira_assinatura and exists (
    select 1
    from public.oricse_contratacoes c
    where (
      documento <> ''
      and documento in (
        regexp_replace(coalesce(c.cnpj, ''), '\D', '', 'g'),
        regexp_replace(coalesce(c.responsavel_cpf, ''), '\D', '', 'g')
      )
    )
      and (
      c.pagamento_aprovado_em is not null
      or (c.valor_total = 0 and c.status in ('pagamento_aprovado','aprovada','ativa','ativada'))
    )
    and c.status not in ('cancelada','recusada')
  ) then
    return jsonb_build_object('valido', false, 'mensagem', 'Este código é válido somente para a primeira assinatura.');
  end if;

  desconto := case
    when promo.tipo_desconto = 'percentual' then round(valor_base * promo.valor / 100, 2)
    else least(valor_base, promo.valor)
  end;

  return jsonb_build_object(
    'valido', true,
    'codigo', promo.codigo,
    'valor_original', valor_base,
    'desconto_aplicado', desconto,
    'valor_final', greatest(0, valor_base - desconto),
    'duracao', promo.duracao
  );
end;
$function$

