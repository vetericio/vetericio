-- Contabiliza cupons pela contratação, não pelo evento de pagamento.
-- Migração correspondente à alteração já aplicada em produção via Supabase.
-- Contratações isentas recebidas também usam uma vaga de cupom.

CREATE OR REPLACE FUNCTION public.oricse_cupom_uso_concluido(p_status text, p_pagamento_aprovado_em timestamp with time zone, p_valor_total numeric, p_promo_codigo text, p_promo_valor_original numeric, p_promo_desconto numeric, p_promo_valor_final numeric)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select coalesce(p_status,'') not in ('cancelada','recusada')
    and (
      p_pagamento_aprovado_em is not null
      or (
        p_valor_total = 0
        and nullif(btrim(coalesce(p_promo_codigo,'')), '') is not null
        and p_promo_valor_original > 0
        and p_promo_desconto >= p_promo_valor_original
        and p_promo_valor_final = 0
        and p_status in (
          'isento_aguardando_aprovacao','em_analise','em_configuracao',
          'pagamento_aprovado','aprovada','ativa','ativada'
        )
      )
    );
$function$;

CREATE UNIQUE INDEX IF NOT EXISTS oricse_codigo_promocional_usos_unico_por_contratacao
  ON public.oricse_codigo_promocional_usos (codigo_id, contratacao_id)
  WHERE contratacao_id IS NOT NULL;

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
    and public.oricse_cupom_uso_concluido(c.status,c.pagamento_aprovado_em,c.valor_total,c.promo_codigo,c.promo_valor_original,c.promo_desconto,c.promo_valor_final)
    and c.status not in ('cancelada','recusada');
  if promo.limite_usos is not null and usos_total >= promo.limite_usos then
    return jsonb_build_object('valido', false, 'mensagem', 'Este código promocional atingiu o limite de usos.');
  end if;

  if documento <> '' then
    select count(*) into usos_documento
    from public.oricse_codigo_promocional_usos u
    join public.oricse_contratacoes c on c.id = u.contratacao_id
    where u.codigo_id = promo.id and u.documento_normalizado = documento
      and public.oricse_cupom_uso_concluido(c.status,c.pagamento_aprovado_em,c.valor_total,c.promo_codigo,c.promo_valor_original,c.promo_desconto,c.promo_valor_final)
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
      and public.oricse_cupom_uso_concluido(c.status,c.pagamento_aprovado_em,c.valor_total,c.promo_codigo,c.promo_valor_original,c.promo_desconto,c.promo_valor_final)
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
$function$;

CREATE OR REPLACE FUNCTION public.oricse_controlar_limite_cupom_na_insercao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  cupom public.oricse_codigos_promocionais%rowtype;
  pedido public.oricse_contratacoes%rowtype;
  usos_total bigint;
  usos_documento bigint;
begin
  if new.contratacao_id is null then return new; end if;
  select * into cupom from public.oricse_codigos_promocionais
    where id = new.codigo_id for update;
  if not found then raise exception 'Cupom inexistente' using errcode='22023'; end if;
  select * into pedido from public.oricse_contratacoes
    where id = new.contratacao_id;
  if not found then raise exception 'Contratação inexistente' using errcode='22023'; end if;
  if not public.oricse_cupom_uso_concluido(
    pedido.status,pedido.pagamento_aprovado_em,pedido.valor_total,
    pedido.promo_codigo,pedido.promo_valor_original,pedido.promo_desconto,pedido.promo_valor_final
  ) then return new; end if;

  select count(*) into usos_total
    from public.oricse_codigo_promocional_usos u
    join public.oricse_contratacoes c on c.id=u.contratacao_id
    where u.codigo_id=new.codigo_id
      and public.oricse_cupom_uso_concluido(c.status,c.pagamento_aprovado_em,
        c.valor_total,c.promo_codigo,c.promo_valor_original,c.promo_desconto,c.promo_valor_final);

  if cupom.limite_usos is not null and usos_total >= cupom.limite_usos then
    raise exception 'Este código promocional atingiu o limite de usos.' using errcode='23514';
  end if;

  if cupom.limite_por_documento is not null and new.documento_normalizado is not null then
    select count(*) into usos_documento
      from public.oricse_codigo_promocional_usos u
      join public.oricse_contratacoes c on c.id=u.contratacao_id
      where u.codigo_id=new.codigo_id
        and u.documento_normalizado=new.documento_normalizado
        and public.oricse_cupom_uso_concluido(c.status,c.pagamento_aprovado_em,
          c.valor_total,c.promo_codigo,c.promo_valor_original,c.promo_desconto,c.promo_valor_final);
    if usos_documento >= cupom.limite_por_documento then
      raise exception 'Este documento já atingiu o limite de uso do código.' using errcode='23514';
    end if;
  end if;
  return new;
end;
$function$;

REVOKE ALL ON FUNCTION public.oricse_controlar_limite_cupom_na_insercao()
  FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS oricse_cupom_limite_na_insercao ON public.oricse_codigo_promocional_usos;
CREATE TRIGGER oricse_cupom_limite_na_insercao
  BEFORE INSERT ON public.oricse_codigo_promocional_usos
  FOR EACH ROW EXECUTE FUNCTION public.oricse_controlar_limite_cupom_na_insercao();
