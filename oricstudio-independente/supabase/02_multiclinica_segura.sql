-- OricStudio isolado: SEGUNDA ETAPA para banco SUPABASE EXCLUSIVO do OricStudio.
-- Execute SOMENTE em um banco OricStudio novo, DEPOIS de supabase/instalacao.sql.
-- NÃO executar no Gestor 2.0 e NÃO executar no banco central Oricse.
-- Requer PostgreSQL 15+ e Auth Supabase. Não migra dados de outra aplicação.
begin;

do $$
begin
  if to_regclass('public.clinicas') is not null
     or to_regclass('public.oricstudio_licencas') is not null then
    raise exception 'Abortado: banco Oricse detectado. OricStudio clonado precisa banco próprio.';
  end if;
  if to_regclass('public.meta_connections') is null then
    raise exception 'Execute primeiro o instalacao.sql do OricStudio clonado.';
  end if;
  if exists(select 1 from public.meta_connections)
     or exists(select 1 from public.instagram_accounts)
     or exists(select 1 from public.posts)
     or exists(select 1 from public.user_roles) then
    raise exception 'Migração requer banco novo vazio; não converter dados sem plano de migração.';
  end if;
end $$;

-- O id da clínica é o mesmo UUID atribuído pela Oricse. É espelhado por
-- operação autenticada na integração futura, não por cadastro livre.
create table public.studio_clinicas (
  id uuid primary key,
  nome text not null check(char_length(trim(nome)) between 2 and 160),
  ativa boolean not null default false,
  licenca_ativa boolean not null default false,
  licenca_expira_em timestamptz,
  criada_em timestamptz not null default now(),
  atualizada_em timestamptz not null default now()
);
create table public.studio_membros (
  clinica_id uuid not null references public.studio_clinicas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  papel public.app_role not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  primary key(clinica_id,user_id)
);
create index studio_membros_user_idx on public.studio_membros(user_id,clinica_id) where ativo=true;
create table public.studio_selecao (
  user_id uuid primary key references auth.users(id) on delete cascade,
  clinica_id uuid not null references public.studio_clinicas(id) on delete cascade,
  atualizada_em timestamptz not null default now()
);

alter table public.studio_clinicas enable row level security;
alter table public.studio_membros enable row level security;
alter table public.studio_selecao enable row level security;
revoke all on public.studio_clinicas,public.studio_membros,public.studio_selecao from public,anon,authenticated;
grant select on public.studio_clinicas,public.studio_membros to authenticated;
grant select,insert,update on public.studio_selecao to authenticated;

-- SECURITY DEFINER somente para verificar identidade e vínculo, nunca
-- para fazer mutações no nome de outros usuários.
create function public.studio_eh_membro(p_clinica uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select (select auth.uid()) is not null and exists(
    select 1 from public.studio_membros m
    where m.user_id = (select auth.uid()) and m.clinica_id=p_clinica and m.ativo=true
  );
$$;
create function public.studio_clinica_atual()
returns uuid language sql stable security definer set search_path = ''
as $$
  select s.clinica_id from public.studio_selecao s
  join public.studio_membros m on m.clinica_id=s.clinica_id and m.user_id=s.user_id and m.ativo=true
  where s.user_id=(select auth.uid());
$$;
create function public.studio_pode_ler(p_clinica uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select (select auth.uid()) is not null
     and p_clinica=public.studio_clinica_atual()
     and exists(
       select 1 from public.studio_clinicas c
       join public.studio_membros m on m.clinica_id=c.id
       where c.id=p_clinica
         and m.user_id=(select auth.uid()) and m.ativo=true
         and c.ativa and c.licenca_ativa
         and (c.licenca_expira_em is null or c.licenca_expira_em>now())
     );
$$;
create function public.studio_pode_editar(p_clinica uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.studio_pode_ler(p_clinica) and exists(
    select 1 from public.studio_membros m
    where m.user_id=(select auth.uid()) and m.clinica_id=p_clinica
      and m.ativo=true and m.papel in ('admin','editor')
  );
$$;
create function public.studio_eh_admin(p_clinica uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.studio_pode_ler(p_clinica) and exists(
    select 1 from public.studio_membros m
    where m.user_id=(select auth.uid()) and m.clinica_id=p_clinica
      and m.ativo=true and m.papel='admin'
  );
$$;
revoke all on function public.studio_eh_membro(uuid),public.studio_clinica_atual(),
  public.studio_pode_ler(uuid),public.studio_pode_editar(uuid),public.studio_eh_admin(uuid)
  from public,anon,authenticated;
grant execute on function public.studio_eh_membro(uuid),public.studio_clinica_atual(),
  public.studio_pode_ler(uuid),public.studio_pode_editar(uuid),public.studio_eh_admin(uuid)
  to authenticated;

create policy studio_clinica_ler on public.studio_clinicas
for select to authenticated using (public.studio_eh_membro(id));
create policy studio_membro_ler on public.studio_membros
for select to authenticated using (user_id=(select auth.uid()) or public.studio_eh_admin(clinica_id));
create policy studio_selecao_ler on public.studio_selecao
for select to authenticated using (user_id=(select auth.uid()));
create policy studio_selecao_criar on public.studio_selecao
for insert to authenticated with check (
 user_id=(select auth.uid()) and public.studio_eh_membro(clinica_id)
);
create policy studio_selecao_alterar on public.studio_selecao
for update to authenticated using (user_id=(select auth.uid()))
with check (user_id=(select auth.uid()) and public.studio_eh_membro(clinica_id));

-- Papel do Gestor original NÃO é autorização global. Todos os seus RPCs
-- passam a responder exclusivamente para o contexto de clínica selecionado.
create or replace function public.has_role(_user_id uuid,_role public.app_role)
returns boolean language sql stable security definer set search_path = ''
as $$
 select _user_id=(select auth.uid()) and public.studio_pode_ler(public.studio_clinica_atual())
   and exists(select 1 from public.studio_membros m where m.user_id=_user_id
      and m.clinica_id=public.studio_clinica_atual() and m.ativo=true and m.papel=_role);
$$;
create or replace function public.has_any_role(_user_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
 select _user_id=(select auth.uid()) and public.studio_pode_ler(public.studio_clinica_atual());
$$;
create or replace function public.can_edit(_user_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
 select _user_id=(select auth.uid()) and public.studio_pode_editar(public.studio_clinica_atual());
$$;
-- Funções antigas com papel global ficam negadas para usuários comuns.
revoke all on public.user_roles from anon,authenticated;
revoke all on public.studio_clinicas,public.studio_membros from authenticated;
grant select on public.studio_clinicas,public.studio_membros to authenticated;

-- Toda entidade operacional tem clinic_id não anulável e FK para a clínica.
-- A ligação relacional abaixo é reforçada por trigger antes de qualquer INSERT/UPDATE.
do $$
declare tbl text;
begin
  foreach tbl in array array[
    'oauth_states','meta_connections','meta_tokens','facebook_pages',
    'instagram_accounts','brands','media_assets','posts','publish_jobs',
    'post_versions','metric_snapshots','comments','automation_rules','alerts',
    'reports','app_settings','audit_log','data_deletion_requests','post_events',
    'assistant_keys','ig_media','regras_publicacao','oauth_clients','oauth_codes','oauth_tokens'
  ] loop
    execute format('alter table public.%I add column if not exists clinica_id uuid',tbl);
    execute format('alter table public.%I alter column clinica_id set default public.studio_clinica_atual()',tbl);
    execute format('alter table public.%I add constraint %I foreign key(clinica_id) references public.studio_clinicas(id) on delete cascade',tbl,'studio_'||tbl||'_tenant_fk');
    if tbl <> 'app_settings' then
      execute format('alter table public.%I alter column clinica_id set not null',tbl);
    end if;
    execute format('create index if not exists %I on public.%I(clinica_id)', 'studio_'||tbl||'_tenant_idx',tbl);
  end loop;
end $$;

-- A linha singleton do Gestor não pode administrar clínicas diferentes.
delete from public.app_settings where clinica_id is null;
alter table public.app_settings drop constraint app_settings_pkey;
alter table public.app_settings alter column clinica_id set not null;
alter table public.app_settings add primary key(clinica_id,id);
create function public.studio_gerar_configuracao()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
 insert into public.app_settings(clinica_id,id,pausa_geral,modo_autonomia)
 values(new.id,true,true,'assistido') on conflict do nothing;
 return new;
end $$;
revoke all on function public.studio_gerar_configuracao() from public,anon,authenticated;
create trigger studio_seed_settings after insert on public.studio_clinicas
for each row execute function public.studio_gerar_configuracao();

-- Ao receber o primeiro vínculo válido, preselecionar a clínica com
-- os mesmos UUIDs espelhados pela plataforma; sem localStorage.
create function public.studio_selecionar_primeira()
returns trigger language plpgsql security definer set search_path = ''
as $
begin
  if new.ativo then
   insert into public.studio_selecao(user_id,clinica_id)
   values(new.user_id,new.clinica_id)
   on conflict(user_id) do nothing;
  end if;
  return new;
end $;
revoke all on function public.studio_selecionar_primeira() from public,anon,authenticated;
create trigger studio_select_first_member after insert on public.studio_membros
for each row execute function public.studio_selecionar_primeira();

-- Mesmo o service_role não pode mudar a propriedade de um objeto
-- já existente por UPDATE ou UPSERT com um ID de outra clínica.
create function public.studio_proibir_transferencia()
returns trigger language plpgsql security invoker set search_path = ''
as $
begin
  if new.clinica_id is distinct from old.clinica_id then
    raise exception 'Não é permitido transferir recursos entre clínicas';
  end if;
  return new;
end $;
revoke all on function public.studio_proibir_transferencia() from public,anon,authenticated;
do $
declare t text;
begin
 foreach t in array array[
  'oauth_states','meta_connections','meta_tokens','facebook_pages',
  'instagram_accounts','brands','media_assets','posts','publish_jobs',
  'post_versions','metric_snapshots','comments','automation_rules','alerts',
  'reports','app_settings','audit_log','data_deletion_requests','post_events',
  'assistant_keys','ig_media','regras_publicacao','oauth_clients','oauth_codes','oauth_tokens'
 ] loop
   execute format('create trigger %I before update on public.%I for each row execute function public.studio_proibir_transferencia()',
     'studio_no_move_'||t,t);
 end loop;
end $;

-- Proibir vínculos cruzados até para gravações privilegiadas: a clínica
-- da entidade filha é sempre a mesma da entidade pai.
create function public.studio_vincular_pai()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare parent_clinic uuid;
declare parent_id text;
begin
 parent_id := to_jsonb(new)->>tg_argv[2];
 if parent_id is null then
   if tg_argv[3] = 'opcional' then
     if tg_op='UPDATE' and new.clinica_id is distinct from old.clinica_id then
       raise exception 'Troca de clínica não permitida';
     end if;
     return new;
   end if;
   raise exception 'Referência parental ausente';
 end if;
 execute format('select clinica_id from public.%I where %I::text=$1',tg_argv[0],tg_argv[1])
  into parent_clinic using parent_id;
 if parent_clinic is null then raise exception 'Vínculo de clínica inválido'; end if;
 if new.clinica_id is not null and new.clinica_id <> parent_clinic then
  raise exception 'Isolamento: recursos de clínicas distintas';
 end if;
 if tg_op='UPDATE' and old.clinica_id is distinct from parent_clinic then
  raise exception 'Isolamento: não é permitido transferir dados entre clínicas';
 end if;
 new.clinica_id := parent_clinic;
 return new;
end $$;
revoke all on function public.studio_vincular_pai() from public,anon,authenticated;
do $$
declare t text;
declare par text;
declare fk text;
begin
 for t,par,fk in
  select * from (values
   ('meta_tokens','meta_connections','connection_id'),
   ('facebook_pages','meta_connections','connection_id'),
   ('instagram_accounts','meta_connections','connection_id'),
   ('brands','instagram_accounts','instagram_account_id'),
   ('media_assets','instagram_accounts','instagram_account_id'),
   ('posts','instagram_accounts','instagram_account_id'),
   ('publish_jobs','posts','post_id'),
   ('post_versions','posts','post_id'),
   ('metric_snapshots','instagram_accounts','instagram_account_id'),
   ('comments','instagram_accounts','instagram_account_id'),
   ('automation_rules','instagram_accounts','instagram_account_id'),
   ('ig_media','instagram_accounts','instagram_account_id'),
   ('regras_publicacao','instagram_accounts','instagram_account_id'),
   ('post_events','posts','post_id')
  ) as x(t,par,fk)
 loop
   execute format('create trigger %I before insert or update on public.%I for each row execute function public.studio_vincular_pai(%L,%L,%L)', 'studio_bind_'||t,t,par,'id',fk);
 end loop;
end $$;

-- Remover políticas herdadas do aplicativo monoempresa. Nenhuma política
-- global ("todos administradores leem tudo") permanece em produção.
do $$
declare tbl text;
declare pol record;
declare full_name text;
declare write_access boolean;
begin
  foreach tbl in array array[
    'oauth_states','meta_connections','meta_tokens','facebook_pages',
    'instagram_accounts','brands','media_assets','posts','publish_jobs',
    'post_versions','metric_snapshots','comments','automation_rules','alerts',
    'reports','app_settings','audit_log','data_deletion_requests','post_events',
    'assistant_keys','ig_media','regras_publicacao','oauth_clients','oauth_codes','oauth_tokens'
  ] loop
   for pol in select policyname from pg_policies
      where schemaname='public' and tablename=tbl
   loop
     execute format('drop policy %I on public.%I', pol.policyname,tbl);
   end loop;
   execute format('alter table public.%I enable row level security',tbl);
   execute format('revoke all on public.%I from anon,authenticated',tbl);
  end loop;
  foreach tbl in array array[
   'meta_connections','facebook_pages','instagram_accounts','brands',
   'media_assets','posts','post_versions','metric_snapshots','comments',
   'automation_rules','alerts','reports','app_settings','audit_log','post_events',
   'ig_media','regras_publicacao'
  ] loop
   execute format('grant select on public.%I to authenticated',tbl);
   execute format('create policy %I on public.%I for select to authenticated using (public.studio_pode_ler(clinica_id))','studio_read_'||tbl,tbl);
  end loop;
  foreach tbl in array array['brands','app_settings','regras_publicacao'] loop
   execute format('grant insert,update,delete on public.%I to authenticated',tbl);
   execute format('create policy %I on public.%I for insert to authenticated with check (public.studio_pode_editar(clinica_id))','studio_insert_'||tbl,tbl);
   execute format('create policy %I on public.%I for update to authenticated using (public.studio_pode_editar(clinica_id)) with check (public.studio_pode_editar(clinica_id))','studio_update_'||tbl,tbl);
   execute format('create policy %I on public.%I for delete to authenticated using (public.studio_pode_editar(clinica_id))','studio_delete_'||tbl,tbl);
  end loop;
end $$;

-- A mídia deve pertencer a uma conta gerenciada na clínica selecionada.
drop policy if exists "midia editors upload" on storage.objects;
create policy "studio uploads somente propria clinica"
on storage.objects for insert to authenticated with check (
 bucket_id='midia'
 and exists(
   select 1 from public.instagram_accounts acc
   where acc.id::text=split_part(name,'/',2)
     and public.studio_pode_editar(acc.clinica_id)
 )
);

-- A função de claim agora exige tenant explícito e só service_role pode chamá-la.
drop function if exists public.claim_due_posts(integer,integer);
create function public.claim_due_posts(
 _limit integer default 3, _lease_seconds integer default 120, _clinica_id uuid default null
)
returns setof public.posts language plpgsql security definer set search_path = ''
as $$
begin
 if auth.role() <> 'service_role' then
  raise exception 'Somente o agendador servidor pode reservar publicações';
 end if;
 if _clinica_id is null then raise exception 'Contexto de clínica obrigatório'; end if;
 return query
 update public.posts p set
  locked_until=now()+make_interval(secs=>_lease_seconds),
  status=case when p.status='agendado' then 'processando' else p.status end
 where p.id in(
  select id from public.posts
  where clinica_id=_clinica_id and status in('agendado','processando','resultado_desconhecido')
    and agendado_para<=now()
    and (proxima_tentativa is null or proxima_tentativa<=now())
    and (locked_until is null or locked_until<now())
  order by agendado_para limit _limit for update skip locked
 )
 returning p.*;
end $$;
revoke all on function public.claim_due_posts(integer,integer,uuid) from public,anon,authenticated;
grant execute on function public.claim_due_posts(integer,integer,uuid) to service_role;

-- Novos registros de clínica/assinatura/vínculo só pelo servidor ORICSE
-- após confirmação de identidade e pagamento. Nada no browser cria tenants.
revoke all on public.studio_clinicas,public.studio_membros from anon,authenticated;
grant select on public.studio_clinicas,public.studio_membros to authenticated;
commit;
