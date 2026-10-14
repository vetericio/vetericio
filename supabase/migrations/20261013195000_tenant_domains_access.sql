create or replace function public.oricse_usuario_na_clinica(p_clinica_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from public.clinica_usuarios cu
      where cu.clinica_id = p_clinica_id
        and cu.user_id = auth.uid()
        and cu.ativo = true
        and cu.clinica_id = (
          select membro.clinica_id
          from public.clinica_usuarios membro
          where membro.user_id = auth.uid()
            and membro.ativo = true
          order by membro.created_at, membro.clinica_id
          limit 1
        )
    )
    or exists (
      select 1 from public.app_users au
      where au.user_id = auth.uid() and au.role = 'admin'
    )
$$;

create or replace function public.oricse_impedir_multiplas_clinicas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.ativo and exists (
    select 1
    from public.clinica_usuarios cu
    where cu.user_id = new.user_id
      and cu.ativo = true
      and cu.clinica_id <> new.clinica_id
  ) then
    raise exception 'Este usuário já está vinculado a outra clínica.'
      using errcode = '23505';
  end if;
  return new;
end;
$$;

drop trigger if exists clinica_usuarios_unica_clinica_trg on public.clinica_usuarios;
create trigger clinica_usuarios_unica_clinica_trg
before insert or update of clinica_id, user_id, ativo on public.clinica_usuarios
for each row execute function public.oricse_impedir_multiplas_clinicas();

alter table public.clinica_usuarios
  drop constraint if exists clinica_usuarios_papel_check;
alter table public.clinica_usuarios
  add constraint clinica_usuarios_papel_check
  check (papel in ('responsavel', 'admin_clinica', 'usuario', 'rt', 'veterinario', 'auxiliar_estagiario', 'recepcao'));

alter table public.clinica_usuarios
  drop constraint if exists clinica_usuarios_papel_check;
alter table public.clinica_usuarios
  add constraint clinica_usuarios_papel_check
  check (papel in ('responsavel', 'admin_clinica', 'usuario', 'rt', 'veterinario', 'auxiliar_estagiario', 'recepcao'));

create unique index if not exists clinicas_slug_case_insensitive_idx
  on public.clinicas (lower(slug))
  where slug is not null;

create unique index if not exists clinicas_domain_case_insensitive_idx
  on public.clinicas (lower(regexp_replace(coalesce(dominio, ''), '^www\.', '')))
  where dominio is not null and trim(dominio) <> '';

create or replace function public.oricse_contexto_clinica_atual()
returns table (
  clinica_id uuid,
  clinica_nome text,
  clinica_slug text,
  clinica_dominio text,
  clinica_logo_url text
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.nome, c.slug, c.dominio, c.logo_url
  from public.clinica_usuarios cu
  join public.clinicas c on c.id = cu.clinica_id
  where cu.user_id = auth.uid()
    and cu.ativo = true
    and public.oricse_usuario_na_clinica(cu.clinica_id)
  order by cu.created_at, cu.clinica_id
  limit 1
$$;

create or replace function public.oricse_clinica_publica_portal(
  p_host text default null,
  p_slug text default null
)
returns table (
  clinica_id uuid,
  clinica_nome text,
  clinica_slug text,
  clinica_logo_url text
)
language sql
stable
security definer
set search_path = public
as $$
  with entrada as (
    select
      lower(regexp_replace(split_part(coalesce(p_host, ''), ':', 1), '^www\.', '')) as host,
      lower(trim(both '/' from coalesce(p_slug, ''))) as slug
  )
  select c.id, c.nome, c.slug, c.logo_url
  from public.clinicas c, entrada e
  where c.status = 'ativa'
    and (
      (e.host <> '' and lower(regexp_replace(coalesce(c.dominio, ''), '^www\.', '')) = e.host)
      or (e.slug <> '' and lower(coalesce(c.slug, '')) = e.slug)
    )
  order by
    case
      when e.host <> '' and lower(regexp_replace(coalesce(c.dominio, ''), '^www\.', '')) = e.host then 0
      else 1
    end
  limit 1
$$;

create or replace function public.oricse_usuario_pode_acessar_portal(p_clinica_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1 from public.app_users au
      where au.user_id = auth.uid() and au.role = 'admin'
    )
    or public.oricse_usuario_na_clinica(p_clinica_id)
$$;

create or replace function public.oricse_configurar_site_clinica(
  p_slug text,
  p_dominio text default null
)
returns table (clinica_slug text, clinica_dominio text)
language plpgsql
security definer
set search_path = public
as $$
declare
  minha_clinica uuid;
  slug_normalizado text := lower(trim(both '/' from coalesce(p_slug, '')));
  dominio_normalizado text := nullif(lower(trim(coalesce(p_dominio, ''))), '');
begin
  select c.id into minha_clinica
  from public.clinica_usuarios cu
  join public.clinicas c on c.id = cu.clinica_id
  where cu.user_id = auth.uid()
    and cu.ativo = true
    and cu.clinica_id = (
      select membro.clinica_id
      from public.clinica_usuarios membro
      where membro.user_id = auth.uid()
        and membro.ativo = true
      order by membro.created_at, membro.clinica_id
      limit 1
    )
    and cu.papel in ('responsavel', 'admin_clinica', 'rt')
  order by cu.created_at, cu.clinica_id
  limit 1;

  if minha_clinica is null then
    raise exception 'Somente o responsável da clínica ou o RT pode configurar o site.'
      using errcode = '42501';
  end if;

  if slug_normalizado !~ '^[a-z0-9]+([a-z0-9-]{0,61}[a-z0-9])?$' then
    raise exception 'O link público deve conter apenas letras, números e hífens.'
      using errcode = '22023';
  end if;

  if dominio_normalizado is not null then
    dominio_normalizado := regexp_replace(dominio_normalizado, '^https?://', '');
    dominio_normalizado := split_part(dominio_normalizado, '/', 1);
    if dominio_normalizado !~ '^[a-z0-9]([a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$'
       or dominio_normalizado ~ '\.\.' then
      raise exception 'Informe apenas o domínio, por exemplo clinica.com.br.'
        using errcode = '22023';
    end if;
    if exists (
      select 1 from public.clinicas c
      where c.id <> minha_clinica
        and lower(regexp_replace(coalesce(c.dominio, ''), '^www\.', '')) =
          lower(regexp_replace(dominio_normalizado, '^www\.', ''))
    ) then
      raise exception 'Este domínio já está vinculado a outra clínica.'
        using errcode = '23505';
    end if;
  end if;

  if exists (
    select 1 from public.clinicas c
    where c.id <> minha_clinica and lower(coalesce(c.slug, '')) = slug_normalizado
  ) then
    raise exception 'Este link público já está em uso.'
      using errcode = '23505';
  end if;

  update public.clinicas c
  set slug = slug_normalizado,
      dominio = dominio_normalizado,
      updated_at = now()
  where c.id = minha_clinica;

  return query select slug_normalizado, dominio_normalizado;
end;
$$;

revoke all on function public.oricse_clinica_publica_portal(text, text) from public;
revoke all on function public.oricse_contexto_clinica_atual() from public, anon;
revoke all on function public.oricse_usuario_pode_acessar_portal(uuid) from public, anon;
revoke all on function public.oricse_configurar_site_clinica(text, text) from public, anon;
revoke all on function public.oricse_usuario_na_clinica(uuid) from public, anon;
grant execute on function public.oricse_clinica_publica_portal(text, text) to anon, authenticated;
grant execute on function public.oricse_contexto_clinica_atual() to authenticated;
grant execute on function public.oricse_usuario_pode_acessar_portal(uuid) to authenticated;
grant execute on function public.oricse_configurar_site_clinica(text, text) to authenticated;
grant execute on function public.oricse_usuario_na_clinica(uuid) to authenticated;
