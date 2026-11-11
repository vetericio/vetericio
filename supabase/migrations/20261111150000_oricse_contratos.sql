-- Base de contratos preenchíveis e assinados.
-- O conteúdo dos documentos fica privado; o link público usa token opaco
-- armazenado apenas em hash e é validado exclusivamente pelo backend.

create table if not exists public.oricse_contrato_modelos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (char_length(btrim(titulo)) between 2 and 160),
  descricao text not null default '' check (char_length(descricao) <= 500),
  conteudo text not null check (char_length(conteudo) between 10 and 200000),
  ativo boolean not null default true,
  criado_por uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.oricse_contratos (
  id uuid primary key default gen_random_uuid(),
  modelo_id uuid references public.oricse_contrato_modelos(id) on delete set null,
  modelo_titulo text not null,
  modelo_conteudo_snapshot text not null,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  token_prefix text not null check (char_length(token_prefix) between 8 and 24),
  status text not null default 'link_gerado' check (status in ('link_gerado','preenchido','assinado','cancelado','expirado')),
  dados jsonb not null default '{}'::jsonb,
  pessoa_nome text,
  pessoa_email text,
  expira_em timestamptz,
  preenchido_em timestamptz,
  assinado_em timestamptz,
  criado_por uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.oricse_contrato_arquivos (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.oricse_contratos(id) on delete cascade,
  tipo text not null check (tipo in ('em_branco','assinado')),
  storage_path text not null unique,
  mime_type text not null default 'application/pdf',
  tamanho_bytes bigint not null check (tamanho_bytes > 0 and tamanho_bytes <= 20000000),
  created_at timestamptz not null default now(),
  unique (contrato_id, tipo)
);

create index if not exists oricse_contratos_status_idx
  on public.oricse_contratos(status, created_at desc);
create index if not exists oricse_contratos_expira_idx
  on public.oricse_contratos(expira_em)
  where expira_em is not null;
create index if not exists oricse_contrato_arquivos_contrato_idx
  on public.oricse_contrato_arquivos(contrato_id, tipo);

alter table public.oricse_contrato_modelos enable row level security;
alter table public.oricse_contratos enable row level security;
alter table public.oricse_contrato_arquivos enable row level security;

revoke all on public.oricse_contrato_modelos from public, anon;
revoke all on public.oricse_contratos from public, anon;
revoke all on public.oricse_contrato_arquivos from public, anon;
grant select, insert, update on public.oricse_contrato_modelos to authenticated;
grant select, insert, update on public.oricse_contratos to authenticated;
grant select, insert, update, delete on public.oricse_contrato_arquivos to authenticated;
grant all on public.oricse_contrato_modelos to service_role;
grant all on public.oricse_contratos to service_role;
grant all on public.oricse_contrato_arquivos to service_role;

drop policy if exists oricse_contrato_modelos_admin on public.oricse_contrato_modelos;
create policy oricse_contrato_modelos_admin
  on public.oricse_contrato_modelos for all to authenticated
  using (public.oricse_is_platform_admin())
  with check (public.oricse_is_platform_admin());

drop policy if exists oricse_contratos_admin on public.oricse_contratos;
create policy oricse_contratos_admin
  on public.oricse_contratos for all to authenticated
  using (public.oricse_is_platform_admin())
  with check (public.oricse_is_platform_admin());

drop policy if exists oricse_contrato_arquivos_admin on public.oricse_contrato_arquivos;
create policy oricse_contrato_arquivos_admin
  on public.oricse_contrato_arquivos for all to authenticated
  using (public.oricse_is_platform_admin())
  with check (public.oricse_is_platform_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('oricse-contratos', 'oricse-contratos', false, 20000000, array['application/pdf']::text[])
on conflict (id) do update
set public = false,
    file_size_limit = 20000000,
    allowed_mime_types = array['application/pdf']::text[];

