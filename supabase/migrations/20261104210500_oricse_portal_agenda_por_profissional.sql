-- Disponibilidade por profissional: semanal, dias pares ou datas/horários explícitos.
-- As agendas existentes continuam no modo semanal e o estado portal_ativo permanece inalterado.
alter table public.oricse_agendas_online add column if not exists portal_regra_dias text not null default 'semanal';
alter table public.oricse_agendas_online add column if not exists portal_datas_horarios jsonb not null default '{}'::jsonb;
alter table public.oricse_agendas_online drop constraint if exists oricse_portal_regra_dias_check;
alter table public.oricse_agendas_online add constraint oricse_portal_regra_dias_check check (portal_regra_dias in ('semanal','pares','datas'));
create or replace function public.oricse_portal_grade_liberada(
 p_regra text,p_dias integer[],p_inicio time,p_fim time,p_intervalo integer,
 p_timezone text,p_datas jsonb,p_momento timestamptz
) returns boolean language plpgsql stable set search_path='' as $grade$
declare
 v_local timestamp:=p_momento at time zone coalesce(p_timezone,'America/Sao_Paulo');
 v_regra text:=coalesce(p_regra,'semanal');
 v_minutos integer;
begin
 if v_regra='datas' then
   return coalesce((coalesce(p_datas,'{}'::jsonb)->to_char(v_local,'YYYY-MM-DD')) ? to_char(v_local,'HH24:MI'),false);
 end if;
 if v_regra='pares' then
   if mod(extract(day from v_local)::integer,2)<>0 then return false;end if;
 elsif v_regra='semanal' then
   if not (extract(dow from v_local)::integer = any(p_dias)) then return false;end if;
 else return false;end if;
 if p_intervalo is null or p_intervalo<=0 or v_local::time<p_inicio
    or (v_local::time+make_interval(mins=>p_intervalo))>p_fim then return false;end if;
 v_minutos:=round(extract(epoch from (v_local::time-p_inicio))/60)::integer;
 return mod(v_minutos,p_intervalo)=0;
end;
$grade$;
revoke all on function public.oricse_portal_grade_liberada(text,integer[],time,time,integer,text,jsonb,timestamptz) from public,anon;
grant execute on function public.oricse_portal_grade_liberada(text,integer[],time,time,integer,text,jsonb,timestamptz) to authenticated;

-- Impede que um horário com pagamento do Portal do Tutor em andamento seja exibido
-- como disponível até a expiração da reserva.
create or replace function public.oricse_portal_horarios_disponiveis(p_agenda_id uuid,p_data date)
returns table(inicio timestamptz,fim timestamptz,rotulo text)
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  a public.oricse_agendas_online%rowtype;
  i record;
  v_local_inicio timestamp;
  v_local_fim timestamp;
  v_slot timestamp;
  v_inicio timestamptz;
  v_fim timestamptz;
begin
  select * into i from public.oricse_portal_identidade_atual();
  if i.clinica_id is null then
    raise exception 'Acesso de tutor inválido.' using errcode='42501';
  end if;

  select * into a
  from public.oricse_agendas_online
  where id=p_agenda_id and clinica_id=i.clinica_id and portal_ativo=true;

  if not found then
    raise exception 'Agenda indisponível.' using errcode='P0002';
  end if;

  if not public.oricse_clinica_tem_funcionalidade(i.clinica_id,'portal_tutor.agendamento_online') then
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
      where a.portal_regra_dias='datas' and h.value ~ '^([01][0-9]|2[0-3]):[0-5][0-9]
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
           and (ag.estado in ('solicitado','reservado','confirmado')
             or (ag.estado='aguardando_pagamento' and ag.pagamento_expira_em>now()))
           and tstzrange(ag.inicio,ag.fim,'[)') && tstzrange(v_inicio,v_fim,'[)')
       ) then
      inicio:=v_inicio;fim:=v_fim;rotulo:=to_char(v_slot,'HH24:MI');return next;
    end if;
  end loop;
end;
$$;

create or replace function public.oricse_portal_criar_agendamento(p_agenda_id uuid,p_animal_id uuid,p_inicio timestamptz,p_observacoes text default null)
returns table(agendamento_id uuid,estado text)
language plpgsql
security definer
set search_path=''
as $$
declare
  a public.oricse_agendas_online%rowtype;
  i record;
  an public.oricse_animais%rowtype;
  v_local timestamp;
  v_fim timestamptz;
  v_estado text;
  v_id uuid;
  v_minutos integer;
begin
  select * into i from public.oricse_portal_identidade_atual();
  if i.clinica_id is null then raise exception 'Acesso de tutor inválido.' using errcode='42501'; end if;
  select * into a from public.oricse_agendas_online where id=p_agenda_id and clinica_id=i.clinica_id and portal_ativo=true for share;
  if not found then raise exception 'Agenda indisponível.' using errcode='P0002'; end if;
  if not public.oricse_clinica_tem_funcionalidade(i.clinica_id,'portal_tutor.agendamento_online') then raise exception 'Agendamento online indisponível no plano atual.' using errcode='42501'; end if;
  if a.modalidade='pagamento' then raise exception 'Pagamento online ainda não foi liberado para esta agenda.' using errcode='42501'; end if;
  select * into an from public.oricse_animais where id=p_animal_id and clinica_id=i.clinica_id and tutor_id=i.tutor_id;
  if not found then raise exception 'Animal não pertence a este tutor.' using errcode='42501'; end if;
  v_local:=p_inicio at time zone a.timezone;
  if not public.oricse_portal_grade_liberada(a.portal_regra_dias,a.dias_semana,a.inicio,a.fim,a.intervalo_min,a.timezone,a.portal_datas_horarios,p_inicio)
    then raise exception 'Horário não publicado pela clínica.' using errcode='22023';end if;
  if p_inicio<now()+make_interval(hours=>a.antecedencia_horas) then raise exception 'Horário abaixo da antecedência mínima.' using errcode='22023'; end if;
  v_fim:=p_inicio+make_interval(mins=>a.intervalo_min);
  v_estado:=case when a.modalidade='livre' then 'confirmado' else 'solicitado' end;
  insert into public.oricse_agendamentos_online(clinica_id,agenda_id,tutor_auth_id,tutor_id,animal_id,animal_referencia,inicio,fim,estado,tipo,observacoes,origem)
  values(i.clinica_id,a.id,(select auth.uid()),i.tutor_id,an.id,an.nome,p_inicio,v_fim,v_estado,a.tipo,left(coalesce(p_observacoes,''),1000),'portal_tutor')
  returning id into v_id;
  update public.oricse_portal_tutores set ultimo_acesso_em=now(),updated_at=now() where auth_user_id=(select auth.uid());
  agendamento_id:=v_id; estado:=v_estado; return next;
exception when exclusion_violation then
  raise exception 'Este horário acabou de ser ocupado. Escolha outro.' using errcode='23P01';
end;
$$;


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
  if not public.oricse_portal_grade_liberada(a.portal_regra_dias,a.dias_semana,a.inicio,a.fim,a.intervalo_min,a.timezone,a.portal_datas_horarios,p_inicio)
    then raise exception 'Horário não publicado pela clínica.' using errcode='22023';end if;
  if p_inicio<now()+make_interval(hours=>a.antecedencia_horas)
    then raise exception 'Horário indisponível.' using errcode='22023';end if;
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
           and (ag.estado in ('solicitado','reservado','confirmado')
             or (ag.estado='aguardando_pagamento' and ag.pagamento_expira_em>now()))
           and tstzrange(ag.inicio,ag.fim,'[)') && tstzrange(v_inicio,v_fim,'[)')
       ) then
      inicio:=v_inicio;fim:=v_fim;rotulo:=to_char(v_slot,'HH24:MI');return next;
    end if;
  end loop;
end;
$$;

create or replace function public.oricse_portal_criar_agendamento(p_agenda_id uuid,p_animal_id uuid,p_inicio timestamptz,p_observacoes text default null)
returns table(agendamento_id uuid,estado text)
language plpgsql
security definer
set search_path=''
as $$
declare
  a public.oricse_agendas_online%rowtype;
  i record;
  an public.oricse_animais%rowtype;
  v_local timestamp;
  v_fim timestamptz;
  v_estado text;
  v_id uuid;
  v_minutos integer;
begin
  select * into i from public.oricse_portal_identidade_atual();
  if i.clinica_id is null then raise exception 'Acesso de tutor inválido.' using errcode='42501'; end if;
  select * into a from public.oricse_agendas_online where id=p_agenda_id and clinica_id=i.clinica_id and portal_ativo=true for share;
  if not found then raise exception 'Agenda indisponível.' using errcode='P0002'; end if;
  if not public.oricse_clinica_tem_funcionalidade(i.clinica_id,'portal_tutor.agendamento_online') then raise exception 'Agendamento online indisponível no plano atual.' using errcode='42501'; end if;
  if a.modalidade='pagamento' then raise exception 'Pagamento online ainda não foi liberado para esta agenda.' using errcode='42501'; end if;
  select * into an from public.oricse_animais where id=p_animal_id and clinica_id=i.clinica_id and tutor_id=i.tutor_id;
  if not found then raise exception 'Animal não pertence a este tutor.' using errcode='42501'; end if;
  v_local:=p_inicio at time zone a.timezone;
  if not public.oricse_portal_grade_liberada(a.portal_regra_dias,a.dias_semana,a.inicio,a.fim,a.intervalo_min,a.timezone,a.portal_datas_horarios,p_inicio)
    then raise exception 'Horário não publicado pela clínica.' using errcode='22023';end if;
  if p_inicio<now()+make_interval(hours=>a.antecedencia_horas) then raise exception 'Horário abaixo da antecedência mínima.' using errcode='22023'; end if;
  v_fim:=p_inicio+make_interval(mins=>a.intervalo_min);
  v_estado:=case when a.modalidade='livre' then 'confirmado' else 'solicitado' end;
  insert into public.oricse_agendamentos_online(clinica_id,agenda_id,tutor_auth_id,tutor_id,animal_id,animal_referencia,inicio,fim,estado,tipo,observacoes,origem)
  values(i.clinica_id,a.id,(select auth.uid()),i.tutor_id,an.id,an.nome,p_inicio,v_fim,v_estado,a.tipo,left(coalesce(p_observacoes,''),1000),'portal_tutor')
  returning id into v_id;
  update public.oricse_portal_tutores set ultimo_acesso_em=now(),updated_at=now() where auth_user_id=(select auth.uid());
  agendamento_id:=v_id; estado:=v_estado; return next;
exception when exclusion_violation then
  raise exception 'Este horário acabou de ser ocupado. Escolha outro.' using errcode='23P01';
end;
$$;


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
  if not public.oricse_portal_grade_liberada(a.portal_regra_dias,a.dias_semana,a.inicio,a.fim,a.intervalo_min,a.timezone,a.portal_datas_horarios,p_inicio)
    then raise exception 'Horário não publicado pela clínica.' using errcode='22023';end if;
  if p_inicio<now()+make_interval(hours=>a.antecedencia_horas)
    then raise exception 'Horário indisponível.' using errcode='22023';end if;
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
