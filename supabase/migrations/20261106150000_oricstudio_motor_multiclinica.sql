-- OricStudio / ORICSE: motor de social media com tenant obrigatório.
-- Não cria tabelas globais do Gestor; integra-se às licenças ORICSE existentes.
-- Migration aditiva (nunca apagar/reescrever publicações e contas existentes).
begin;

alter table public.oricstudio_meta_contas
  add column if not exists login_tipo text not null default 'facebook';
alter table public.oricstudio_meta_oauth_states
  add column if not exists login_tipo text not null default 'facebook';
do $$ begin
  if not exists(select 1 from pg_constraint where conname='oricstudio_meta_login_tipo_ck') then
    alter table public.oricstudio_meta_contas
      add constraint oricstudio_meta_login_tipo_ck check(login_tipo in ('facebook','instagram'));
  end if;
  if not exists(select 1 from pg_constraint where conname='oricstudio_state_login_tipo_ck') then
    alter table public.oricstudio_meta_oauth_states
      add constraint oricstudio_state_login_tipo_ck check(login_tipo in ('facebook','instagram'));
  end if;
end $$;

create or replace function public.oricstudio_engine_pode_ler(p_clinica uuid)
returns boolean language sql stable security invoker set search_path=''
as $$
  select case when p_clinica is null
    then public.oricstudio_eh_admin()
    else public.oricstudio_pode_acessar(p_clinica) end;
$$;
create or replace function public.oricstudio_engine_pode_editar(p_clinica uuid)
returns boolean language sql stable security invoker set search_path=''
as $$
  select case when p_clinica is null
    then public.oricstudio_eh_admin()
    else public.oricstudio_pode_editar(p_clinica) end;
$$;
revoke all on function public.oricstudio_engine_pode_ler(uuid),
  public.oricstudio_engine_pode_editar(uuid) from public,anon;
grant execute on function public.oricstudio_engine_pode_ler(uuid),
  public.oricstudio_engine_pode_editar(uuid) to authenticated;

create table if not exists public.oricstudio_envios (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid references public.clinicas(id) on delete cascade,
  publicacao_id uuid not null,
  conta_id uuid not null references public.oricstudio_meta_contas(id) on delete restrict,
  planejado_para timestamptz not null,
  status text not null default 'agendado'
    check (status in ('agendado','processando','aguardando_meta','resultado_desconhecido','publicado','falhou','cancelado')),
  formato text not null check (formato in ('imagem','carrossel','reels','story')),
  legenda text not null default '' check (char_length(legenda)<=2200),
  midias jsonb not null default '[]'::jsonb check (jsonb_typeof(midias)='array'),
  idempotencia uuid not null default gen_random_uuid() unique,
  conteiner_meta text,
  midia_publicada_meta text,
  url_publicacao text,
  etapa text,
  iniciada_publicacao_em timestamptz,
  proxima_tentativa timestamptz,
  bloqueado_ate timestamptz,
  tentativas integer not null default 0 check (tentativas between 0 and 100),
  erro_resumido text,
  aprovado_por uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique(publicacao_id,conta_id)
);
create index if not exists oricstudio_envios_vencidos_idx
  on public.oricstudio_envios(planejado_para,proxima_tentativa)
  where status in ('agendado','processando','aguardando_meta','resultado_desconhecido');

create table if not exists public.oricstudio_envio_eventos (
  id bigint generated always as identity primary key,
  clinica_id uuid references public.clinicas(id) on delete cascade,
  envio_id uuid not null references public.oricstudio_envios(id) on delete cascade,
  etapa text not null,
  resultado text not null,
  detalhe text,
  criado_em timestamptz not null default now()
);
create index if not exists oricstudio_envio_eventos_idx
  on public.oricstudio_envio_eventos(envio_id,criado_em desc);

create table if not exists public.oricstudio_insights (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid references public.clinicas(id) on delete cascade,
  conta_id uuid not null references public.oricstudio_meta_contas(id) on delete cascade,
  referencia date not null,
  tipo text not null check (length(tipo) between 1 and 90),
  dados jsonb not null default '{}'::jsonb,
  coletado_em timestamptz not null default now(),
  unique(conta_id,referencia,tipo)
);
create index if not exists oricstudio_insights_clinica_idx
  on public.oricstudio_insights(clinica_id,referencia desc);

create table if not exists public.oricstudio_comentarios (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid references public.clinicas(id) on delete cascade,
  conta_id uuid not null references public.oricstudio_meta_contas(id) on delete cascade,
  id_comentario_meta text not null,
  id_midia_meta text,
  autor text,
  texto text not null default '',
  publicado_em timestamptz,
  categoria text,
  requer_humano boolean not null default false,
  resposta_sugerida text,
  respondido boolean not null default false,
  arquivado boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique(conta_id,id_comentario_meta)
);
create index if not exists oricstudio_comentarios_pendentes_idx
  on public.oricstudio_comentarios(clinica_id,publicado_em desc)
  where respondido=false and arquivado=false;

create table if not exists public.oricstudio_alertas (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid references public.clinicas(id) on delete cascade,
  conta_id uuid references public.oricstudio_meta_contas(id) on delete cascade,
  tipo text not null,
  mensagem text not null,
  referencia text,
  resolvido boolean not null default false,
  criado_em timestamptz not null default now(),
  resolvido_em timestamptz
);
create index if not exists oricstudio_alertas_pendentes_idx
  on public.oricstudio_alertas(clinica_id,criado_em desc) where resolvido=false;

create table if not exists public.oricstudio_regras_automacao (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid references public.clinicas(id) on delete cascade,
  conta_id uuid not null unique references public.oricstudio_meta_contas(id) on delete cascade,
  modo text not null default 'assistido' check (modo in ('assistido','automatico_regras','gestao_ampliada')),
  ativa boolean not null default false,
  max_por_dia smallint not null default 1 check (max_por_dia between 0 and 50),
  max_por_semana smallint not null default 7 check (max_por_semana between 0 and 200),
  precisa_aprovacao boolean not null default true,
  palavras_proibidas text[] not null default '{}'::text[],
  suspensa_em timestamptz,
  atualizada_em timestamptz not null default now()
);

create table if not exists public.oricstudio_relatorios (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid references public.clinicas(id) on delete cascade,
  conta_id uuid references public.oricstudio_meta_contas(id) on delete cascade,
  tipo text not null,
  periodo_inicio date not null,
  periodo_fim date not null,
  conteudo jsonb not null default '{}'::jsonb,
  gerado_em timestamptz not null default now(),
  check (periodo_fim>=periodo_inicio)
);
create index if not exists oricstudio_relatorios_clinica_idx on public.oricstudio_relatorios(clinica_id,gerado_em desc);

-- Trigger aplica isolamento inclusive contra service_role, que normalmente bypassa RLS.
-- Valida sempre a pertença da conta à mesma clínica do registro filho.
-- Valida post existente na tabela da clínica ou no ambiente ORICSE central.
create or replace function public.oricstudio_engine_envio_validar()
returns trigger language plpgsql security invoker set search_path=''
as $$
declare conta_clinica uuid;
begin
  if tg_op='UPDATE' and (new.clinica_id is distinct from old.clinica_id
     or new.conta_id is distinct from old.conta_id
     or new.publicacao_id is distinct from old.publicacao_id) then
    raise exception 'Não é permitido transferir envios entre clínicas/contas/publicações';
  end if;
  select a.clinica_id into conta_clinica
    from public.oricstudio_meta_contas a where a.id=new.conta_id;
  if not found or conta_clinica is distinct from new.clinica_id then
    raise exception 'Conta Instagram não pertence à clínica da publicação';
  end if;
  if new.clinica_id is null then
    if not exists(select 1 from public.oricstudio_sistema_publicacoes p where p.id=new.publicacao_id)
      then raise exception 'Publicação do ambiente ORICSE não encontrada'; end if;
  else
    if not exists(select 1 from public.oricstudio_publicacoes p
      where p.id=new.publicacao_id and p.clinica_id=new.clinica_id)
      then raise exception 'Publicação não pertence à clínica'; end if;
  end if;
  new.atualizado_em:=now();
  return new;
end $$;

create or replace function public.oricstudio_engine_evento_validar()
returns trigger language plpgsql security invoker set search_path=''
as $$
declare envio_clinica uuid;
begin
  select e.clinica_id into envio_clinica from public.oricstudio_envios e where e.id=new.envio_id;
  if not found or envio_clinica is distinct from new.clinica_id then
    raise exception 'Evento não pertence ao ambiente deste envio';
  end if;
  return new;
end $$;

-- Outros registros por conta precisam estar ligados à mesma clínica.
create or replace function public.oricstudio_engine_conta_guard()
returns trigger language plpgsql security invoker set search_path=''
as $$
declare conta_clinica uuid;
begin
  if tg_op='UPDATE' and (new.clinica_id is distinct from old.clinica_id
      or new.conta_id is distinct from old.conta_id) then
    raise exception 'Troca de conta/clínica proibida';
  end if;
  if new.conta_id is not null then
    select a.clinica_id into conta_clinica
      from public.oricstudio_meta_contas a where a.id=new.conta_id;
    if not found or conta_clinica is distinct from new.clinica_id then
      raise exception 'Conta de outra clínica';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists oricstudio_engine_envio_guard on public.oricstudio_envios;
create trigger oricstudio_engine_envio_guard before insert or update on public.oricstudio_envios
for each row execute function public.oricstudio_engine_envio_validar();
drop trigger if exists oricstudio_engine_evento_guard on public.oricstudio_envio_eventos;
create trigger oricstudio_engine_evento_guard before insert or update on public.oricstudio_envio_eventos
for each row execute function public.oricstudio_engine_evento_validar();
do $$
declare nome text;
begin
  foreach nome in array array['oricstudio_insights','oricstudio_comentarios',
    'oricstudio_alertas','oricstudio_regras_automacao','oricstudio_relatorios']
  loop
    execute format('drop trigger if exists %I on public.%I',nome||'_tenant_guard',nome);
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.oricstudio_engine_conta_guard()',nome||'_tenant_guard',nome);
  end loop;
end $$;

do $$
declare nome text;
begin
 foreach nome in array array['oricstudio_envios','oricstudio_envio_eventos','oricstudio_insights',
     'oricstudio_comentarios','oricstudio_alertas','oricstudio_regras_automacao','oricstudio_relatorios']
 loop
   execute format('alter table public.%I enable row level security',nome);
   execute format('revoke all on public.%I from anon,authenticated',nome);
   execute format('grant select on public.%I to authenticated',nome);
   execute format('drop policy if exists %I on public.%I',nome||'_ler',nome);
   execute format('create policy %I on public.%I for select to authenticated using (public.oricstudio_engine_pode_ler(clinica_id))',nome||'_ler',nome);
 end loop;
end $$;
-- Somente servidor com credenciais service_role grava dados operacionais.
revoke all on function public.oricstudio_engine_envio_validar(),public.oricstudio_engine_evento_validar(),
  public.oricstudio_engine_conta_guard() from public,anon,authenticated;
revoke all on public.oricstudio_envio_eventos_id_seq from public,anon,authenticated;

-- Reserva atômica e idempotente, somente service_role e clínicas licenciadas.
create or replace function public.oricstudio_claim_envios(p_limite integer default 5)
returns setof public.oricstudio_envios
language plpgsql security definer set search_path=''
as $$
begin
 return query
  update public.oricstudio_envios e set
    status='processando',bloqueado_ate=now()+interval '2 minutes',atualizado_em=now()
   where e.id in (
     select j.id from public.oricstudio_envios j
       left join public.clinicas c on c.id=j.clinica_id
       left join public.oricstudio_licencas l on l.clinica_id=j.clinica_id
       left join public.oricstudio_meta_contas a on a.id=j.conta_id
     where j.status in ('agendado','processando','aguardando_meta','resultado_desconhecido')
       and j.planejado_para<=now()
       and (j.proxima_tentativa is null or j.proxima_tentativa<=now())
       and (j.bloqueado_ate is null or j.bloqueado_ate<now())
       and a.status='ativa'
       and (
         j.clinica_id is null
         or (
          c.status='ativa' and c.excluido_em is null
          and l.status='ativo' and (l.expira_em is null or l.expira_em>now())
         )
       )
      order by j.planejado_para
      limit least(greatest(p_limite,1),20)
      for update of j skip locked
   )
  returning e.*;
end $$;
revoke all on function public.oricstudio_claim_envios(integer) from public,anon,authenticated;
grant execute on function public.oricstudio_claim_envios(integer) to service_role;

comment on table public.oricstudio_envios is
'Fila operacional exclusiva OricStudio. A publicação externa permanece desligada até homologação.';
commit;
