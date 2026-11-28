-- Build/release gate: instalar NÃO anuncia nem prende nenhuma oferta nova.
-- Só um operador do banco pode definir inicia_em e habilitada na mesma operação
-- depois de validar frontend, checkout, ativação e enforcement.
create schema if not exists private;
create table private.oricse_oferta_perfis_equipe_controle (
  id boolean primary key default true check(id),
  habilitada boolean not null default false,
  inicia_em timestamptz,
  check(not habilitada or inicia_em is not null)
);
insert into private.oricse_oferta_perfis_equipe_controle(id) values(true);
revoke all on table private.oricse_oferta_perfis_equipe_controle from public,anon,authenticated,service_role;

create table private.oricse_ofertas_perfis_aceitas (
  contratacao_id uuid primary key references public.oricse_contratacoes(id) on delete cascade,
  oferta_id text not null check(oferta_id='oricse-perfis-equipe-2027-01'),
  plano_codigo text not null check(plano_codigo in ('essencial-2026','profissional-2026','master-2026')),
  aceita_em timestamptz not null check(aceita_em < timestamptz '2027-02-01 03:00:00+00'),
  quantidade_usuarios integer not null check(quantidade_usuarios between 1 and 10000),
  perfis_inclusos integer not null check(perfis_inclusos>=1),
  perfis_extras_cobrados integer not null check(perfis_extras_cobrados>=0),
  valor_total numeric(12,2) not null check(valor_total>=0)
);
revoke all on table private.oricse_ofertas_perfis_aceitas from public,anon,authenticated,service_role;

create function private.oricse_oferta_perfis_em(p_instante timestamptz)
returns boolean language sql stable security invoker set search_path='' as $$
  select coalesce((
    select c.habilitada and c.inicia_em <= p_instante and p_instante < timestamptz '2027-02-01 03:00:00+00'
    from private.oricse_oferta_perfis_equipe_controle c where c.id
  ),false);
$$;
revoke all on function private.oricse_oferta_perfis_em(timestamptz) from public,anon,authenticated,service_role;

create function public.oricse_oferta_perfis_equipe()
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'ativa',ativa, 'id',case when ativa then 'oricse-perfis-equipe-2027-01' end,
    'encerra_em',case when ativa then '2027-01-31' end, 'essencial_bonus',2
  )
  from (select private.oricse_oferta_perfis_em(statement_timestamp()) as ativa) oferta;
$$;
revoke all on function public.oricse_oferta_perfis_equipe() from public,anon,authenticated;
grant execute on function public.oricse_oferta_perfis_equipe() to anon,authenticated;

-- Um único ponto para conferir valores e identidade persistidos, não o JSON
-- de dados do navegador e não o conteúdo de callback do pagamento.
create function private.oricse_oferta_perfis_confere(
  p_pedido public.oricse_contratacoes, p_oferta private.oricse_ofertas_perfis_aceitas
)
returns boolean language sql stable security invoker set search_path='' as $$
  select coalesce(
      p_oferta.contratacao_id=p_pedido.id
      and p_oferta.plano_codigo=p_pedido.plano_codigo
      and p_oferta.quantidade_usuarios=p_pedido.quantidade_usuarios
      and p_oferta.perfis_inclusos=p_pedido.perfis_inclusos
      and p_oferta.perfis_extras_cobrados=p_pedido.perfis_extras
      and p_oferta.valor_total=p_pedido.valor_total, false);
$$;
revoke all on function private.oricse_oferta_perfis_confere(public.oricse_contratacoes,private.oricse_ofertas_perfis_aceitas)
  from public,anon,authenticated,service_role;

create function private.oricse_oferta_perfis_financeiro_confirmado(p public.oricse_contratacoes)
returns boolean language sql stable security invoker set search_path='' as $$
  select coalesce(
    (p.valor_total>0 and nullif(btrim(p.pagamento_id),'') is not null and p.pagamento_aprovado_em is not null)
    or (p.valor_total=0 and p.promo_codigo is not null and p.promo_valor_original>0
      and p.promo_desconto>=p.promo_valor_original and p.promo_valor_final=0),false);
$$;
revoke all on function private.oricse_oferta_perfis_financeiro_confirmado(public.oricse_contratacoes)
  from public,anon,authenticated,service_role;

create function private.oricse_promocao_perfis_ativa(p_clinica_id uuid)
returns table(ilimitado boolean, bonus_perfis integer)
language sql stable security definer set search_path='' as $$
  -- A janela comercial serve só para novas aceitações. O direito existente vem
  -- da mesma assinatura vigente e do mesmo pedido ativado após validação financeira.
  select coalesce(oferta.plano_codigo in ('profissional-2026','master-2026'),false),
         case when oferta.plano_codigo='essencial-2026' then 2 else 0 end
  from (values(1)) as padrao(n)
  left join lateral (
    select o.plano_codigo
    from public.oricse_assinaturas s
    join public.clinicas c on c.id=s.clinica_id
    join public.oricse_contratacoes p on p.id=s.contratacao_id and p.clinica_criada_id=c.id
    join private.oricse_ofertas_perfis_aceitas o on o.contratacao_id=p.id
    where s.clinica_id=p_clinica_id and s.status='ativa'
      and s.plano_codigo=o.plano_codigo and c.plano=s.plano_codigo
      and c.status='ativa' and c.excluido_em is null and p.excluido_em is null
      and p.status='ativada' and private.oricse_oferta_perfis_confere(p,o)
      and private.oricse_oferta_perfis_financeiro_confirmado(p)
      and public.oricse_acesso_administrativo_liberado(c.id)
    limit 1
  ) oferta on true;
$$;
revoke all on function private.oricse_promocao_perfis_ativa(uuid) from public,anon,authenticated,service_role;

create function private.oricse_validar_ativacao_oferta_perfis()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  oferta private.oricse_ofertas_perfis_aceitas;
begin
  if new.status <> 'ativada' or old.status is not distinct from new.status then return new; end if;
  select o.* into oferta from private.oricse_ofertas_perfis_aceitas o where o.contratacao_id=old.id;
  if not found then return new; end if; -- pedidos anteriores/sem oferta ficam intactos
  if not private.oricse_oferta_perfis_confere(new,oferta) or not private.oricse_oferta_perfis_financeiro_confirmado(new)
    or not exists (
      select 1 from public.oricse_assinaturas s join public.clinicas c on c.id=s.clinica_id
      where s.contratacao_id=new.id and c.id=new.clinica_criada_id and s.plano_codigo=oferta.plano_codigo
        and s.status='ativa' and c.plano=oferta.plano_codigo
        and c.limite_usuarios=oferta.perfis_inclusos+oferta.perfis_extras_cobrados
    ) then
    raise exception 'A ativação não corresponde ao pedido promocional confirmado. Confira a assinatura e o limite-base.'
      using errcode='22023';
  end if;
  return new;
end;
$$;
revoke all on function private.oricse_validar_ativacao_oferta_perfis() from public,anon,authenticated,service_role;
create trigger oricse_validar_ativacao_oferta_perfis before update of status on public.oricse_contratacoes
for each row execute function private.oricse_validar_ativacao_oferta_perfis();

-- Alterações mínimas nas definições LIVE de emissão e preparação.
CREATE OR REPLACE FUNCTION public.oricse_iniciar_contratacao(p_dados jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  v_agora timestamptz := statement_timestamp();
  v_oferta_id text;
  v_dados jsonb;
begin
  if jsonb_typeof(p_dados) is distinct from 'object'
    or p_dados->>'aceitou_termos' is distinct from 'true'
    or p_dados->>'aceitou_privacidade' is distinct from 'true' then
    raise exception 'Revise os dados e aceite os termos e a política de privacidade.' using errcode='22023';
  end if;
  v_dados := p_dados - array['oferta_perfis_esperada','oferta_perfis_total_esperado_centavos','oferta_perfis_id','limite_base_contratado'];
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
  if plano.codigo in ('essencial-2026','profissional-2026','master-2026')
    and private.oricse_oferta_perfis_em(v_agora) then
    v_oferta_id := 'oricse-perfis-equipe-2027-01';
  end if;
  if (v_oferta_id is not null or p_dados ? 'oferta_perfis_esperada')
    and (p_dados->>'oferta_perfis_esperada') is distinct from v_oferta_id then
    raise exception 'A oferta de perfis mudou. Atualize o pedido e confira os valores antes de continuar.'
      using errcode='22023';
  end if;
  if v_oferta_id is not null and plano.codigo='master-2026'
    and p_dados->'aceitou_fidelidade_master' is distinct from 'true'::jsonb then
    raise exception 'Confirme ciência da fidelidade do plano Master antes de continuar.' using errcode='22023';
  end if;
  v_extras := case
    when v_oferta_id is not null and plano.codigo in ('profissional-2026','master-2026') then 0
    when v_oferta_id is not null and plano.codigo='essencial-2026' then greatest(0,v_usuarios-v_inclusos-2)
    else greatest(0,v_usuarios-v_inclusos)
  end;
  v_total_bruto := round(v_base + v_extras*v_extra_mensal*v_meses,2);
  v_total := v_total_bruto;
  v_documento := regexp_replace(coalesce(nullif(p_dados->>'cnpj',''),p_dados->>'responsavel_cpf',''),'\D','','g');

  if coalesce(btrim(p_dados->>'promo_codigo'),'') <> '' then
    v_promo := public.oricse_validar_codigo_promocional(p_dados->>'promo_codigo',plano.codigo,v_documento,v_total_bruto,v_ciclo,v_modo);
    if coalesce((v_promo->>'valido')::boolean,false) is not true then
      raise exception '%',coalesce(v_promo->>'mensagem','Código promocional inválido.') using errcode='22023';
    end if;
    v_total := (v_promo->>'valor_final')::numeric;
  end if;

  -- A recorrência no cartão usa o total do pedido como valor de TODOS os
  -- ciclos. Não combine nela desconto positivo válido por apenas um ciclo.
  if v_oferta_id is not null and v_modo='automatica_cartao'
    and v_total > 0 and v_total < v_total_bruto and v_promo->>'duracao'='primeiro_mes' then
    raise exception 'Para combinar esta oferta com cupom de um ciclo, selecione renovação manual.'
      using errcode='22023';
  end if;

  -- Aceite explícito do total visto no checkout. O cliente não define preço;
  -- a divergência cancela antes de criar pedido ou uso de cupom.
  if p_dados ? 'oferta_perfis_total_esperado_centavos' then
    if jsonb_typeof(p_dados->'oferta_perfis_total_esperado_centavos') is distinct from 'number'
       or coalesce(p_dados->>'oferta_perfis_total_esperado_centavos','') !~ '^[0-9]{1,12}$' then
      raise exception 'Atualize a página para confirmar o total da contratação.' using errcode='22023';
    end if;
    if (p_dados->>'oferta_perfis_total_esperado_centavos')::numeric is distinct from round(v_total*100) then
      raise exception 'O total da contratação mudou. Confira os valores antes de continuar.' using errcode='22023';
    end if;
  end if;

  if v_oferta_id is not null then
    -- Espelho para exibição/contrato, não autorização. Os valores canônicos têm fonte no servidor.
    v_dados := v_dados || jsonb_build_object(
      'oferta_perfis_id',v_oferta_id,'perfis_inclusos',v_inclusos,'perfis_extras',v_extras,
      'adicional_perfis_mensal',v_extras*v_extra_mensal,'adicional_perfis_ciclo',v_extras*v_extra_mensal*v_meses,
      'valor_base',v_base,'valor_total',v_total,'limite_base_contratado',v_inclusos+v_extras
    );
    if plano.codigo='master-2026' then
      v_dados := v_dados || jsonb_build_object(
        'aceitou_fidelidade_master',true,'fidelidade_meses',12,'fidelidade_aceita_em',v_agora
      );
    end if;
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
    v_modo,v_modo='automatica_cartao',v_dados
  ) returning * into novo;

  if v_promo is not null then
    insert into public.oricse_codigo_promocional_usos(codigo_id,contratacao_id,documento_normalizado)
    select p.id,novo.id,nullif(v_documento,'')
    from public.oricse_codigos_promocionais p
    where p.codigo=upper(regexp_replace(trim(p_dados->>'promo_codigo'),'\s+','-','g'));
  end if;

  if v_oferta_id is not null then
    insert into private.oricse_ofertas_perfis_aceitas
      (contratacao_id,oferta_id,plano_codigo,aceita_em,quantidade_usuarios,perfis_inclusos,perfis_extras_cobrados,valor_total)
    values(novo.id,v_oferta_id,plano.codigo,v_agora,v_usuarios,v_inclusos,v_extras,v_total);
    if v_total=0 and v_promo is not null then
      -- Mesmo caminho oficial do cupom integral: não gera checkout de R$ 0,00.
      perform public.oricse_finalizar_contratacao_isenta(novo.id);
      select p.* into strict novo from public.oricse_contratacoes p where p.id=novo.id;
    end if;
  end if;

  return jsonb_build_object('id',novo.id,'status',novo.status,'valor_exibido',novo.valor_exibido,
    'created_at',novo.created_at,'valor_total',novo.valor_total,'oferta_perfis_id',v_oferta_id);
end;
$function$;

CREATE OR REPLACE FUNCTION public.oricse_admin_preparar_clinica(p_contratacao uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare pedido public.oricse_contratacoes; novo uuid; slug_base text; oferta private.oricse_ofertas_perfis_aceitas; limite_base integer;
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
  limite_base := greatest(1,coalesce(pedido.quantidade_usuarios,1));
  select o.* into oferta from private.oricse_ofertas_perfis_aceitas o where o.contratacao_id=pedido.id;
  if found then
    if not private.oricse_oferta_perfis_confere(pedido,oferta) then
      raise exception 'O pedido promocional diverge dos valores e perfis aceitos. Revise antes de preparar.'
        using errcode='22023';
    end if;
    limite_base := oferta.perfis_inclusos+oferta.perfis_extras_cobrados;
  end if;
  slug_base := lower(regexp_replace(coalesce(nullif(pedido.slug_desejado,''), 'clinica-'||left(pedido.id::text,8)), '[^a-zA-Z0-9_-]', '', 'g'));
  if slug_base='' then slug_base:='clinica-'||left(pedido.id::text,8); end if;
  if exists(select 1 from public.clinicas where slug=slug_base) then
    raise exception 'Identificador público já utilizado. Ajuste o @ antes de preparar o espaço.';
  end if;
  insert into public.clinicas(nome,slug,tipo_publico,status,plano,limite_usuarios,status_financeiro,ultimo_pagamento_em,observacoes)
  values(coalesce(nullif(pedido.dados->>'nome_publico',''),pedido.clinica_nome),slug_base,
  case when pedido.tipo_operacao='petshop' then 'pet' else 'vet' end,
  'bloqueada',CASE WHEN pedido.plano_codigo LIKE '%-2026' THEN pedido.plano_codigo ELSE pedido.plano_nome END,limite_base,
  'em_dia',coalesce(pedido.pagamento_aprovado_em,now()),'Criada a partir da contratação '||pedido.id::text||'. '||case when pedido.valor_total=0 then 'Isenção promocional integral aprovada. ' else '' end||'Aguardando configuração e ativação.')
  returning id into novo;
  update public.oricse_contratacoes set clinica_criada_id=novo,status='em_configuracao',updated_at=now() where id=p_contratacao;
  return novo;
end $function$;
