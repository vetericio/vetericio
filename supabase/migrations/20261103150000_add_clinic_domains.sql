-- Centraliza os endereços públicos de cada clínica.
-- A publicação real é autorizada somente quando o hostname estiver ativo.

create table public.oricse_dominios_clinica (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  hostname text not null,
  tipo text not null check (tipo in ('oricse', 'proprio')),
  status text not null default 'rascunho'
    check (status in ('rascunho', 'aguardando_dns', 'verificando', 'ativo', 'erro', 'suspenso')),
  principal boolean not null default false,
  publicar_site boolean not null default true,
  dns_alvo text not null default 'sites.oricse.com.br',
  verificacao_tipo text not null default 'automatica'
    check (verificacao_tipo in ('automatica', 'cname', 'txt')),
  verificacao_nome text,
  verificacao_valor text,
  cloudflare_hostname_id text,
  ssl_status text,
  ultimo_erro text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint oricse_dominios_clinica_hostname_normalizado
    check (hostname = lower(btrim(hostname))),
  constraint oricse_dominios_clinica_formato
    check (hostname ~ '^(?=.{3,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.)+[a-z]{2,63}$')
);

create unique index oricse_dominios_clinica_hostname_unico
  on public.oricse_dominios_clinica (lower(hostname));

create unique index oricse_dominios_clinica_um_oricse_por_clinica
  on public.oricse_dominios_clinica (clinica_id)
  where tipo = 'oricse';

create index oricse_dominios_clinica_clinica_idx
  on public.oricse_dominios_clinica (clinica_id);

alter table public.oricse_dominios_clinica enable row level security;

revoke all on table public.oricse_dominios_clinica from public, anon;
grant select, insert, update, delete on table public.oricse_dominios_clinica to authenticated;

create policy oricse_dominios_clinica_admin
  on public.oricse_dominios_clinica
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.app_users u
      where u.user_id = auth.uid() and u.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.app_users u
      where u.user_id = auth.uid() and u.role = 'admin'
    )
  );

-- Prepara os subdomínios das clínicas existentes sem expô-los antes da ativação da infraestrutura.
insert into public.oricse_dominios_clinica (
  clinica_id, hostname, tipo, status, principal, publicar_site, dns_alvo, verificacao_tipo
)
select
  c.id,
  lower(c.slug) || '.oricse.com.br',
  'oricse',
  'rascunho',
  true,
  true,
  'sites.oricse.com.br',
  'automatica'
from public.clinicas c
where coalesce(btrim(c.slug), '') <> '';

-- A resolução pública é segura: só devolve dados mínimos quando o domínio está ativo e publicado.
create function public.oricse_resolver_site_publico(p_hostname text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'clinica_id', c.id,
    'nome', c.nome,
    'slug', c.slug,
    'tipo_publico', c.tipo_publico,
    'logo_url', c.logo_url,
    'hostname', d.hostname
  )
  from public.oricse_dominios_clinica d
  join public.clinicas c on c.id = d.clinica_id
  where d.hostname = lower(btrim(p_hostname))
    and d.status = 'ativo'
    and d.publicar_site = true
    and c.status = 'ativa'
  limit 1;
$$;

revoke all on function public.oricse_resolver_site_publico(text) from public;
grant execute on function public.oricse_resolver_site_publico(text) to anon, authenticated;
