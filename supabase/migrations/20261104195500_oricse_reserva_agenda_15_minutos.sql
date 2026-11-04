-- Reserva exclusiva do horário por 15 minutos enquanto o tutor conclui o pagamento.
-- Nova migração para atualizar bancos que já aplicaram a função anterior de 20 minutos.
create or replace function public.oricse_portal_reservar_pagamento_agenda(
  p_agenda_id uuid,p_animal_id uuid,p_inicio timestamptz,p_observacoes text default null
)
returns table(agendamento_id uuid,valor_centavos integer,descricao text)
language plpgsql
security definer
set search_path=''
as $$
declare
  a public.oricse_agendas_online;
  i record;
  an public.oricse_animais;
  v_local timestamp;
  v_fim timestamptz;
  v_id uuid;
  v_minutos integer;
  v_valor integer;
begin
  select * into i from public.oricse_portal_identidade_atual();
  if i.clinica_id is null then raise exception 'Acesso de tutor inválido.' using errcode='42501'; end if;
  select * into a from public.oricse_agendas_online
    where id=p_agenda_id and clinica_id=i.clinica_id and portal_ativo=true for share;
  if not found or a.modalidade <> 'pagamento' then raise exception 'Esta agenda não exige pagamento online.' using errcode='22023'; end if;
  if not public.oricse_clinica_tem_funcionalidade(i.clinica_id,'portal_tutor.agendamento_online') then
    raise exception 'Agendamento online indisponível no plano atual.' using errcode='42501';
  end if;
  if coalesce(a.pagamento_valor,0) <= 0 then raise exception 'A clínica ainda não configurou o valor deste agendamento.' using errcode='22023'; end if;
  select * into an from public.oricse_animais
    where id=p_animal_id and clinica_id=i.clinica_id and tutor_id=i.tutor_id;
  if not found then raise exception 'Animal não pertence a este tutor.' using errcode='42501'; end if;
  v_local:=p_inicio at time zone a.timezone;
  if extract(dow from v_local)::integer <> all(a.dias_semana)
    or v_local::time<a.inicio
    or (v_local::time+make_interval(mins=>a.intervalo_min))>a.fim then
    raise exception 'Horário fora da agenda.' using errcode='22023';
  end if;
  v_minutos:=extract(epoch from (v_local::time-a.inicio))/60;
  if mod(v_minutos,a.intervalo_min)<>0 or p_inicio<now()+make_interval(hours=>a.antecedencia_horas) then
    raise exception 'Horário indisponível.' using errcode='22023';
  end if;
  v_fim:=p_inicio+make_interval(mins=>a.intervalo_min);
  v_valor:=round(a.pagamento_valor*100)::integer;
  insert into public.oricse_agendamentos_online(
    clinica_id,agenda_id,tutor_auth_id,tutor_id,animal_id,animal_referencia,inicio,fim,estado,tipo,
    observacoes,origem,dados,pagamento_expira_em,pagamento_valor_centavos
  ) values (
    i.clinica_id,a.id,(select auth.uid()),i.tutor_id,an.id,an.nome,p_inicio,v_fim,'aguardando_pagamento',
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
$$;
