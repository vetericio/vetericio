alter table public.oricse_pagamentos drop constraint oricse_pagamentos_tipo_check,
  add constraint oricse_pagamentos_tipo_check check (tipo in ('plano_oricse','portal_tutor','agenda_portal','comanda_portal'));
alter table public.oricse_pagamentos drop constraint oricse_pagamentos_modalidade_check,
  add constraint oricse_pagamentos_modalidade_check check (modalidade in ('pix','cartao','boleto','online'));

alter table public.oricse_portal_comandas add column if not exists atendimento_registro_id uuid;
alter table public.oricse_portal_comandas add column if not exists agendamento_id uuid;
create unique index if not exists oricse_comanda_agendamento_unico
  on public.oricse_portal_comandas(clinica_id,agendamento_id) where agendamento_id is not null;

alter table public.oricse_animal_registros_extra add column if not exists dados_atendimento jsonb;

create or replace function public.oricse_confirmar_pagamento_portal(
  p_pagamento_id uuid,p_mp_payment_id text,p_forma text,p_liquido_centavos integer default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  p public.oricse_pagamentos; a public.oricse_agendamentos_online;
  c public.oricse_portal_comandas; liquido integer; saldo_novo numeric; pago_novo numeric;
  forma text := coalesce(nullif(p_forma,''),'Online');
begin
  select * into p from public.oricse_pagamentos where id=p_pagamento_id for update;
  if not found or p.clinica_id is null or p.tipo not in ('agenda_portal','comanda_portal') then
    raise exception 'Pagamento do portal não encontrado.';
  end if;
  if p.mp_payment_id is not null and p.mp_payment_id<>p_mp_payment_id then
    raise exception 'Pagamento já vinculado a outra transação.';
  end if;
  if p.status='estornado' or (p.status='aprovado' and p.bruto_centavos=0) or exists(select 1 from public.oricse_caixa_lancamentos
    where clinica_id=p.clinica_id and origem_tipo='pagamento_portal' and origem_id=p.id) then
    return jsonb_build_object('ok',true,'duplicado',true);
  end if;

  liquido:=greatest(0,coalesce(p_liquido_centavos,p.bruto_centavos));
  update public.oricse_pagamentos set status='aprovado',mp_payment_id=p_mp_payment_id,
    recebido_clinica_centavos=liquido,
    recebido_mp_centavos=greatest(0,bruto_centavos-liquido-coalesce(estimativa_oricse_centavos,0)),
    recebido_oricse_centavos=coalesce(estimativa_oricse_centavos,0),updated_at=now() where id=p.id;
  if p.bruto_centavos>0 then
    insert into public.oricse_caixa_lancamentos(clinica_id,setor,origem_tipo,origem_id,tipo,status,descricao,
      valor_centavos,forma_pagamento,detalhes)
    values(p.clinica_id,'Portal do Tutor','pagamento_portal',p.id,'entrada','pago',
      case when p.tipo='agenda_portal' then 'Agendamento pago no Portal do Tutor' else 'Comanda paga no Portal do Tutor' end,
      p.bruto_centavos,forma,jsonb_build_object('liquido_centavos',liquido,'origem_id',p.origem_id,'mp_payment_id',p_mp_payment_id));
  end if;

  if p.tipo='agenda_portal' then
    select * into a from public.oricse_agendamentos_online where id=p.origem_id and clinica_id=p.clinica_id for update;
    if found and a.estado='reservado' and a.pagamento_id=p.id and a.pagamento_expira_em>now() then
      update public.oricse_agendamentos_online set estado='confirmado',pagamento_confirmado_em=now(),pagamento_expira_em=null,
        dados=coalesce(dados,'{}')||jsonb_build_object('pagamento','Pago','pagamento_portal_id',p.id),updated_at=now()
      where id=a.id;
    elsif found and a.pagamento_id=p.id and a.estado not in ('confirmado') then
      update public.oricse_agendamentos_online set estado=case when estado='reservado' then 'expirado' else estado end,
        dados=coalesce(dados,'{}')||jsonb_build_object('pagamento','Pago','pagamento_requer_estorno',true,'pagamento_portal_id',p.id),updated_at=now() where id=a.id;
    end if;
  else
    select * into c from public.oricse_portal_comandas where id=p.origem_id and clinica_id=p.clinica_id for update;
    if found and not (coalesce(c.pagamentos,'[]') @> jsonb_build_array(jsonb_build_object('id',p.id))) then
      pago_novo:=coalesce(c.total_pago,0)+p.bruto_centavos::numeric/100;
      saldo_novo:=greatest(0,c.total-pago_novo);
      update public.oricse_portal_comandas set total_pago=pago_novo,saldo=saldo_novo,
        status=case when saldo_novo=0 then 'Finalizada' else c.status end,
        finalizada_em=case when saldo_novo=0 then coalesce(c.finalizada_em,now()) else c.finalizada_em end,
        pagamentos=coalesce(c.pagamentos,'[]')||jsonb_build_array(jsonb_build_object(
          'id',p.id,'valor',p.bruto_centavos::numeric/100,'formaPagamento',forma,'data',now(),'registradoPor','Portal do Tutor')),
        updated_at=now() where id=c.id;
    end if;
  end if;
  return jsonb_build_object('ok',true,'liquido_centavos',liquido);
end;
$$;
revoke all on function public.oricse_confirmar_pagamento_portal(uuid,text,text,integer) from public,anon,authenticated;
grant execute on function public.oricse_confirmar_pagamento_portal(uuid,text,text,integer) to service_role;

create or replace function public.oricse_finalizar_atendimento(
  p_clinica uuid,p_animal uuid,p_agendamento uuid,p_registro uuid,p_data date,p_detalhe text,p_dados jsonb,
  p_peso numeric,p_itens jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  a public.oricse_agendamentos_online; pet public.oricse_animais; c public.oricse_portal_comandas;
  p public.oricse_pagamentos; valor numeric; pago numeric:=0; pagamentos_anteriores jsonb:='[]';
  descricao text; numero_comanda bigint; id_comanda uuid; nome_autor text; crmv_autor text;
begin
  if (select auth.uid()) is null or not coalesce(public.oricse_usuario_pode_permissao(p_clinica,'consultorio.atendimentos'),false)
    or not exists(select 1 from public.clinicas where id=p_clinica and status='ativa' and excluido_em is null) then
    raise exception 'Sem acesso para concluir o atendimento.' using errcode='42501';
  end if;
  select * into pet from public.oricse_animais where clinica_id=p_clinica and id=p_animal;
  if not found then raise exception 'Animal não encontrado nesta clínica.'; end if;
  if p_agendamento is not null then
    select * into a from public.oricse_agendamentos_online where id=p_agendamento and clinica_id=p_clinica
      and animal_id=pet.id and tutor_id=pet.tutor_id and estado='confirmado' for update;
    if not found then raise exception 'O agendamento foi cancelado ou pertence a outra ficha.'; end if;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('oricse-atendimento:'||p_clinica::text,0));
  select * into c from public.oricse_portal_comandas where clinica_id=p_clinica and animal_id=p_animal
    and (atendimento_registro_id=p_registro or agendamento_id=p_agendamento);
  if found then return jsonb_build_object('comandaId',c.id,'numero',c.numero,'saldo',c.saldo); end if;
  if p_registro is null or p_data is null or length(btrim(coalesce(p_detalhe,'')))=0 or length(p_detalhe)>200000
    or jsonb_typeof(p_itens) is distinct from 'array' or jsonb_array_length(p_itens) not between 1 and 100
    or coalesce(p_peso,0)<0 or coalesce(p_peso,0)>10000 then raise exception 'Revise os dados do atendimento.'; end if;
  if exists(select 1 from jsonb_array_elements(p_itens) i where
    coalesce(i->>'descricao','')='' or coalesce((i->>'quantidade')::integer,0) not between 1 and 10000
    or coalesce((i->>'valorUnitario')::numeric,-1) not between 0 and 1000000) then raise exception 'Revise os itens da comanda.'; end if;
  select round(sum((i->>'quantidade')::integer*(i->>'valorUnitario')::numeric),2) into valor from jsonb_array_elements(p_itens) i;
  if a.pagamento_id is not null and a.pagamento_confirmado_em is not null then
    select * into p from public.oricse_pagamentos where id=a.pagamento_id and clinica_id=p_clinica and status='aprovado';
    if found then
      select greatest(0,p.bruto_centavos-coalesce(sum(e.valor_centavos) filter(where e.status='confirmado'),0))::numeric/100,
        coalesce(max(l.forma_pagamento),'Online') into pago,descricao
      from public.oricse_caixa_lancamentos l left join public.oricse_caixa_estornos e on e.lancamento_id=l.id
      where l.clinica_id=p_clinica and l.origem_tipo='pagamento_portal' and l.origem_id=p.id;
      if pago>0 then
        pagamentos_anteriores:=jsonb_build_array(jsonb_build_object('id',p.id,'valor',pago,'formaPagamento',descricao,
          'data',a.pagamento_confirmado_em,'registradoPor','Portal do Tutor'));
      end if;
    end if;
  end if;
  select coalesce(max(numero),0)+1 into numero_comanda from public.oricse_portal_comandas where clinica_id=p_clinica;
  select nullif(btrim(nome_completo),''),
    case when nullif(btrim(crmv),'') is not null and nullif(btrim(crmv_uf),'') is not null
      then 'CRMV-'||upper(btrim(crmv_uf))||' '||btrim(crmv) end
  into nome_autor,crmv_autor from public.oricse_pessoas where user_id=(select auth.uid());
  if nome_autor is null then
    select coalesce(nullif(username,''),email) into nome_autor from public.app_users where user_id=(select auth.uid());
  end if;
  insert into public.oricse_animal_registros_extra(id,clinica_id,animal_id,tipo,titulo,detalhe,data,dados_atendimento)
  values(p_registro,p_clinica,p_animal,'Registros clínicos','Consulta',p_detalhe,p_data,
    jsonb_build_object('consulta',p_dados,'autorId',(select auth.uid()),'autorNome',nome_autor,'autorCrmv',crmv_autor,'agendamentoId',p_agendamento));
  if p_peso is not null and p_peso is distinct from pet.peso_kg then
    insert into public.oricse_animal_pesos(clinica_id,animal_id,peso,data) values(p_clinica,p_animal,p_peso,p_data);
    update public.oricse_animais set peso_kg=p_peso where id=p_animal and clinica_id=p_clinica;
  end if;
  id_comanda:=gen_random_uuid();
  insert into public.oricse_portal_comandas(id,clinica_id,animal_id,tutor_id,numero,status,origem,
    aberta_em,finalizada_em,itens,pagamentos,total,total_pago,saldo,visivel_tutor,agendamento_id,atendimento_registro_id)
  values(id_comanda,p_clinica,pet.id,pet.tutor_id,numero_comanda,case when pago>=valor then 'Finalizada' else 'Aberta' end,
    'Consultório',now(),case when pago>=valor then now() end,p_itens,pagamentos_anteriores,valor,pago,greatest(0,valor-pago),true,p_agendamento,p_registro);
  if a.id is not null then
    update public.oricse_agendamentos_online set dados=coalesce(dados,'{}')||jsonb_build_object(
      'status_clinico','Finalizado','comanda_id',id_comanda,'registro_id',p_registro),updated_at=now() where id=a.id;
  end if;
  return jsonb_build_object('comandaId',id_comanda,'numero',numero_comanda,'saldo',greatest(0,valor-pago));
end;
$$;
revoke all on function public.oricse_finalizar_atendimento(uuid,uuid,uuid,uuid,date,text,jsonb,numeric,jsonb) from public,anon,authenticated;
grant execute on function public.oricse_finalizar_atendimento(uuid,uuid,uuid,uuid,date,text,jsonb,numeric,jsonb) to authenticated;

create or replace function public.oricse_receber_comanda_atendimento(
  p_comanda uuid,p_pagamento uuid,p_centavos integer,p_forma text
) returns void language plpgsql security definer set search_path='' as $$
declare c public.oricse_portal_comandas; restante numeric; autor text;
begin
  select * into c from public.oricse_portal_comandas where id=p_comanda and atendimento_registro_id is not null for update;
  if not found or not public.oricse_caixa_pode_operar(c.clinica_id) then raise exception 'Comanda indisponível para pagamento.' using errcode='42501'; end if;
  if exists(select 1 from public.oricse_caixa_lancamentos where clinica_id=c.clinica_id and origem_tipo='comanda_atendimento'
    and origem_id=p_pagamento and detalhes->>'comanda_id'=p_comanda::text) then return; end if;
  if c.status<>'Aberta' or p_pagamento is null or p_centavos is null or p_centavos<=0 or p_centavos>c.saldo*100
    or length(btrim(coalesce(p_forma,''))) not between 1 and 80 then raise exception 'Informe uma forma e um valor dentro do saldo da comanda.'; end if;
  restante:=greatest(0,c.saldo-p_centavos::numeric/100);
  select coalesce(nullif(username,''),email) into autor from public.app_users where user_id=(select auth.uid());
  insert into public.oricse_caixa_lancamentos(clinica_id,setor,origem_tipo,origem_id,tipo,status,descricao,valor_centavos,forma_pagamento,
    registrado_por,detalhes)
  values(c.clinica_id,'Consultas','comanda_atendimento',p_pagamento,'entrada','pago','Pagamento da comanda #'||c.numero,p_centavos,p_forma,
    (select auth.uid()),jsonb_build_object('comanda_id',c.id));
  update public.oricse_portal_comandas set total_pago=total_pago+p_centavos::numeric/100,saldo=restante,
    status=case when restante=0 then 'Finalizada' else 'Aberta' end,
    finalizada_em=case when restante=0 then now() end,pagamentos=pagamentos||jsonb_build_array(jsonb_build_object(
      'id',p_pagamento,'valor',p_centavos::numeric/100,'formaPagamento',p_forma,'data',now(),'registradoPor',autor)),updated_at=now()
  where id=c.id;
end;
$$;
revoke all on function public.oricse_receber_comanda_atendimento(uuid,uuid,integer,text) from public,anon,authenticated;
grant execute on function public.oricse_receber_comanda_atendimento(uuid,uuid,integer,text) to authenticated;

create or replace function public.oricse_refletir_estorno_na_comanda()
returns trigger language plpgsql security definer set search_path='' as $$
declare l public.oricse_caixa_lancamentos; p public.oricse_pagamentos; c public.oricse_portal_comandas;
  item jsonb; pagamentos_atualizados jsonb; total_estornado numeric; valor_atual numeric; saldo_novo numeric; comanda_id uuid;
begin
  if new.status<>'confirmado' or old.status='confirmado' then return new; end if;
  select * into l from public.oricse_caixa_lancamentos where id=new.lancamento_id and clinica_id=new.clinica_id;
  if l.origem_tipo='pagamento_portal' then
    select * into p from public.oricse_pagamentos where id=l.origem_id and clinica_id=l.clinica_id;
    if p.tipo='comanda_portal' then comanda_id:=p.origem_id;
    elsif p.tipo='agenda_portal' then
      select id into comanda_id from public.oricse_portal_comandas where clinica_id=l.clinica_id and agendamento_id=p.origem_id;
      select sum(valor_centavos) into total_estornado from public.oricse_caixa_estornos where lancamento_id=l.id and status='confirmado';
      update public.oricse_agendamentos_online set dados=coalesce(dados,'{}')||jsonb_build_object(
        'pagamento',case when total_estornado>=l.valor_centavos then 'Estornado' else 'Pago' end,
        'pagamento_requer_estorno',estado in ('cancelado','expirado') and total_estornado<l.valor_centavos,
        'estornado_centavos',total_estornado),updated_at=now() where id=p.origem_id and clinica_id=l.clinica_id;
    end if;
  elsif l.origem_tipo='comanda_atendimento' then comanda_id:=(l.detalhes->>'comanda_id')::uuid;
  end if;
  select * into c from public.oricse_portal_comandas where id=comanda_id and clinica_id=l.clinica_id for update;
  if found then
    select value into item from jsonb_array_elements(c.pagamentos) where value->>'id'=l.origem_id::text;
    if item is not null then
      valor_atual:=greatest(0,(item->>'valor')::numeric-new.valor_centavos::numeric/100);
      select jsonb_agg(case when value->>'id'=l.origem_id::text
        then value||jsonb_build_object('valor',valor_atual,'estornado',coalesce((value->>'estornado')::numeric,0)+new.valor_centavos::numeric/100)
        else value end order by ord) into pagamentos_atualizados from jsonb_array_elements(c.pagamentos) with ordinality as e(value,ord);
      saldo_novo:=greatest(0,c.total-greatest(0,c.total_pago-((item->>'valor')::numeric-valor_atual)));
      update public.oricse_portal_comandas set pagamentos=pagamentos_atualizados,total_pago=greatest(0,total_pago-((item->>'valor')::numeric-valor_atual)),
        saldo=saldo_novo,status=case when saldo_novo>0 then 'Aberta' else status end,
        finalizada_em=case when saldo_novo>0 then null else finalizada_em end,updated_at=now() where id=c.id;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.oricse_refletir_estorno_na_comanda() from public,anon,authenticated;
drop trigger if exists oricse_refletir_estorno_comanda on public.oricse_caixa_estornos;
create trigger oricse_refletir_estorno_comanda after update of status on public.oricse_caixa_estornos
  for each row execute function public.oricse_refletir_estorno_na_comanda();

-- The legacy mirror may still update items and in-person payments for older
-- orders. Preserve each provider payment as recorded by the database.
create or replace function public.oricse_preservar_comanda_canonica()
returns trigger language plpgsql set search_path='' as $$
declare recebimentos jsonb; valor_pago numeric;
begin
  if (old.atendimento_registro_id is not null or new.atendimento_registro_id is not null or new.agendamento_id is not null)
    and current_user not in ('postgres','service_role') then
    raise exception 'Altere esta comanda pelo fluxo de atendimento.';
  end if;
  if old.atendimento_registro_id is null and current_user not in ('postgres','service_role') then
    select coalesce(jsonb_agg(x),'[]') into recebimentos from jsonb_array_elements(old.pagamentos) x
      where x->>'registradoPor'='Portal do Tutor' or exists(
        select 1 from public.oricse_pagamentos p where p.id::text=x->>'id' and p.clinica_id=old.clinica_id);
    if jsonb_array_length(recebimentos)>0 then
      select coalesce(jsonb_agg(x),'[]') into new.pagamentos from jsonb_array_elements(new.pagamentos) x
        where not exists(select 1 from jsonb_array_elements(recebimentos) y where y->>'id'=x->>'id');
      new.pagamentos:=new.pagamentos||recebimentos;
      select coalesce(sum((x->>'valor')::numeric),0) into valor_pago from jsonb_array_elements(new.pagamentos) x;
      new.total_pago:=valor_pago; new.saldo:=greatest(0,new.total-valor_pago);
      if new.saldo=0 then new.status:='Finalizada'; new.finalizada_em:=coalesce(old.finalizada_em,now()); end if;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists oricse_preservar_comanda_canonica on public.oricse_portal_comandas;
create trigger oricse_preservar_comanda_canonica before update on public.oricse_portal_comandas
  for each row execute function public.oricse_preservar_comanda_canonica();

CREATE OR REPLACE FUNCTION public.oricse_portal_meu_contexto(p_slug text)
 RETURNS TABLE(clinica_id uuid, clinica_nome text, clinica_slug text, clinica_logo_url text, tutor_id uuid, tutor_nome text, tutor_telefone text, tutor_email text, usuario text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select c.id,c.nome,c.slug,c.logo_url,t.id,t.nome,t.telefone,t.email,pt.usuario
  from public.oricse_portal_tutores pt
  join public.clinicas c on c.id=pt.clinica_id and c.status='ativa'
  join public.tutores t on t.id=pt.tutor_id and t.clinica_id=pt.clinica_id
  where pt.auth_user_id=(select auth.uid())
    and pt.ativo=true and c.slug=p_slug and c.excluido_em is null
    and public.oricse_clinica_tem_funcionalidade(pt.clinica_id,'portal_tutor.acesso')
  limit 1;
$function$;

CREATE OR REPLACE FUNCTION public.oricse_portal_agendas(p_slug text)
 RETURNS TABLE(id uuid, nome text, responsavel text, inicio time without time zone, fim time without time zone, dias_semana integer[], intervalo_min integer, modalidade text, antecedencia_horas integer, timezone text, tipo text, cor text, pagamento_modo_valor text, pagamento_valor numeric, pagamento_descricao text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with ident as (select * from public.oricse_portal_meu_contexto(p_slug))
  select a.id,a.nome,a.responsavel,a.inicio,a.fim,a.dias_semana,a.intervalo_min,a.modalidade,
    a.antecedencia_horas,a.timezone,a.tipo,a.cor,a.pagamento_modo_valor,a.pagamento_valor,a.pagamento_descricao
  from public.oricse_agendas_online a,ident i
  where a.clinica_id=i.clinica_id and a.portal_ativo=true
    and public.oricse_clinica_tem_funcionalidade(i.clinica_id,'portal_tutor.agendamento_online')
  order by a.nome;
$function$;

CREATE OR REPLACE FUNCTION public.oricse_portal_reservar_pagamento_agenda(p_agenda_id uuid, p_animal_id uuid, p_inicio timestamp with time zone, p_observacoes text DEFAULT NULL::text)
 RETURNS TABLE(agendamento_id uuid, valor_centavos integer, descricao text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  a public.oricse_agendas_online;
  i record;
  an public.oricse_animais;
  v_fim timestamptz;
  v_id uuid;
  v_minutos integer;
  v_valor integer;
begin
  select * into a from public.oricse_agendas_online
    where id=p_agenda_id and portal_ativo=true
      and public.oricse_portal_pode_acessar_clinica(clinica_id) for update;
  if not found or a.modalidade <> 'pagamento' then raise exception 'Esta agenda não exige pagamento online.' using errcode='22023'; end if;
  select pt.clinica_id,pt.tutor_id into i from public.oricse_portal_tutores pt
    where pt.clinica_id=a.clinica_id and pt.auth_user_id=(select auth.uid()) and pt.ativo;
  if not found or not public.oricse_portal_pode_acessar_clinica(a.clinica_id) then
    raise exception 'Acesso de tutor inválido.' using errcode='42501';
  end if;
  if not public.oricse_clinica_tem_funcionalidade(i.clinica_id,'portal_tutor.agendamento_online') then
    raise exception 'Agendamento online indisponível no plano atual.' using errcode='42501';
  end if;
  if coalesce(a.pagamento_valor,0) <= 0 then raise exception 'A clínica ainda não configurou o valor deste agendamento.' using errcode='22023'; end if;
  select * into an from public.oricse_animais
    where id=p_animal_id and clinica_id=i.clinica_id and tutor_id=i.tutor_id;
  if not found then raise exception 'Animal não pertence a este tutor.' using errcode='42501'; end if;
  if not public.oricse_portal_grade_liberada(a.portal_regra_dias,a.dias_semana,a.inicio,a.fim,a.intervalo_min,a.timezone,a.portal_datas_horarios,p_inicio)
    then raise exception 'Horário não publicado pela clínica.' using errcode='22023';end if;
  if p_inicio<now()+make_interval(hours=>a.antecedencia_horas)
    then raise exception 'Horário indisponível.' using errcode='22023';end if;
  v_fim:=p_inicio+make_interval(mins=>a.intervalo_min);
  v_valor:=round(a.pagamento_valor*100)::integer;
  update public.oricse_agendamentos_online set estado='expirado',updated_at=now()
    where agenda_id=a.id and estado='reservado' and pagamento_expira_em<=now()
      and tstzrange(inicio,fim,'[)') && tstzrange(p_inicio,v_fim,'[)');
  insert into public.oricse_agendamentos_online(
    clinica_id,agenda_id,tutor_auth_id,tutor_id,animal_id,animal_referencia,inicio,fim,estado,tipo,
    observacoes,origem,dados,pagamento_expira_em,pagamento_valor_centavos
  ) values (
    i.clinica_id,a.id,(select auth.uid()),i.tutor_id,an.id,an.nome,p_inicio,v_fim,'reservado',
    a.tipo,left(coalesce(p_observacoes,''),1000),'portal_tutor',
    jsonb_build_object('status_clinico','Agendado','pagamento','Pendente','pagamento_origem','portal_tutor'),
    now()+interval '15 minutes',v_valor
  ) returning id into v_id;

  agendamento_id:=v_id;
  valor_centavos:=v_valor;
  descricao:=coalesce(nullif(a.pagamento_descricao,''),'Agendamento: '||a.nome);
  return next;
exception when exclusion_violation then
  raise exception 'Este horário acabou de ser ocupado. Escolha outro.' using errcode='23P01';
end;
$function$;

CREATE OR REPLACE FUNCTION public.oricse_portal_horarios_disponiveis(p_agenda_id uuid, p_data date)
 RETURNS TABLE(inicio timestamp with time zone, fim timestamp with time zone, rotulo text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  a public.oricse_agendas_online%rowtype;
  v_local_inicio timestamp;
  v_local_fim timestamp;
  v_slot timestamp;
  v_inicio timestamptz;
  v_fim timestamptz;
begin
  select * into a
  from public.oricse_agendas_online
  where id=p_agenda_id and portal_ativo=true;

  if not found or not public.oricse_portal_pode_acessar_clinica(a.clinica_id) then
    raise exception 'Agenda indisponível.' using errcode='P0002';
  end if;

  if not public.oricse_clinica_tem_funcionalidade(a.clinica_id,'portal_tutor.agendamento_online') then
    raise exception 'Agendamento online indisponível no plano atual.' using errcode='42501';
  end if;


  if coalesce(a.portal_regra_dias,'semanal')='semanal'
     and not (extract(dow from p_data)::integer = any(a.dias_semana)) then return;end if;
  if a.portal_regra_dias='pares' and mod(extract(day from p_data)::integer,2)<>0 then return;end if;
  v_local_inicio:=p_data::timestamp+a.inicio;
  v_local_fim:=p_data::timestamp+a.fim;
  for v_slot in
    select slot from (
      select generate_series(v_local_inicio,v_local_fim-make_interval(mins=>a.intervalo_min),
        make_interval(mins=>a.intervalo_min)) as slot
      where coalesce(a.portal_regra_dias,'semanal') <> 'datas'
      union all
      select p_data::timestamp+(h.value::time) as slot
      from jsonb_array_elements_text(coalesce(a.portal_datas_horarios->(p_data::text),'[]'::jsonb)) as h(value)
      where a.portal_regra_dias='datas' and h.value ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    ) s order by slot
  loop
    v_inicio:=v_slot at time zone a.timezone;
    v_fim:=(v_slot+make_interval(mins=>a.intervalo_min)) at time zone a.timezone;
    if not public.oricse_portal_grade_liberada(a.portal_regra_dias,a.dias_semana,a.inicio,a.fim,
      a.intervalo_min,a.timezone,a.portal_datas_horarios,v_inicio) then continue;end if;
    if v_inicio >= now()+make_interval(hours=>a.antecedencia_horas)
       and not exists(
         select 1 from public.oricse_agendamentos_online ag
          where ag.agenda_id=a.id
           and (ag.estado in ('solicitado','confirmado')
             or (ag.estado='reservado' and ag.pagamento_expira_em>now()))
           and tstzrange(ag.inicio,ag.fim,'[)') && tstzrange(v_inicio,v_fim,'[)')
       ) then
      inicio:=v_inicio;fim:=v_fim;rotulo:=to_char(v_slot,'HH24:MI');return next;
    end if;
  end loop;
end;
$function$;

CREATE OR REPLACE FUNCTION public.oricse_animal_historico(p_animal uuid, p_tipo text DEFAULT NULL::text, p_titulo text DEFAULT NULL::text, p_detalhe text DEFAULT NULL::text, p_data date DEFAULT NULL::date, p_peso numeric DEFAULT NULL::numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ declare cid uuid; begin select clinica_id into cid from public.oricse_animais where id=p_animal;if cid is null then raise exception 'Animal não encontrado';end if;if auth.uid() is null or (not exists(select 1 from public.clinica_usuarios where user_id=auth.uid() and clinica_id=cid and ativo=true) and not exists(select 1 from public.app_users where user_id=auth.uid() and role='admin')) then raise exception 'Sem acesso';end if;if p_peso is not null then insert into public.oricse_animal_pesos(clinica_id,animal_id,peso,data) values(cid,p_animal,p_peso,coalesce(p_data,current_date));update public.oricse_animais set peso_kg=p_peso where id=p_animal and clinica_id=cid;end if;if p_tipo is not null then if length(trim(coalesce(p_titulo,'')))<2 then raise exception 'Título obrigatório';end if;insert into public.oricse_animal_registros_extra(clinica_id,animal_id,tipo,titulo,detalhe,data) values(cid,p_animal,p_tipo,trim(p_titulo),coalesce(p_detalhe,''),coalesce(p_data,current_date));end if;return jsonb_build_object('pesos',coalesce((select jsonb_agg(jsonb_build_object('id',id,'animalId',animal_id,'peso',peso,'data',data,'criadoEm',created_at) order by data desc,created_at desc) from public.oricse_animal_pesos where clinica_id=cid and animal_id=p_animal),'[]'::jsonb),'registros',coalesce((select jsonb_agg(jsonb_build_object('id',id,'animalId',animal_id,'tipo',tipo,'titulo',titulo,'detalhe',detalhe,'data',data,'criadoEm',created_at,'autorId',dados_atendimento->>'autorId','autorNome',dados_atendimento->>'autorNome','autorCrmv',dados_atendimento->>'autorCrmv','dados',dados_atendimento->'consulta','subtipo',case when dados_atendimento is not null then 'Consulta' end) order by data desc,created_at desc) from public.oricse_animal_registros_extra where clinica_id=cid and animal_id=p_animal),'[]'::jsonb));end $function$;

revoke all on function public.oricse_portal_meu_contexto(text),public.oricse_portal_agendas(text) from public,anon,authenticated;
grant execute on function public.oricse_portal_meu_contexto(text),public.oricse_portal_agendas(text) to authenticated;
create policy oricse_comanda_atendimento_equipe_ler on public.oricse_portal_comandas
  for select to authenticated using (
    atendimento_registro_id is not null and (
      public.oricse_usuario_pode_permissao(clinica_id,'consultorio.atendimentos')
      or public.oricse_usuario_pode_permissao(clinica_id,'caixa.financeiro.visualizar')
    )
  );

drop policy if exists oricse_portal_comandas_equipe_gerenciar on public.oricse_portal_comandas;
create policy oricse_portal_comandas_equipe_gerenciar on public.oricse_portal_comandas
  for all to authenticated
  using (atendimento_registro_id is null and public.oricse_usuario_pode_permissao(clinica_id,'caixa.comandas'))
  with check (atendimento_registro_id is null and agendamento_id is null
    and public.oricse_usuario_pode_permissao(clinica_id,'caixa.comandas'));
