alter table public.oricse_banho_tosa_agendamentos
  add column if not exists serie_id uuid,
  add column if not exists serie_excecao boolean not null default false;
create index if not exists oricse_banho_agendamentos_serie_idx
  on public.oricse_banho_tosa_agendamentos(clinica_id,serie_id,inicio) where serie_id is not null;

create or replace function public.oricse_banho_proteger_sobreposicao()
returns trigger language plpgsql security definer set search_path='' as $$
declare profissional_chave text := lower(btrim(new.profissional));
begin
  if new.status='cancelado' then return new; end if;
  if tg_op='UPDATE' and old.status<>'cancelado' and new.clinica_id=old.clinica_id
    and new.animal_id=old.animal_id and new.inicio=old.inicio and new.fim=old.fim
    and profissional_chave=lower(btrim(old.profissional)) then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended('oricse-banho-agenda:'||new.clinica_id::text,0));
  if exists(select 1 from public.oricse_banho_tosa_agendamentos r
    where r.clinica_id=new.clinica_id and r.id<>new.id and r.status<>'cancelado'
      and (r.animal_id=new.animal_id or (profissional_chave<>'' and lower(btrim(r.profissional))=profissional_chave))
      and r.inicio<new.fim and r.fim>new.inicio) then
    raise exception 'O animal ou profissional já tem um banho ou tosa neste horário.' using errcode='23P01';
  end if;
  return new;
end $$;
revoke all on function public.oricse_banho_proteger_sobreposicao() from public,anon,authenticated;
drop trigger if exists oricse_banho_sem_sobreposicao on public.oricse_banho_tosa_agendamentos;
create trigger oricse_banho_sem_sobreposicao
  before insert or update of clinica_id,animal_id,profissional,inicio,fim,status on public.oricse_banho_tosa_agendamentos
  for each row execute function public.oricse_banho_proteger_sobreposicao();

-- Cria somente marcações pelo catálogo. Não escreve caixa, pagamentos ou pacotes.
create or replace function public.oricse_banho_salvar_serie(
  p_clinica uuid,p_data date,p_hora time,p_profissional text,p_obs text,
  p_animal uuid default null,p_servico uuid default null,p_repeticoes int default 1,p_passo_dias int default 7,
  p_editar uuid default null,p_inicio_anterior timestamptz default null,p_toda_serie boolean default false
)
returns integer language plpgsql security definer set search_path='' as $$
declare
  servico public.oricse_banho_tosa_servicos%rowtype;
  ag public.oricse_banho_tosa_agendamentos%rowtype;
  occ public.oricse_banho_tosa_agendamentos%rowtype;
  v_tutor uuid; v_serie uuid; v_data date; v_inicio timestamptz;
  v_duracao interval; i integer; quantidade integer:=0;
begin
  if auth.uid() is null or (
    public.oricse_usuario_pode_permissao(p_clinica,'hotelzinho.operar')
    or public.oricse_usuario_pode_permissao(p_clinica,'recepcao.agenda')) is not true then
    raise exception 'Sem acesso à agenda de banho e tosa desta clínica.' using errcode='42501';
  end if;
  if p_data is null or p_hora is null or p_repeticoes is null or p_repeticoes not between 1 and 24
    or p_passo_dias is null or p_passo_dias not in (7,14,28)
    or length(coalesce(p_profissional,''))>160 or length(coalesce(p_obs,''))>2000 then
    raise exception 'Confira a data, horário e campos da série.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('oricse-banho-agenda:'||p_clinica::text,0));
  if p_editar is not null then
    select a.* into ag from public.oricse_banho_tosa_agendamentos a
      where a.clinica_id=p_clinica and a.id=p_editar for update;
    if not found or ag.inicio is distinct from p_inicio_anterior or ag.status<>'agendado' or ag.inicio<=now() then
      raise exception 'O horário mudou ou não permite edição.';
    end if;
    if ag.pago or nullif(to_jsonb(ag)->>'pacote_id','') is not null
      or exists(select 1 from public.oricse_caixa_lancamentos p where p.clinica_id=p_clinica
        and p.agendamento_banho_tosa_id=ag.id and p.tipo='entrada' and p.status='pago')
      or exists(select 1 from public.oricse_banho_tosa_pagamentos p where p.clinica_id=p_clinica and p.agendamento_id=ag.id) then
      raise exception 'Use o fluxo individual para agendamento pago ou vinculado a pacote.';
    end if;
    if p_toda_serie and (ag.serie_id is null or ag.serie_excecao or p_data<>(ag.inicio at time zone 'America/Sao_Paulo')::date) then
      raise exception 'Altere a data pela opção Apenas este horário.';
    end if;
    for occ in select a.* from public.oricse_banho_tosa_agendamentos a
      where a.clinica_id=p_clinica and (
        (not p_toda_serie and a.id=ag.id) or
        (p_toda_serie and a.serie_id=ag.serie_id and not a.serie_excecao and a.inicio>now()
          and a.status='agendado' and not a.pago and nullif(to_jsonb(a)->>'pacote_id','') is null
          and not exists(select 1 from public.oricse_caixa_lancamentos p where p.clinica_id=p_clinica
            and p.agendamento_banho_tosa_id=a.id and p.tipo='entrada' and p.status='pago')
          and not exists(select 1 from public.oricse_banho_tosa_pagamentos p where p.clinica_id=p_clinica and p.agendamento_id=a.id)))
      order by a.inicio,a.id for update
    loop
      v_data := case when p_toda_serie then (occ.inicio at time zone 'America/Sao_Paulo')::date else p_data end;
      v_inicio := (v_data+p_hora) at time zone 'America/Sao_Paulo';
      if v_inicio<=now() then raise exception 'Escolha um horário futuro.'; end if;
      v_duracao := occ.fim-occ.inicio;
      update public.oricse_banho_tosa_agendamentos a set inicio=v_inicio,fim=v_inicio+v_duracao,
        profissional=btrim(coalesce(p_profissional,'')),observacoes=btrim(coalesce(p_obs,'')),
        atualizado_em=now(),serie_excecao=case when not p_toda_serie and a.serie_id is not null then true else a.serie_excecao end
        where a.clinica_id=p_clinica and a.id=occ.id;
      quantidade:=quantidade+1;
    end loop;
    if quantidade=0 then raise exception 'Não há horários futuros disponíveis para editar.'; end if;
    return quantidade;
  end if;

  if p_repeticoes<2 then raise exception 'Informe ao menos duas ocorrências para uma série.'; end if;
  select s.* into servico from public.oricse_banho_tosa_servicos s
    where s.clinica_id=p_clinica and s.id=p_servico and s.ativo;
  if not found then raise exception 'Selecione um serviço ativo da clínica.'; end if;
  select a.tutor_id into v_tutor from public.oricse_animais a where a.clinica_id=p_clinica and a.id=p_animal;
  if not found or v_tutor is null then raise exception 'Selecione um animal com tutor vinculado à clínica.'; end if;
  v_serie:=gen_random_uuid();
  for i in 0..p_repeticoes-1 loop
    v_data:=p_data+i*p_passo_dias;
    v_inicio:=(v_data+p_hora) at time zone 'America/Sao_Paulo';
    if v_inicio<=now() then raise exception 'A série deve iniciar em horário futuro.'; end if;
    insert into public.oricse_banho_tosa_agendamentos(clinica_id,animal_id,tutor_id,servico_id,servico_nome,
      inicio,fim,profissional,observacoes,valor_centavos,serie_id)
      values(p_clinica,p_animal,v_tutor,servico.id,servico.nome,v_inicio,
        v_inicio+make_interval(mins=>servico.duracao_min),btrim(coalesce(p_profissional,'')),
        btrim(coalesce(p_obs,'')),servico.preco_centavos,v_serie);
  end loop;
  return p_repeticoes;
exception when exclusion_violation then
  raise exception 'Conflito de horário em %. Nenhuma ocorrência foi alterada.',v_data using errcode='23P01';
end $$;
revoke all on function public.oricse_banho_salvar_serie(uuid,date,time,text,text,uuid,uuid,int,int,uuid,timestamptz,boolean) from public,anon;
grant execute on function public.oricse_banho_salvar_serie(uuid,date,time,text,text,uuid,uuid,int,int,uuid,timestamptz,boolean) to authenticated;
