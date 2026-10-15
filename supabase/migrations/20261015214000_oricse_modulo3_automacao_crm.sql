-- Oricse Módulo 3: sincronização de fontes, geração automática e fila de envio.

create table if not exists public.oricse_crm_fontes (
  clinica_id uuid primary key references public.clinicas(id) on delete cascade,
  tutores jsonb not null default '[]'::jsonb,
  animais jsonb not null default '[]'::jsonb,
  prontuario jsonb not null default '[]'::jsonb,
  agendas jsonb not null default '[]'::jsonb,
  sincronizado_por uuid references auth.users(id) on delete set null,
  sincronizado_em timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.oricse_crm_fila_envio (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  evento_id uuid not null references public.oricse_crm_eventos(id) on delete cascade,
  canal text not null check (canal in ('whatsapp','email')),
  provider text not null default '',
  status text not null default 'aguardando_integracao' check (status in ('aguardando_integracao','pronto','enviado','erro','cancelado')),
  tentativas integer not null default 0,
  ultimo_erro text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  processado_em timestamptz,
  unique (evento_id)
);

create index if not exists oricse_crm_fila_envio_clinica_status_idx
  on public.oricse_crm_fila_envio(clinica_id,status,created_at);

alter table public.oricse_crm_fontes enable row level security;
alter table public.oricse_crm_fila_envio enable row level security;

drop policy if exists crm_fontes_ler on public.oricse_crm_fontes;
create policy crm_fontes_ler on public.oricse_crm_fontes for select to authenticated
using (
  public.oricse_usuario_pode_permissao(clinica_id,'crm.visualizar')
  or public.oricse_usuario_pode_permissao(clinica_id,'crm.enviar')
  or public.oricse_usuario_pode_permissao(clinica_id,'crm.gerenciar')
);

drop policy if exists crm_fontes_sincronizar on public.oricse_crm_fontes;
create policy crm_fontes_sincronizar on public.oricse_crm_fontes for all to authenticated
using (
  public.oricse_usuario_pode_permissao(clinica_id,'crm.enviar')
  or public.oricse_usuario_pode_permissao(clinica_id,'crm.gerenciar')
)
with check (
  public.oricse_usuario_pode_permissao(clinica_id,'crm.enviar')
  or public.oricse_usuario_pode_permissao(clinica_id,'crm.gerenciar')
);

drop policy if exists crm_fila_ler on public.oricse_crm_fila_envio;
create policy crm_fila_ler on public.oricse_crm_fila_envio for select to authenticated
using (
  public.oricse_usuario_pode_permissao(clinica_id,'crm.enviar')
  or public.oricse_usuario_pode_permissao(clinica_id,'crm.gerenciar')
);

drop policy if exists crm_fila_operar on public.oricse_crm_fila_envio;
create policy crm_fila_operar on public.oricse_crm_fila_envio for all to authenticated
using (public.oricse_usuario_pode_permissao(clinica_id,'crm.gerenciar'))
with check (public.oricse_usuario_pode_permissao(clinica_id,'crm.gerenciar'));

revoke all on table public.oricse_crm_fontes from anon;
revoke all on table public.oricse_crm_fila_envio from anon;
grant select,insert,update,delete on table public.oricse_crm_fontes to authenticated;
grant select,insert,update,delete on table public.oricse_crm_fila_envio to authenticated;

create or replace function public.oricse_crm_parse_date(p_text text)
returns date
language plpgsql
immutable
set search_path = ''
as $$
declare
  v text := btrim(coalesce(p_text,''));
begin
  if v = '' then return null; end if;
  if v ~ '^\d{4}-\d{2}-\d{2}' then return substr(v,1,10)::date; end if;
  if v ~ '^\d{1,2}/\d{1,2}/\d{4}$' then return to_date(v,'DD/MM/YYYY'); end if;
  return null;
exception when others then return null;
end;
$$;

create or replace function public.oricse_crm_template(p_text text, p_vars jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select replace(replace(replace(replace(replace(replace(
    coalesce(p_text,''),
    '{{tutor}}', coalesce(p_vars->>'tutor','')),
    '{{animal}}', coalesce(p_vars->>'animal','')),
    '{{data}}', coalesce(p_vars->>'data','')),
    '{{hora}}', coalesce(p_vars->>'hora','')),
    '{{servico}}', coalesce(p_vars->>'servico','')),
    '{{clinica}}', coalesce(p_vars->>'clinica',''));
$$;

create or replace function public.oricse_crm_data_aniversario(p_nascimento date, p_ano integer)
returns date
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_nascimento is null then return null; end if;
  begin
    return make_date(p_ano, extract(month from p_nascimento)::int, extract(day from p_nascimento)::int);
  exception when others then
    if extract(month from p_nascimento)::int = 2 and extract(day from p_nascimento)::int = 29 then
      return make_date(p_ano,2,28);
    end if;
    return null;
  end;
end;
$$;

create or replace function public.oricse_crm_criar_evento_interno(
  p_clinica_id uuid,
  p_tipo text,
  p_tutor jsonb,
  p_animal text,
  p_data_referencia date,
  p_hora text,
  p_servico text,
  p_agendado_para date,
  p_dedupe text,
  p_metadados jsonb default '{}'::jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_modelo record;
  v_clinica text;
  v_vars jsonb;
  v_phone text;
  v_email text;
  v_canal text;
  v_titulo text;
  v_mensagem text;
  v_rowcount integer := 0;
  v_agendado timestamptz;
begin
  select m.nome,m.assunto,m.mensagem,m.canal,m.ativo into v_modelo
  from public.oricse_crm_modelos m
  where m.clinica_id=p_clinica_id and m.tipo=p_tipo
  limit 1;
  if not found or not coalesce(v_modelo.ativo,false) then return 0; end if;

  select c.nome into v_clinica from public.clinicas c where c.id=p_clinica_id;
  v_phone := coalesce(nullif(p_tutor->>'telefone',''),nullif(p_tutor->>'outroTelefone',''),'');
  v_email := coalesce(p_tutor->>'email','');
  v_canal := coalesce(v_modelo.canal,'whatsapp');

  if v_canal='whatsapp' and (coalesce(p_tutor->>'autorizaWhatsapp','true')='false' or v_phone='') then
    if coalesce(p_tutor->>'autorizaEmail','false')='true' and v_email<>'' then v_canal:='email'; else v_canal:='manual'; end if;
  elsif v_canal='email' and (coalesce(p_tutor->>'autorizaEmail','false')<>'true' or v_email='') then
    if coalesce(p_tutor->>'autorizaWhatsapp','true')<>'false' and v_phone<>'' then v_canal:='whatsapp'; else v_canal:='manual'; end if;
  end if;

  v_vars := jsonb_build_object(
    'tutor',coalesce(p_tutor->>'nome',''),
    'animal',coalesce(p_animal,''),
    'data',to_char(p_data_referencia,'DD/MM/YYYY'),
    'hora',coalesce(p_hora,''),
    'servico',coalesce(p_servico,''),
    'clinica',coalesce(v_clinica,'Clínica')
  );
  v_titulo := public.oricse_crm_template(coalesce(nullif(v_modelo.assunto,''),v_modelo.nome),v_vars);
  v_mensagem := public.oricse_crm_template(v_modelo.mensagem,v_vars);
  v_agendado := make_timestamptz(extract(year from p_agendado_para)::int,extract(month from p_agendado_para)::int,extract(day from p_agendado_para)::int,9,0,0,'America/Sao_Paulo');

  insert into public.oricse_crm_eventos(
    clinica_id,tutor_ref_local,destinatario_nome,telefone,email,animal_nome,
    tipo,titulo,mensagem,canal,agendado_para,status,origem,chave_dedupe,metadados
  ) values (
    p_clinica_id,nullif(p_tutor->>'id',''),coalesce(p_tutor->>'nome',''),v_phone,v_email,coalesce(p_animal,''),
    p_tipo,v_titulo,v_mensagem,v_canal,v_agendado,'pendente','automatico',p_dedupe,coalesce(p_metadados,'{}'::jsonb)
  ) on conflict (clinica_id,chave_dedupe) do nothing;
  get diagnostics v_rowcount = row_count;
  return v_rowcount;
end;
$$;
revoke all on function public.oricse_crm_criar_evento_interno(uuid,text,jsonb,text,date,text,text,date,text,jsonb) from public,anon,authenticated;

create or replace function public.oricse_crm_preparar_fila_interno(p_clinica_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_count integer := 0;
begin
  insert into public.oricse_crm_fila_envio(clinica_id,evento_id,canal,status)
  select e.clinica_id,e.id,e.canal,'aguardando_integracao'
  from public.oricse_crm_eventos e
  where e.clinica_id=p_clinica_id and e.status='pendente' and e.canal in ('whatsapp','email') and e.agendado_para <= now()
  on conflict (evento_id) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.oricse_crm_preparar_fila_interno(uuid) from public,anon,authenticated;

create or replace function public.oricse_crm_processar_clinica_interno(p_clinica_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cfg public.oricse_crm_config%rowtype;
  v_src public.oricse_crm_fontes%rowtype;
  v_today date := timezone('America/Sao_Paulo',now())::date;
  v_tutor jsonb; v_animal jsonb; v_registro jsonb; v_agenda jsonb; v_evento jsonb;
  v_data date; v_send date; v_nasc date; v_ultimo date;
  v_text text; v_tipo text; v_servico text; v_animal_nome text; v_tutor_id text; v_animal_id text;
  v_ano integer; v_count integer := 0; v_added integer := 0;
begin
  select * into v_cfg from public.oricse_crm_config where clinica_id=p_clinica_id;
  if not found or not v_cfg.ativo then return 0; end if;
  if not public.oricse_plano_permite(p_clinica_id,'crm.inteligente') then return 0; end if;
  select * into v_src from public.oricse_crm_fontes where clinica_id=p_clinica_id;
  if not found then perform public.oricse_crm_preparar_fila_interno(p_clinica_id); return 0; end if;

  if v_cfg.gerar_aniversarios then
    for v_tutor in select value from jsonb_array_elements(coalesce(v_src.tutores,'[]'::jsonb)) loop
      if coalesce(v_tutor->>'autorizaLembretes','true')='false' then continue; end if;
      v_nasc := public.oricse_crm_parse_date(v_tutor->>'nascimento');
      if v_nasc is null then continue; end if;
      v_ano := extract(year from v_today)::int;
      v_data := public.oricse_crm_data_aniversario(v_nasc,v_ano);
      if v_data < v_today then v_data := public.oricse_crm_data_aniversario(v_nasc,v_ano+1); end if;
      if v_data between v_today and v_today+45 then
        v_added := public.oricse_crm_criar_evento_interno(p_clinica_id,'aniversario',v_tutor,'',v_data,'','aniversário',v_data,
          'aniversario:'||coalesce(v_tutor->>'id','sem-id')||':'||extract(year from v_data)::int,
          jsonb_build_object('fonte','tutor','nascimento',v_tutor->>'nascimento'));
        v_count := v_count + v_added;
      end if;
    end loop;
  end if;

  if v_cfg.gerar_reforcos then
    for v_registro in select value from jsonb_array_elements(coalesce(v_src.prontuario,'[]'::jsonb)) loop
      v_text := lower(concat_ws(' ',v_registro->>'tipo',v_registro->>'subtipo',v_registro->>'titulo',v_registro->>'detalhe'));
      if v_text !~ '(vacina|v10|v8|antirr|giard|gripe|verm)' then continue; end if;
      v_data := coalesce(
        public.oricse_crm_parse_date(v_registro->>'proximaDose'),
        public.oricse_crm_parse_date(v_registro->>'proximoReforco'),
        public.oricse_crm_parse_date(v_registro->>'validadeFim'),
        public.oricse_crm_parse_date(v_registro->'dados'->>'proximaDose'),
        public.oricse_crm_parse_date(v_registro->'dados'->>'proximoReforco'),
        public.oricse_crm_parse_date(v_registro->'dados'->>'validadeFim'),
        public.oricse_crm_parse_date(v_registro->'dados'->>'proxima_dose'),
        public.oricse_crm_parse_date(v_registro->'dados'->>'proximo_reforco'),
        public.oricse_crm_parse_date(v_registro->'dados'->>'validade_fim')
      );
      if v_data is null or v_data < v_today-14 or v_data > v_today+60 then continue; end if;
      v_animal_id := v_registro->>'animalId';
      select value into v_animal from jsonb_array_elements(coalesce(v_src.animais,'[]'::jsonb)) where value->>'id'=v_animal_id limit 1;
      if v_animal is null then continue; end if;
      v_tutor_id := v_animal->>'tutorId';
      select value into v_tutor from jsonb_array_elements(coalesce(v_src.tutores,'[]'::jsonb)) where value->>'id'=v_tutor_id limit 1;
      if v_tutor is null or coalesce(v_tutor->>'autorizaLembretes','true')='false' then continue; end if;
      v_servico := coalesce(nullif(v_registro->>'titulo',''),nullif(v_registro->>'subtipo',''),case when v_text ~ 'verm' then 'vermifugação' else 'reforço de vacina' end);
      v_added := public.oricse_crm_criar_evento_interno(p_clinica_id,'vacina',v_tutor,coalesce(v_animal->>'nome','seu pet'),v_data,'',v_servico,v_data,
        'vacina:'||coalesce(v_registro->>'id','sem-id')||':'||v_data::text,
        jsonb_build_object('fonte','prontuario','registro_id',v_registro->>'id'));
      v_count := v_count + v_added;
      v_animal := null; v_tutor := null;
    end loop;
  end if;

  if v_cfg.gerar_agendamentos or v_cfg.gerar_pos_cirurgico then
    for v_agenda in select value from jsonb_array_elements(coalesce(v_src.agendas,'[]'::jsonb)) loop
      for v_evento in select value from jsonb_array_elements(coalesce(v_agenda->'eventos','[]'::jsonb)) loop
        v_data := public.oricse_crm_parse_date(v_evento->>'data');
        if v_data is null then continue; end if;
        v_tutor_id := v_evento->>'tutorId';
        if coalesce(v_tutor_id,'')<>'' then
          select value into v_tutor from jsonb_array_elements(coalesce(v_src.tutores,'[]'::jsonb)) where value->>'id'=v_tutor_id limit 1;
        else
          select value into v_tutor from jsonb_array_elements(coalesce(v_src.tutores,'[]'::jsonb)) where lower(value->>'nome')=lower(v_evento->>'tutor') limit 1;
        end if;
        if v_tutor is null or coalesce(v_tutor->>'autorizaLembretes','true')='false' then v_tutor:=null; continue; end if;
        v_animal_id := v_evento->>'animalId';
        if coalesce(v_animal_id,'')<>'' then
          select value into v_animal from jsonb_array_elements(coalesce(v_src.animais,'[]'::jsonb)) where value->>'id'=v_animal_id limit 1;
        else v_animal:=null; end if;
        v_animal_nome := coalesce(nullif(v_animal->>'nome',''),nullif(v_evento->>'paciente',''),'seu pet');
        v_servico := coalesce(nullif(v_evento->>'tipo',''),'consulta');

        if v_cfg.gerar_agendamentos and v_data between v_today and v_today+90 then
          v_tipo := case when v_servico ~* 'retorno' then 'retorno' else 'lembrete_consulta' end;
          v_send := v_data - greatest(0,v_cfg.dias_antecedencia_agenda);
          v_added := public.oricse_crm_criar_evento_interno(p_clinica_id,v_tipo,v_tutor,v_animal_nome,v_data,coalesce(v_evento->>'hora',''),v_servico,v_send,
            v_tipo||':'||coalesce(v_evento->>'id','sem-id')||':'||v_data::text||':'||coalesce(v_evento->>'hora',''),
            jsonb_build_object('fonte','agenda','evento_id',v_evento->>'id','data_consulta',v_data::text));
          v_count := v_count + v_added;
        end if;

        if v_cfg.gerar_pos_cirurgico and v_servico ~* '(cirurg|procedimento cir)' then
          v_send := v_data + greatest(0,v_cfg.dias_pos_cirurgico);
          if v_send between v_today-14 and v_today+90 then
            v_added := public.oricse_crm_criar_evento_interno(p_clinica_id,'pos_cirurgico',v_tutor,v_animal_nome,v_send,'',v_servico,v_send,
              'pos_cirurgico:'||coalesce(v_evento->>'id','sem-id')||':'||v_send::text,
              jsonb_build_object('fonte','agenda','evento_id',v_evento->>'id','data_procedimento',v_data::text));
            v_count := v_count + v_added;
          end if;
        end if;
        v_tutor:=null; v_animal:=null;
      end loop;
    end loop;
  end if;

  if v_cfg.gerar_inativos then
    for v_tutor in select value from jsonb_array_elements(coalesce(v_src.tutores,'[]'::jsonb)) loop
      if coalesce(v_tutor->>'autorizaMarketing','false')<>'true' then continue; end if;
      v_ultimo := public.oricse_crm_parse_date(v_tutor->>'criadoEm');
      for v_agenda in select value from jsonb_array_elements(coalesce(v_src.agendas,'[]'::jsonb)) loop
        for v_evento in select value from jsonb_array_elements(coalesce(v_agenda->'eventos','[]'::jsonb)) loop
          if v_evento->>'tutorId'=v_tutor->>'id' then
            v_data := public.oricse_crm_parse_date(v_evento->>'data');
            if v_data is not null and v_data<=v_today and (v_ultimo is null or v_data>v_ultimo) then v_ultimo:=v_data; end if;
          end if;
        end loop;
      end loop;
      if v_ultimo is null or (v_today-v_ultimo) < v_cfg.dias_inatividade then continue; end if;
      select value into v_animal from jsonb_array_elements(coalesce(v_src.animais,'[]'::jsonb)) where value->>'tutorId'=v_tutor->>'id' limit 1;
      v_added := public.oricse_crm_criar_evento_interno(p_clinica_id,'inativo',v_tutor,coalesce(v_animal->>'nome','seu pet'),v_today,'','acompanhamento',v_today,
        'inativo:'||coalesce(v_tutor->>'id','sem-id')||':'||to_char(v_today,'YYYY-MM'),
        jsonb_build_object('fonte','inatividade','ultima_interacao',v_ultimo::text));
      v_count := v_count + v_added;
      v_animal:=null;
    end loop;
  end if;

  perform public.oricse_crm_preparar_fila_interno(p_clinica_id);
  return v_count;
end;
$$;
revoke all on function public.oricse_crm_processar_clinica_interno(uuid) from public,anon,authenticated;

create or replace function public.oricse_crm_processar_clinica(p_clinica_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (
    public.oricse_usuario_pode_permissao(p_clinica_id,'crm.enviar')
    or public.oricse_usuario_pode_permissao(p_clinica_id,'crm.gerenciar')
  ) then
    raise exception 'Sem permissão para processar o CRM desta clínica.' using errcode='42501';
  end if;
  return public.oricse_crm_processar_clinica_interno(p_clinica_id);
end;
$$;
revoke all on function public.oricse_crm_processar_clinica(uuid) from public,anon;
grant execute on function public.oricse_crm_processar_clinica(uuid) to authenticated;

create or replace function public.oricse_crm_processar_todas()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v record; v_total integer := 0;
begin
  for v in
    select c.clinica_id
    from public.oricse_crm_config c
    join public.clinicas cl on cl.id=c.clinica_id
    where c.ativo and cl.status='ativa'
  loop
    if public.oricse_plano_permite(v.clinica_id,'crm.inteligente') then
      v_total := v_total + public.oricse_crm_processar_clinica_interno(v.clinica_id);
    end if;
  end loop;
  return v_total;
end;
$$;
revoke all on function public.oricse_crm_processar_todas() from public,anon,authenticated;
