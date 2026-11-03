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

  if extract(dow from p_data)::integer <> all(a.dias_semana) then
    return;
  end if;

  v_local_inicio:=p_data::timestamp+a.inicio;
  v_local_fim:=p_data::timestamp+a.fim;

  for v_slot in
    select generate_series(
      v_local_inicio,
      v_local_fim-make_interval(mins=>a.intervalo_min),
      make_interval(mins=>a.intervalo_min)
    )
  loop
    v_inicio:=v_slot at time zone a.timezone;
    v_fim:=(v_slot+make_interval(mins=>a.intervalo_min)) at time zone a.timezone;

    if v_inicio >= now()+make_interval(hours=>a.antecedencia_horas)
       and not exists(
         select 1
         from public.oricse_agendamentos_online ag
         where ag.agenda_id=a.id
           and (
             ag.estado in ('solicitado','reservado','confirmado')
             or (
               ag.estado='aguardando_pagamento'
               and ag.pagamento_expira_em > now()
             )
           )
           and tstzrange(ag.inicio,ag.fim,'[)') && tstzrange(v_inicio,v_fim,'[)')
       )
    then
      inicio:=v_inicio;
      fim:=v_fim;
      rotulo:=to_char(v_slot,'HH24:MI');
      return next;
    end if;
  end loop;
end;
$$;
