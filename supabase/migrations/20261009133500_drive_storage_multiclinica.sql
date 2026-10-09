-- Estrutura de armazenamento por clínica no Google Drive.
-- O Drive do Veterício é o destino padrão. Cada clínica pode apontar para uma pasta própria.

create table if not exists public.clinicas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text unique,
  status text not null default 'ativa' check (status in ('ativa','bloqueada','inativa')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clinica_usuarios (
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  papel text not null default 'usuario' check (papel in ('responsavel','admin_clinica','usuario')),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (clinica_id, user_id)
);

create table if not exists public.drive_plataforma_config (
  id smallint primary key default 1 check (id = 1),
  provider text not null default 'google_drive',
  root_folder_id text not null,
  clinicas_folder_id text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.clinica_drive_config (
  clinica_id uuid primary key references public.clinicas(id) on delete cascade,
  modo text not null default 'vetericio' check (modo in ('vetericio','personalizado')),
  root_folder_id text,
  root_folder_url text,
  status text not null default 'pendente' check (status in ('pendente','conectado','erro')),
  verificado_em timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.drive_arquivos (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  categoria text not null,
  nome text not null,
  mime_type text,
  tamanho_bytes bigint,
  drive_file_id text not null,
  drive_folder_id text,
  visibilidade text not null default 'interno' check (visibilidade in ('interno','tutor')),
  entidade_tipo text,
  entidade_id text,
  metadata jsonb not null default '{}'::jsonb,
  enviado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists drive_arquivos_clinica_idx
  on public.drive_arquivos(clinica_id, created_at desc);

create index if not exists drive_arquivos_entidade_idx
  on public.drive_arquivos(clinica_id, entidade_tipo, entidade_id);

alter table public.clinicas enable row level security;
alter table public.clinica_usuarios enable row level security;
alter table public.drive_plataforma_config enable row level security;
alter table public.clinica_drive_config enable row level security;
alter table public.drive_arquivos enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='clinicas' and policyname='platform_admin_clinicas') then
    create policy "platform_admin_clinicas" on public.clinicas for all to authenticated
      using (exists (select 1 from public.app_users au where au.user_id = auth.uid() and au.role = 'admin'))
      with check (exists (select 1 from public.app_users au where au.user_id = auth.uid() and au.role = 'admin'));
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='clinica_usuarios' and policyname='platform_admin_clinica_usuarios') then
    create policy "platform_admin_clinica_usuarios" on public.clinica_usuarios for all to authenticated
      using (exists (select 1 from public.app_users au where au.user_id = auth.uid() and au.role = 'admin'))
      with check (exists (select 1 from public.app_users au where au.user_id = auth.uid() and au.role = 'admin'));
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='drive_plataforma_config' and policyname='platform_admin_drive_config') then
    create policy "platform_admin_drive_config" on public.drive_plataforma_config for all to authenticated
      using (exists (select 1 from public.app_users au where au.user_id = auth.uid() and au.role = 'admin'))
      with check (exists (select 1 from public.app_users au where au.user_id = auth.uid() and au.role = 'admin'));
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='clinica_drive_config' and policyname='platform_admin_clinica_drive_config') then
    create policy "platform_admin_clinica_drive_config" on public.clinica_drive_config for all to authenticated
      using (exists (select 1 from public.app_users au where au.user_id = auth.uid() and au.role = 'admin'))
      with check (exists (select 1 from public.app_users au where au.user_id = auth.uid() and au.role = 'admin'));
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='drive_arquivos' and policyname='platform_admin_drive_arquivos') then
    create policy "platform_admin_drive_arquivos" on public.drive_arquivos for all to authenticated
      using (exists (select 1 from public.app_users au where au.user_id = auth.uid() and au.role = 'admin'))
      with check (exists (select 1 from public.app_users au where au.user_id = auth.uid() and au.role = 'admin'));
  end if;
end $$;
