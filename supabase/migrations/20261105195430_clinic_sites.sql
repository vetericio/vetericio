create table public.clinic_sites (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null unique references public.clinicas(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:[a-z0-9-]*[a-z0-9])?$'),
  status text not null default 'rascunho' check (status in ('rascunho', 'publicado')),
  template text not null default 'prestige' check (template in ('prestige', 'atelier', 'cuidado', 'popular', 'essencial')),
  config jsonb not null default '{}'::jsonb,
  publicado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index clinic_sites_status_slug_idx on public.clinic_sites (status, slug);
alter table public.clinic_sites enable row level security;

revoke all on public.clinic_sites from anon, authenticated;
grant select on public.clinic_sites to anon, authenticated;
grant insert, update, delete on public.clinic_sites to authenticated;

create policy clinic_sites_public_read on public.clinic_sites
  for select to anon, authenticated
  using (status = 'publicado' or public.oricse_usuario_pode_permissao(clinica_id, 'administracao.site'));

create policy clinic_sites_manage_own_clinic on public.clinic_sites
  for all to authenticated
  using (public.oricse_usuario_pode_permissao(clinica_id, 'administracao.site'))
  with check (public.oricse_usuario_pode_permissao(clinica_id, 'administracao.site'));
