-- Módulo 4: planos, bloqueios efetivos e exceções controladas por clínica.

insert into public.oricse_plano_funcionalidades(plano_id, funcionalidade_codigo, permitido)
select p.id, f.codigo, (p.codigo = 'master-equipe')
from public.oricse_planos p
cross join public.oricse_funcionalidades f
where p.ativo = true and f.ativo = true
on conflict (plano_id, funcionalidade_codigo) do nothing;

create table if not exists public.oricse_clinica_funcionalidade_excecoes (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  funcionalidade_codigo text not null references public.oricse_funcionalidades(codigo) on delete cascade,
  permitido boolean not null,
  motivo text not null default '',
  expira_em timestamptz null,
  criado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinica_id, funcionalidade_codigo)
);

create index if not exists oricse_clinica_funcionalidade_excecoes_clinica_idx
  on public.oricse_clinica_funcionalidade_excecoes(clinica_id, funcionalidade_codigo);

alter table public.oricse_clinica_funcionalidade_excecoes enable row level security;

drop policy if exists oricse_clinica_funcionalidade_excecoes_ler on public.oricse_clinica_funcionalidade_excecoes;
create policy oricse_clinica_funcionalidade_excecoes_ler
on public.oricse_clinica_funcionalidade_excecoes
for select to authenticated
using (
  public.oricse_is_platform_admin()
  or public.oricse_usuario_na_clinica(clinica_id)
);

drop policy if exists oricse_clinica_funcionalidade_excecoes_admin on public.oricse_clinica_funcionalidade_excecoes;
create policy oricse_clinica_funcionalidade_excecoes_admin
on public.oricse_clinica_funcionalidade_excecoes
for all to authenticated
using (public.oricse_is_platform_admin())
with check (public.oricse_is_platform_admin());

revoke all on table public.oricse_clinica_funcionalidade_excecoes from anon;
grant select,insert,update,delete on table public.oricse_clinica_funcionalidade_excecoes to authenticated;

create or replace function public.oricse_plano_permite(p_clinica_id uuid, p_codigo text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and (
      public.oricse_is_platform_admin()
      or (
        public.oricse_usuario_na_clinica(p_clinica_id)
        and exists (
          select 1
          from public.clinicas c
          where c.id = p_clinica_id and c.status = 'ativa'
        )
        and coalesce(
          (
            select e.permitido
            from public.oricse_clinica_funcionalidade_excecoes e
            join public.oricse_funcionalidades f on f.codigo=e.funcionalidade_codigo and f.ativo=true
            where e.clinica_id=p_clinica_id
              and e.funcionalidade_codigo=p_codigo
              and (e.expira_em is null or e.expira_em > now())
            limit 1
          ),
          (
            select pf.permitido
            from public.clinicas c
            join public.oricse_planos p on (p.codigo=c.plano or p.nome=c.plano)
            join public.oricse_plano_funcionalidades pf on pf.plano_id=p.id and pf.funcionalidade_codigo=p_codigo
            join public.oricse_funcionalidades f on f.codigo=pf.funcionalidade_codigo
            where c.id=p_clinica_id
              and p.ativo=true
              and f.ativo=true
            limit 1
          ),
          false
        )
      )
    );
$$;

revoke all on function public.oricse_plano_permite(uuid,text) from public, anon;
grant execute on function public.oricse_plano_permite(uuid,text) to authenticated;

create or replace function public.oricse_funcionalidades_efetivas(p_clinica_id uuid)
returns table(
  codigo text,
  nome text,
  grupo text,
  permitido boolean,
  origem text,
  plano_codigo text,
  plano_nome text,
  ordem integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Sessão inválida.' using errcode='42501';
  end if;
  if not public.oricse_is_platform_admin() and not public.oricse_usuario_na_clinica(p_clinica_id) then
    raise exception 'Sem acesso a esta clínica.' using errcode='42501';
  end if;

  return query
  select
    f.codigo,
    f.nome,
    f.grupo,
    case when public.oricse_is_platform_admin() then true else public.oricse_plano_permite(p_clinica_id,f.codigo) end as permitido,
    case
      when public.oricse_is_platform_admin() then 'admin'
      when e.id is not null and (e.expira_em is null or e.expira_em > now()) then 'excecao'
      else 'plano'
    end as origem,
    p.codigo as plano_codigo,
    p.nome as plano_nome,
    f.ordem
  from public.oricse_funcionalidades f
  join public.clinicas c on c.id=p_clinica_id
  left join public.oricse_planos p on (p.codigo=c.plano or p.nome=c.plano)
  left join public.oricse_clinica_funcionalidade_excecoes e
    on e.clinica_id=c.id and e.funcionalidade_codigo=f.codigo
      and (e.expira_em is null or e.expira_em > now())
  where f.ativo=true
  order by f.ordem,f.codigo;
end;
$$;

revoke all on function public.oricse_funcionalidades_efetivas(uuid) from public, anon;
grant execute on function public.oricse_funcionalidades_efetivas(uuid) to authenticated;

create or replace function public.oricse_limite_usuarios_clinica(p_clinica_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(c.limite_usuarios,p.usuarios_inclusos,1)
  from public.clinicas c
  left join public.oricse_planos p on (p.codigo=c.plano or p.nome=c.plano)
  where c.id=p_clinica_id;
$$;

revoke all on function public.oricse_limite_usuarios_clinica(uuid) from public, anon;
grant execute on function public.oricse_limite_usuarios_clinica(uuid) to authenticated;

create or replace function public.oricse_validar_limite_usuarios()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  limite integer;
  ativos integer;
begin
  if not new.ativo then
    return new;
  end if;

  limite := public.oricse_limite_usuarios_clinica(new.clinica_id);
  if limite is null or limite < 1 then
    raise exception 'Plano da clínica sem limite de usuários válido.' using errcode='23514';
  end if;

  select count(*)::integer into ativos
  from public.clinica_usuarios cu
  where cu.clinica_id=new.clinica_id
    and cu.ativo=true
    and cu.user_id<>new.user_id;

  if ativos >= limite then
    raise exception 'Limite de usuários ativos do plano atingido (%).', limite using errcode='23514';
  end if;
  return new;
end;
$$;

drop trigger if exists clinica_usuarios_validar_limite_plano on public.clinica_usuarios;
create trigger clinica_usuarios_validar_limite_plano
before insert or update of clinica_id,user_id,ativo on public.clinica_usuarios
for each row execute function public.oricse_validar_limite_usuarios();

create or replace function public.oricse_preencher_matriz_nova_funcionalidade()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.oricse_plano_funcionalidades(plano_id,funcionalidade_codigo,permitido)
  select p.id,new.codigo,(p.codigo='master-equipe')
  from public.oricse_planos p
  where p.ativo=true
  on conflict (plano_id,funcionalidade_codigo) do nothing;
  return new;
end;
$$;

drop trigger if exists oricse_funcionalidades_preencher_matriz on public.oricse_funcionalidades;
create trigger oricse_funcionalidades_preencher_matriz
after insert on public.oricse_funcionalidades
for each row execute function public.oricse_preencher_matriz_nova_funcionalidade();

create or replace function public.oricse_preencher_matriz_novo_plano()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.oricse_plano_funcionalidades(plano_id,funcionalidade_codigo,permitido)
  select new.id,f.codigo,(new.codigo='master-equipe')
  from public.oricse_funcionalidades f
  where f.ativo=true
  on conflict (plano_id,funcionalidade_codigo) do nothing;
  return new;
end;
$$;

drop trigger if exists oricse_planos_preencher_matriz on public.oricse_planos;
create trigger oricse_planos_preencher_matriz
after insert on public.oricse_planos
for each row execute function public.oricse_preencher_matriz_novo_plano();
