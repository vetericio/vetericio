create or replace function public.oricse_clinica_tem_funcionalidade(p_clinica_id uuid,p_codigo text)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select exists(select 1 from public.clinicas c where c.id=p_clinica_id and c.status='ativa')
    and coalesce(
      (
        select e.permitido
        from public.oricse_clinica_funcionalidade_excecoes e
        join public.oricse_funcionalidades f on f.codigo=e.funcionalidade_codigo and f.ativo=true
        where e.clinica_id=p_clinica_id
          and e.funcionalidade_codigo=p_codigo
          and (e.expira_em is null or e.expira_em>now())
        limit 1
      ),
      (
        select pf.permitido
        from public.clinicas c
        join public.oricse_planos p on (p.codigo=c.plano or p.nome=c.plano)
        join public.oricse_plano_funcionalidades pf on pf.plano_id=p.id and pf.funcionalidade_codigo=p_codigo
        join public.oricse_funcionalidades f on f.codigo=pf.funcionalidade_codigo and f.ativo=true
        where c.id=p_clinica_id and p.ativo=true
        limit 1
      ),
      false
    );
$$;

create or replace function public.oricse_plano_permite(p_clinica_id uuid,p_codigo text)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select (select auth.uid()) is not null
    and (
      public.oricse_is_platform_admin()
      or (
        public.oricse_usuario_na_clinica(p_clinica_id)
        and public.oricse_clinica_tem_funcionalidade(p_clinica_id,p_codigo)
      )
    );
$$;

create or replace function public.oricse_portal_agendas()
returns table(id uuid,nome text,responsavel text,inicio time,fim time,dias_semana integer[],intervalo_min integer,modalidade text,antecedencia_horas integer,timezone text,tipo text,cor text)
language sql
stable
security definer
set search_path=''
as $$
  with ident as (select * from public.oricse_portal_identidade_atual())
  select a.id,a.nome,a.responsavel,a.inicio,a.fim,a.dias_semana,a.intervalo_min,a.modalidade,a.antecedencia_horas,a.timezone,a.tipo,a.cor
  from public.oricse_agendas_online a,ident i
  where a.clinica_id=i.clinica_id and a.portal_ativo=true
    and public.oricse_clinica_tem_funcionalidade(i.clinica_id,'portal_tutor.agendamento_online')
  order by a.nome;
$$;

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
  if i.clinica_id is null then raise exception 'Acesso de tutor inválido.' using errcode='42501'; end if;
  select * into a from public.oricse_agendas_online where id=p_agenda_id and clinica_id=i.clinica_id and portal_ativo=true;
  if not found then raise exception 'Agenda indisponível.' using errcode='P0002'; end if;
  if not public.oricse_clinica_tem_funcionalidade(i.clinica_id,'portal_tutor.agendamento_online') then raise exception 'Agendamento online indisponível no plano atual.' using errcode='42501'; end if;
  if extract(dow from p_data)::integer <> all(a.dias_semana) then return; end if;
  v_local_inicio:=p_data::timestamp+a.inicio;
  v_local_fim:=p_data::timestamp+a.fim;
  for v_slot in select generate_series(v_local_inicio,v_local_fim-make_interval(mins=>a.intervalo_min),make_interval(mins=>a.intervalo_min)) loop
    v_inicio:=v_slot at time zone a.timezone;
    v_fim:=(v_slot+make_interval(mins=>a.intervalo_min)) at time zone a.timezone;
    if v_inicio >= now()+make_interval(hours=>a.antecedencia_horas)
       and not exists(
         select 1 from public.oricse_agendamentos_online ag
         where ag.agenda_id=a.id
           and ag.estado in ('solicitado','reservado','confirmado')
           and tstzrange(ag.inicio,ag.fim,'[)') && tstzrange(v_inicio,v_fim,'[)')
       ) then
      inicio:=v_inicio; fim:=v_fim; rotulo:=to_char(v_slot,'HH24:MI'); return next;
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
  if extract(dow from v_local)::integer <> all(a.dias_semana) then raise exception 'Agenda indisponível neste dia.' using errcode='22023'; end if;
  if v_local::time<a.inicio or (v_local::time+make_interval(mins=>a.intervalo_min))>a.fim then raise exception 'Horário fora da agenda.' using errcode='22023'; end if;
  v_minutos:=extract(epoch from (v_local::time-a.inicio))/60;
  if mod(v_minutos,a.intervalo_min)<>0 then raise exception 'Horário fora da grade da agenda.' using errcode='22023'; end if;
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

revoke all on function public.oricse_clinica_tem_funcionalidade(uuid,text) from public,anon,authenticated;
revoke all on function public.oricse_plano_permite(uuid,text) from public,anon;
grant execute on function public.oricse_plano_permite(uuid,text) to authenticated;
