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

-- O portal e o site só resolvem o hostname depois de ativo e publicado.
-- A consulta mantém compatibilidade com domínios legados, mas nunca expõe um domínio pendente.
create or replace function public.oricse_clinica_publica_portal(
  p_host text default null,
  p_slug text default null
)
returns table(clinica_id uuid, clinica_nome text, clinica_slug text, clinica_logo_url text)
language sql
stable
security definer
set search_path = public
as $$
  with entrada as (
    select
      lower(regexp_replace(split_part(coalesce(p_host, ''), ':', 1), '^www\\.', '')) as host,
      lower(trim(both '/' from coalesce(p_slug, ''))) as slug
  )
  select c.id, c.nome, c.slug, c.logo_url
  from public.clinicas c, entrada e
  where c.status = 'ativa'
    and (
      exists (
        select 1
        from public.oricse_dominios_clinica d
        where d.clinica_id = c.id
          and d.status = 'ativo'
          and d.publicar_site = true
          and lower(regexp_replace(d.hostname, '^www\\.', '')) = e.host
      )
      or (
        e.host <> ''
        and not exists (
          select 1 from public.oricse_dominios_clinica d
          where d.clinica_id = c.id and d.tipo = 'proprio'
        )
        and lower(regexp_replace(coalesce(c.dominio, ''), '^www\\.', '')) = e.host
      )
      or (e.slug <> '' and lower(coalesce(c.slug, '')) = e.slug)
    )
  order by
    case
      when exists (
        select 1
        from public.oricse_dominios_clinica d
        where d.clinica_id = c.id
          and d.status = 'ativo'
          and d.publicar_site = true
          and lower(regexp_replace(d.hostname, '^www\\.', '')) = e.host
      ) then 0
      when e.host <> '' and lower(regexp_replace(coalesce(c.dominio, ''), '^www\\.', '')) = e.host then 1
      else 2
    end
  limit 1
$$;

revoke all on function public.oricse_clinica_publica_portal(text, text) from public;
grant execute on function public.oricse_clinica_publica_portal(text, text) to anon, authenticated;
