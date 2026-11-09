-- Ciclos elegíveis por cupom (independentes dos planos e do efeito do desconto).
-- Array vazio = qualquer ciclo. Cupons existentes mantêm seu funcionamento.
ALTER TABLE public.oricse_codigos_promocionais
  ADD COLUMN IF NOT EXISTS ciclos_elegiveis text[] NOT NULL DEFAULT ARRAY[]::text[];

ALTER TABLE public.oricse_codigos_promocionais
  DROP CONSTRAINT IF EXISTS oricse_codigos_promocionais_ciclos_validos;
ALTER TABLE public.oricse_codigos_promocionais
  ADD CONSTRAINT oricse_codigos_promocionais_ciclos_validos
  CHECK (ciclos_elegiveis <@ ARRAY['mensal','trimestral','semestral','anual','bienal']::text[]);

-- Validação completa: a duração é conferida no servidor em cada aplicação.
CREATE OR REPLACE FUNCTION public.oricse_validar_codigo_promocional(p_codigo text, p_plano_codigo text, p_documento text, p_valor_base numeric, p_ciclo text)
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

  if coalesce(cardinality(promo.ciclos_elegiveis), 0) > 0
     and not (lower(coalesce(p_ciclo, '')) = any(promo.ciclos_elegiveis)) then
    return jsonb_build_object('valido', false, 'mensagem', 'Este cupom não é válido para a duração de assinatura selecionada.');
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

-- Compatibilidade: consumidores antigos com quatro parâmetros só aceitam
-- cupons sem restrição de ciclo (falha segura; nunca ignora uma restrição).
CREATE OR REPLACE FUNCTION public.oricse_validar_codigo_promocional(
  p_codigo text, p_plano_codigo text, p_documento text, p_valor_base numeric
) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO ''
AS $wrapper$
  SELECT public.oricse_validar_codigo_promocional(
    p_codigo, p_plano_codigo, p_documento, p_valor_base, NULL::text
  );
$wrapper$;

-- Revalida a duração na gravação final, sem confiar na prévia do navegador.
create or replace function public.oricse_iniciar_contratacao(p_dados jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  novo public.oricse_contratacoes;
  plano public.oricse_planos;
  v_ciclo text := lower(coalesce(p_dados->>'ciclo',''));
  v_modo text := coalesce(p_dados->>'modo_renovacao','manual');
  v_meses integer;
  v_base numeric(12,2);
  v_total_bruto numeric(12,2);
  v_total numeric(12,2);
  v_usuarios integer;
  v_inclusos integer;
  v_extras integer;
  v_extra_mensal numeric(12,2) := 14.90;
  v_promo jsonb;
  v_documento text;
begin
  if jsonb_typeof(p_dados) is distinct from 'object'
    or p_dados->>'aceitou_termos' is distinct from 'true'
    or p_dados->>'aceitou_privacidade' is distinct from 'true' then
    raise exception 'Revise os dados e aceite os termos e a política de privacidade.' using errcode='22023';
  end if;
  if coalesce(btrim(p_dados->>'clinica_nome'),'')='' or coalesce(btrim(p_dados->>'responsavel_nome'),'')=''
    or coalesce(btrim(p_dados->>'responsavel_email'),'')='' then
    raise exception 'Informe o nome da clínica e os dados do responsável.' using errcode='22023';
  end if;
  if v_ciclo not in ('mensal','trimestral','semestral','anual','bienal') then
    raise exception 'Ciclo de contratação inválido.' using errcode='22023';
  end if;
  if v_modo not in ('automatica_cartao','manual') then
    raise exception 'Forma de renovação inválida.' using errcode='22023';
  end if;

  select * into plano from public.oricse_planos
  where codigo=nullif(btrim(p_dados->>'plano_codigo'),'') and ativo;
  if not found then raise exception 'O plano selecionado não está disponível.' using errcode='22023'; end if;

  v_meses := case v_ciclo when 'mensal' then 1 when 'trimestral' then 3 when 'semestral' then 6 when 'anual' then 12 else 24 end;
  v_base := public.oricse_valor_brl(
    case v_ciclo
      when 'mensal' then plano.preco_mensal
      when 'trimestral' then plano.preco_trimestral
      when 'semestral' then plano.preco_semestral
      when 'anual' then plano.preco_anual
      else plano.preco_bienal
    end
  );
  if v_base <= 0 then raise exception 'O preço deste período ainda não foi configurado.' using errcode='22023'; end if;

  v_usuarios := greatest(1,least(10000,coalesce(nullif(p_dados->>'quantidade_usuarios','')::integer,1)));
  v_inclusos := greatest(1,coalesce(plano.usuarios_inclusos,1));
  v_extras := greatest(0,v_usuarios-v_inclusos);
  v_total_bruto := round(v_base + v_extras*v_extra_mensal*v_meses,2);
  v_total := v_total_bruto;
  v_documento := regexp_replace(coalesce(nullif(p_dados->>'cnpj',''),p_dados->>'responsavel_cpf',''),'\D','','g');

  if coalesce(btrim(p_dados->>'promo_codigo'),'') <> '' then
    v_promo := public.oricse_validar_codigo_promocional(p_dados->>'promo_codigo',plano.codigo,v_documento,v_total_bruto,v_ciclo);
    if coalesce((v_promo->>'valido')::boolean,false) is not true then
      raise exception '%',coalesce(v_promo->>'mensagem','Código promocional inválido.') using errcode='22023';
    end if;
    v_total := (v_promo->>'valor_final')::numeric;
  end if;

  insert into public.oricse_contratacoes (
    plano_codigo,plano_nome,ciclo,status,clinica_nome,razao_social,cnpj,clinica_telefone,clinica_email,
    clinica_cep,clinica_endereco,clinica_numero,clinica_complemento,clinica_bairro,clinica_cidade,clinica_uf,
    tipo_operacao,slug_desejado,dominio,quantidade_usuarios,perfis_inclusos,perfis_extras,
    adicional_perfis_mensal,adicional_perfis_ciclo,valor_base,valor_total,valor_exibido,
    responsavel_nome,responsavel_cpf,responsavel_crmv,responsavel_crmv_uf,responsavel_email,responsavel_telefone,
    responsavel_cep,responsavel_endereco,responsavel_numero,responsavel_complemento,responsavel_bairro,
    responsavel_cidade,responsavel_uf,observacoes,aceitou_termos,aceitou_privacidade,
    promo_codigo,promo_valor_original,promo_desconto,promo_valor_final,promo_duracao,
    modo_renovacao,renovacao_automatica,dados
  ) values (
    plano.codigo,plano.nome,v_ciclo,'aguardando_pagamento',btrim(p_dados->>'clinica_nome'),
    nullif(btrim(p_dados->>'razao_social'),''),nullif(regexp_replace(coalesce(p_dados->>'cnpj',''),'\D','','g'),''),
    nullif(btrim(p_dados->>'clinica_telefone'),''),nullif(btrim(p_dados->>'clinica_email'),''),nullif(btrim(p_dados->>'clinica_cep'),''),
    nullif(btrim(p_dados->>'clinica_endereco'),''),nullif(btrim(p_dados->>'clinica_numero'),''),nullif(btrim(p_dados->>'clinica_complemento'),''),
    nullif(btrim(p_dados->>'clinica_bairro'),''),nullif(btrim(p_dados->>'clinica_cidade'),''),nullif(btrim(p_dados->>'clinica_uf'),''),
    nullif(btrim(p_dados->>'tipo_operacao'),''),nullif(btrim(p_dados->>'slug_desejado'),''),nullif(btrim(p_dados->>'dominio'),''),
    v_usuarios,v_inclusos,v_extras,v_extras*v_extra_mensal,v_extras*v_extra_mensal*v_meses,
    v_base,v_total,'R$ '||replace(to_char(v_total,'FM999999999990.00'),'.',','),
    btrim(p_dados->>'responsavel_nome'),nullif(regexp_replace(coalesce(p_dados->>'responsavel_cpf',''),'\D','','g'),''),
    nullif(btrim(p_dados->>'responsavel_crmv'),''),nullif(btrim(p_dados->>'responsavel_crmv_uf'),''),
    lower(btrim(p_dados->>'responsavel_email')),nullif(btrim(p_dados->>'responsavel_telefone'),''),
    nullif(btrim(p_dados->>'responsavel_cep'),''),nullif(btrim(p_dados->>'responsavel_endereco'),''),
    nullif(btrim(p_dados->>'responsavel_numero'),''),nullif(btrim(p_dados->>'responsavel_complemento'),''),
    nullif(btrim(p_dados->>'responsavel_bairro'),''),nullif(btrim(p_dados->>'responsavel_cidade'),''),
    nullif(btrim(p_dados->>'responsavel_uf'),''),nullif(btrim(p_dados->>'observacoes'),''),true,true,
    nullif(btrim(p_dados->>'promo_codigo'),''),
    case when v_promo is null then null else (v_promo->>'valor_original')::numeric end,
    case when v_promo is null then null else (v_promo->>'desconto_aplicado')::numeric end,
    case when v_promo is null then null else (v_promo->>'valor_final')::numeric end,
    case when v_promo is null then null else nullif(v_promo->>'duracao','') end,
    v_modo,v_modo='automatica_cartao',p_dados
  ) returning * into novo;

  if v_promo is not null then
    insert into public.oricse_codigo_promocional_usos(codigo_id,contratacao_id,documento_normalizado)
    select p.id,novo.id,nullif(v_documento,'')
    from public.oricse_codigos_promocionais p
    where p.codigo=upper(regexp_replace(trim(p_dados->>'promo_codigo'),'\s+','-','g'));
  end if;

  return jsonb_build_object('id',novo.id,'status',novo.status,'valor_exibido',novo.valor_exibido,'created_at',novo.created_at);
end;
$$;

GRANT EXECUTE ON FUNCTION public.oricse_validar_codigo_promocional(text,text,text,numeric,text) TO anon, authenticated;
