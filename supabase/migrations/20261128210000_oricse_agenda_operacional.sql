-- Histórico enxuto, produzido somente após alterações reais de agenda.
alter table public.oricse_agendamentos_online
  add column if not exists serie_id uuid,
  add column if not exists serie_excecao boolean not null default false;
create index if not exists oricse_agendamento_serie_idx
  on public.oricse_agendamentos_online(clinica_id, serie_id, inicio) where serie_id is not null;

create table if not exists public.oricse_agenda_historico (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  agendamento_id uuid not null,
  acao text not null check (acao in ('criacao','reagendamento','status','cancelamento','edicao','exclusao')),
  estado_anterior text,
  estado_novo text,
  inicio_anterior timestamptz,
  inicio_novo timestamptz,
  registrado_em timestamptz not null default now(),
  registrado_por uuid
);
create index if not exists oricse_agenda_historico_clinica_agendamento_idx
  on public.oricse_agenda_historico(clinica_id, agendamento_id, registrado_em desc);
create index if not exists oricse_agenda_historico_clinica_data_idx
  on public.oricse_agenda_historico(clinica_id, registrado_em);

alter table public.oricse_agenda_historico enable row level security;
revoke all on public.oricse_agenda_historico from public, anon, authenticated;
grant select on public.oricse_agenda_historico to authenticated;
grant select on public.oricse_agenda_historico to service_role;
create policy oricse_agenda_historico_leitura on public.oricse_agenda_historico for select to authenticated
  using (public.oricse_usuario_pode_permissao(clinica_id, 'recepcao.agenda'));

create or replace function public.oricse_agenda_registrar_historico()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_acoes text[] := array[]::text[];
  v_acao text;
  antigo text;
  atual text;
begin
  if tg_op = 'INSERT' then
    v_acoes := array['criacao'];
  elsif tg_op = 'DELETE' then
    v_acoes := array['exclusao'];
  else
    antigo := coalesce(nullif(old.dados->>'status_clinico',''),old.estado);
    atual := coalesce(nullif(new.dados->>'status_clinico',''),new.estado);
    if old.inicio <> new.inicio or old.agenda_id <> new.agenda_id then
      v_acoes := array_append(v_acoes,'reagendamento');
    end if;
    if old.estado is distinct from new.estado or antigo is distinct from atual then
      v_acoes := array_append(v_acoes,case when new.estado='cancelado' and atual<>'Não compareceu' then 'cancelamento' else 'status' end);
    end if;
    if old.tipo is distinct from new.tipo or (old.fim is distinct from new.fim and old.inicio = new.inicio)
       or old.tutor_id is distinct from new.tutor_id or old.animal_id is distinct from new.animal_id
       or old.observacoes is distinct from new.observacoes then
      v_acoes := array_append(v_acoes,'edicao');
    end if;
  end if;
  foreach v_acao in array v_acoes loop
    insert into public.oricse_agenda_historico(
      clinica_id,agendamento_id,acao,estado_anterior,estado_novo,inicio_anterior,inicio_novo,registrado_por
    ) values (
      case when tg_op='DELETE' then old.clinica_id else new.clinica_id end,
      case when tg_op='DELETE' then old.id else new.id end,
      v_acao,
      case when tg_op<>'INSERT' then coalesce(nullif(old.dados->>'status_clinico',''),old.estado) end,
      case when tg_op<>'DELETE' then coalesce(nullif(new.dados->>'status_clinico',''),new.estado) end,
      case when tg_op<>'INSERT' then old.inicio end,
      case when tg_op<>'DELETE' then new.inicio end,
      auth.uid()
    );
  end loop;
  return null;
end $$;
revoke all on function public.oricse_agenda_registrar_historico() from public, anon, authenticated;
drop trigger if exists oricse_agenda_historico_automatico on public.oricse_agendamentos_online;
create trigger oricse_agenda_historico_automatico
  after insert or update or delete on public.oricse_agendamentos_online for each row
  execute function public.oricse_agenda_registrar_historico();

-- Uma transação por série. Validação e escrita ocorrem no mesmo banco do Portal;
-- o mecanismo de exclusão da agenda arbitra conflitos concorrentes.
create or replace function public.oricse_agenda_salvar_horarios(
  p_clinica uuid, p_agenda uuid, p_data date, p_hora time, p_duracao integer,
  p_tipo text, p_tutor uuid default null, p_animal uuid default null,
  p_pagamento text default 'Pendente', p_obs text default null,
  p_repeticoes integer default 1, p_passo_dias integer default 7,
  p_editar uuid default null, p_inicio_anterior timestamptz default null,
  p_toda_serie boolean default false
)
returns integer language plpgsql security invoker set search_path = '' as $$
declare
  agenda public.oricse_agendas_online%rowtype;
  item public.oricse_agendamentos_online%rowtype;
  item_serie public.oricse_agendamentos_online%rowtype;
  v_serie uuid;
  v_fuso text;
  v_nome text;
  v_especie text;
  v_data date;
  v_delta integer;
  v_inicio timestamptz;
  v_fim timestamptz;
  v_quantidade integer := 0;
  v_bloqueio boolean := p_tipo = 'Bloqueio de agenda';
  i integer;
begin
  if auth.uid() is null or public.oricse_usuario_pode_permissao(p_clinica,'recepcao.agenda') is not true then
    raise exception 'Sem acesso à agenda desta clínica.' using errcode='42501';
  end if;
  if p_data is null or p_hora is null or p_duracao is null or p_duracao not between 5 and 720
    or p_repeticoes is null or p_repeticoes not between 1 and 24
    or p_passo_dias is null or p_passo_dias not in (7,14,28)
    or p_tipo is null or p_tipo not in ('Consulta','Retorno','Cirurgia','Banho e Tosa','Vacina','Procedimento','Bloqueio de agenda')
    or p_pagamento is null or p_pagamento not in ('Pendente','Presencial','Isento','Pago','Estornado')
    or length(coalesce(p_obs,'')) > 2000 then
    raise exception 'Confira os campos do horário.' using errcode='22023';
  end if;
  select a.* into agenda from public.oricse_agendas_online a where a.clinica_id=p_clinica and a.id=p_agenda;
  if not found or lower(agenda.tipo) ~ 'banho|tosa' then raise exception 'Agenda clínica não encontrada.'; end if;
  v_fuso := coalesce(nullif(agenda.timezone,''),'America/Sao_Paulo');
  if not v_bloqueio then
    select a.nome,a.especie into v_nome,v_especie from public.oricse_animais a
      where a.clinica_id=p_clinica and a.id=p_animal and a.tutor_id=p_tutor;
    if not found then raise exception 'Selecione um tutor e um animal vinculados nesta clínica.'; end if;
  else
    p_tutor := null;
    p_animal := null;
    p_pagamento := 'Isento';
    v_nome := 'Bloqueio de agenda';
  end if;

  if p_editar is not null then
    select a.* into item from public.oricse_agendamentos_online a where a.clinica_id=p_clinica
      and a.id=p_editar and a.agenda_id=p_agenda;
    if not found then raise exception 'Horário não encontrado nesta agenda.'; end if;
    if p_toda_serie and (item.serie_id is null or item.serie_excecao) then
      raise exception 'Este horário não pode alterar a série.';
    end if;
    if p_toda_serie then
      perform pg_advisory_xact_lock(hashtextextended(item.serie_id::text,0));
    end if;
    select a.* into item from public.oricse_agendamentos_online a where a.clinica_id=p_clinica
      and a.id=p_editar and a.agenda_id=p_agenda for update;
    if not found or item.inicio is distinct from p_inicio_anterior then
      raise exception 'O horário mudou. Atualize a agenda e tente novamente.';
    end if;
    if item.estado not in ('confirmado','solicitado')
      or coalesce(item.dados->>'status_clinico','Agendado') not in ('Agendado','Aguardando aprovação')
      or (item.origem='portal_tutor' and (item.pagamento_confirmado_em is not null
            or nullif(item.dados->>'pagamento_portal_id','') is not null)) then
      raise exception 'Este horário não pode ser alterado pelo editor.';
    end if;
    -- Um agendamento entre clínicas/pacientes não pode herdar a identidade
    -- de portal do tutor anterior ou converter uma reserva coletiva em bloqueio.
    if item.origem='portal_tutor' and (p_tutor is distinct from item.tutor_id or p_animal is distinct from item.animal_id) then
      raise exception 'Não é possível trocar o paciente de uma solicitação pelo Portal.';
    end if;
    v_delta := p_data - (item.inicio at time zone v_fuso)::date;
    if p_toda_serie and (item.serie_excecao or v_delta <> 0 or item.tipo <> p_tipo or item.tutor_id is distinct from p_tutor
          or item.animal_id is distinct from p_animal or item.inicio <= now()) then
      raise exception 'Na série, altere apenas hora, duração, pagamento e observações de horários futuros.';
    end if;

    for item_serie in
      select a.* from public.oricse_agendamentos_online a where a.clinica_id=p_clinica
        and a.agenda_id=p_agenda and (
          (not p_toda_serie and a.id=p_editar)
          or (p_toda_serie and a.serie_id=item.serie_id and not a.serie_excecao and a.inicio>now()
               and a.estado='confirmado' and a.origem='recepcao'
               and coalesce(a.dados->>'status_clinico','Agendado')='Agendado')
        ) order by a.inicio,a.id for update
    loop
      v_data := (item_serie.inicio at time zone v_fuso)::date + v_delta;
      v_inicio := (v_data + p_hora) at time zone v_fuso;
      v_fim := v_inicio + make_interval(mins=>p_duracao);
      if (v_inicio is distinct from item_serie.inicio and v_inicio <= now()) then
        raise exception 'Escolha um novo horário futuro.';
      end if;
      if not (extract(dow from v_data)::integer = any(agenda.dias_semana))
        or p_hora < agenda.inicio or (v_fim at time zone v_fuso)::date <> v_data
        or (v_fim at time zone v_fuso)::time > agenda.fim then
        raise exception 'O horário precisa caber na grade de %.', v_data;
      end if;
      update public.oricse_agendamentos_online a set
        inicio=v_inicio, fim=v_fim, tipo=p_tipo,tutor_id=p_tutor,animal_id=p_animal,
        tutor_auth_id=case when a.tutor_id is distinct from p_tutor then null else a.tutor_auth_id end,
        animal_referencia=v_nome, observacoes=nullif(btrim(p_obs),''),
        serie_excecao=case when not p_toda_serie and a.serie_id is not null then true else a.serie_excecao end,
        dados=coalesce(a.dados,'{}'::jsonb)||jsonb_build_object('pagamento',p_pagamento,'especie',v_especie)
          ||case when v_inicio<>a.inicio then jsonb_build_object('reagendado_em',now()) else '{}'::jsonb end,
        updated_at=now()
        where a.clinica_id=p_clinica and a.id=item_serie.id;
      v_quantidade := v_quantidade+1;
    end loop;
    if v_quantidade = 0 then raise exception 'Não há horários válidos para alterar.'; end if;
    return v_quantidade;
  end if;

  if p_toda_serie then raise exception 'Selecione um horário da série para editar.'; end if;
  if p_repeticoes > 1 then v_serie := gen_random_uuid(); end if;
  for i in 0 .. p_repeticoes-1 loop
    v_data := p_data+i*p_passo_dias;
    v_inicio := (v_data+p_hora) at time zone v_fuso;
    v_fim := v_inicio+make_interval(mins=>p_duracao);
    if p_repeticoes>1 and v_inicio<=now() then raise exception 'Séries devem iniciar no futuro.'; end if;
    if not (extract(dow from v_data)::integer = any(agenda.dias_semana)) or p_hora<agenda.inicio
      or (v_fim at time zone v_fuso)::date<>v_data or (v_fim at time zone v_fuso)::time>agenda.fim then
      raise exception 'O horário precisa caber na grade de %.',v_data;
    end if;
    insert into public.oricse_agendamentos_online
      (clinica_id,agenda_id,tutor_id,animal_id,animal_referencia,inicio,fim,tipo,estado,origem,dados,observacoes,serie_id)
      values(p_clinica,p_agenda,p_tutor,p_animal,v_nome,v_inicio,v_fim,p_tipo,'confirmado','recepcao',
        jsonb_build_object('status_clinico','Agendado','pagamento',p_pagamento,'especie',v_especie,'origem_recepcao',true),
        nullif(btrim(p_obs),''),v_serie);
  end loop;
  return p_repeticoes;
exception when exclusion_violation then
  raise exception 'Conflito de horário em %. Nenhuma ocorrência foi alterada.',v_data using errcode='23P01';
end $$;
revoke all on function public.oricse_agenda_salvar_horarios(uuid,uuid,date,time,integer,text,uuid,uuid,text,text,integer,integer,uuid,timestamptz,boolean) from public,anon;
grant execute on function public.oricse_agenda_salvar_horarios(uuid,uuid,date,time,integer,text,uuid,uuid,text,text,integer,integer,uuid,timestamptz,boolean) to authenticated;

-- Defende a mesma grade para gravações de balcão e Portal. Não exige
-- saneamento prévio de sobreposições antigas para instalar a migração.
create or replace function public.oricse_agenda_proteger_sobreposicao()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.estado not in ('confirmado','solicitado','reservado','pendente') then return new; end if;
  if tg_op = 'UPDATE' and old.agenda_id = new.agenda_id and old.clinica_id = new.clinica_id
    and old.inicio = new.inicio and old.fim = new.fim
    and old.estado in ('confirmado','solicitado','reservado','pendente')
    and not (old.estado='reservado' and old.pagamento_expira_em is not null and old.pagamento_expira_em<=now() and new.estado<>'reservado') then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('oricse-agenda:'||new.agenda_id::text,0));
  if exists (
    select 1 from public.oricse_agendamentos_online a
      where a.clinica_id=new.clinica_id and a.agenda_id=new.agenda_id and a.id<>new.id
       and a.estado in ('confirmado','solicitado','reservado','pendente')
       and not (a.estado='reservado' and a.pagamento_expira_em is not null and a.pagamento_expira_em <= now())
       and a.inicio < new.fim and a.fim > new.inicio
  ) then
    raise exception 'O horário já está ocupado.' using errcode='23P01';
  end if;
  return new;
end $$;
revoke all on function public.oricse_agenda_proteger_sobreposicao() from public, anon, authenticated;
drop trigger if exists oricse_agenda_sem_sobreposicao on public.oricse_agendamentos_online;
create trigger oricse_agenda_sem_sobreposicao
  before insert or update of clinica_id, agenda_id, inicio, fim, estado on public.oricse_agendamentos_online
  for each row execute function public.oricse_agenda_proteger_sobreposicao();

create or replace function public.oricse_agenda_status_recepcao(
  p_clinica uuid,p_agendamento uuid,p_status text,p_inicio_esperado timestamptz
)
returns void language plpgsql security invoker set search_path='' as $$
declare item public.oricse_agendamentos_online%rowtype; atual text; campos jsonb;
begin
  if auth.uid() is null or public.oricse_usuario_pode_permissao(p_clinica,'recepcao.agenda') is not true then
    raise exception 'Sem acesso à agenda desta clínica.' using errcode='42501';
  end if;
  select a.* into item from public.oricse_agendamentos_online a
    where a.clinica_id=p_clinica and a.id=p_agendamento for update;
  if not found or item.estado<>'confirmado' or item.tipo='Bloqueio de agenda'
    or item.inicio is distinct from p_inicio_esperado then
    raise exception 'O horário mudou ou não permite esta ação.';
  end if;
  atual := coalesce(nullif(item.dados->>'status_clinico',''),'Agendado');
  if p_status='Chegou' and atual='Agendado' then
    campos := jsonb_build_object('chegada_em',now());
  elsif p_status='Em atendimento' and atual in ('Agendado','Chegou') then
    campos := jsonb_build_object('atendimento_inicio_em',now());
  elsif p_status='Não compareceu' and atual='Agendado' and item.inicio<=now() then
    campos := jsonb_build_object('falta_em',now());
  else
    raise exception 'Ação indisponível para este estado. Atualize a agenda.';
  end if;
  update public.oricse_agendamentos_online a set
    estado=case when p_status='Não compareceu' then 'cancelado' else a.estado end,
    dados=coalesce(a.dados,'{}'::jsonb)||campos||jsonb_build_object('status_clinico',p_status),
    updated_at=now()
    where a.clinica_id=p_clinica and a.id=p_agendamento;
end $$;
revoke all on function public.oricse_agenda_status_recepcao(uuid,uuid,text,timestamptz) from public,anon;
grant execute on function public.oricse_agenda_status_recepcao(uuid,uuid,text,timestamptz) to authenticated;

-- Busca sob a mesma política de leitura das tabelas, sem exportar documentos.
create or replace function public.oricse_agenda_buscar_pacientes(p_clinica uuid,p_termo text,p_tutor uuid default null)
returns table(tutor_id uuid,tutor_nome text,tutor_codigo text,pet_id uuid,pet_nome text,pet_especie text)
language sql stable security invoker set search_path='' as $$
  with entrada as (
    select translate(lower(left(btrim(coalesce(p_termo,'')),80)),
      'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc') q,
      regexp_replace(left(coalesce(p_termo,''),80),'[^0-9]','','g') fone
  )
  select t.id,t.nome::text,t.codigo_publico::text,a.id,a.nome::text,a.especie::text
  from entrada
  join public.tutores t on t.clinica_id=p_clinica and (p_tutor is null or t.id=p_tutor)
  left join public.oricse_animais a on a.clinica_id=t.clinica_id and a.tutor_id=t.id
  where auth.uid() is not null and public.oricse_usuario_pode_permissao(p_clinica,'recepcao.agenda')
    and (p_tutor is not null or length(entrada.q)>=2)
    and (
      entrada.q='' or strpos(translate(lower(concat_ws(' ',t.nome,t.codigo_publico,a.nome)),
      'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc'),entrada.q)>0
      or (length(entrada.fone)>=3 and strpos(regexp_replace(coalesce(t.telefone,''),'[^0-9]','','g'),entrada.fone)>0)
    )
  order by t.nome,a.nome nulls first,t.id,a.id limit 20;
$$;
revoke all on function public.oricse_agenda_buscar_pacientes(uuid,text,uuid) from public,anon;
grant execute on function public.oricse_agenda_buscar_pacientes(uuid,text,uuid) to authenticated;
