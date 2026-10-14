create table if not exists public.oricse_catalogo_itens (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  tipo text not null check (tipo in ('servico', 'produto')),
  nome text not null check (length(trim(nome)) between 1 and 120),
  categoria text not null default '',
  valor numeric(12,2) not null check (valor >= 0),
  estoque_atual numeric(12,3),
  estoque_minimo numeric(12,3),
  ativo boolean not null default true,
  criado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinica_id, id),
  check (
    (tipo = 'produto' and (estoque_atual is null or estoque_atual >= 0)
      and (estoque_minimo is null or estoque_minimo >= 0))
    or (tipo = 'servico' and estoque_atual is null and estoque_minimo is null)
  )
);

create index if not exists oricse_catalogo_clinica_tipo_idx
  on public.oricse_catalogo_itens (clinica_id, tipo, ativo, nome);

create table if not exists public.oricse_regras_comissao (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  item_id uuid,
  dia_semana smallint check (dia_semana between 0 and 6),
  percentual numeric(5,2) not null check (percentual between 0 and 100),
  criado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (clinica_id, item_id)
    references public.oricse_catalogo_itens(clinica_id, id) on delete cascade
);

create unique index if not exists oricse_regras_comissao_unica_idx
  on public.oricse_regras_comissao (
    clinica_id,
    coalesce(item_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(dia_semana, -1)
  );

create table if not exists public.oricse_remuneracao_funcionario (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  funcionario_id uuid not null,
  servico_id uuid not null,
  percentual numeric(5,2) not null check (percentual between 0 and 100),
  criado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (clinica_id, funcionario_id)
    references public.clinica_usuarios(clinica_id, user_id) on delete cascade,
  foreign key (clinica_id, servico_id)
    references public.oricse_catalogo_itens(clinica_id, id) on delete cascade,
  unique (clinica_id, funcionario_id, servico_id)
);

create index if not exists oricse_remuneracao_funcionario_idx
  on public.oricse_remuneracao_funcionario (clinica_id, funcionario_id);

create or replace function public.oricse_pode_editar_configuracoes_clinica(p_clinica_id uuid)
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
        and cu.papel in ('responsavel', 'admin_clinica', 'rt', 'recepcao')
    )
    or exists (
      select 1
      from public.app_users au
      where au.user_id = auth.uid() and au.role = 'admin'
    )
$$;

alter table public.oricse_catalogo_itens enable row level security;
alter table public.oricse_regras_comissao enable row level security;
alter table public.oricse_remuneracao_funcionario enable row level security;

create policy oricse_catalogo_leitura_clinica
  on public.oricse_catalogo_itens for select to authenticated
  using (public.oricse_usuario_na_clinica(clinica_id));
create policy oricse_catalogo_edicao_clinica
  on public.oricse_catalogo_itens for all to authenticated
  using (public.oricse_pode_editar_configuracoes_clinica(clinica_id))
  with check (public.oricse_pode_editar_configuracoes_clinica(clinica_id));

create policy oricse_comissoes_leitura_clinica
  on public.oricse_regras_comissao for select to authenticated
  using (public.oricse_usuario_na_clinica(clinica_id));
create policy oricse_comissoes_edicao_clinica
  on public.oricse_regras_comissao for all to authenticated
  using (public.oricse_pode_editar_configuracoes_clinica(clinica_id))
  with check (public.oricse_pode_editar_configuracoes_clinica(clinica_id));

create policy oricse_remuneracao_leitura_clinica
  on public.oricse_remuneracao_funcionario for select to authenticated
  using (
    public.oricse_pode_editar_configuracoes_clinica(clinica_id)
    or funcionario_id = auth.uid()
  );
create policy oricse_remuneracao_edicao_clinica
  on public.oricse_remuneracao_funcionario for all to authenticated
  using (public.oricse_pode_editar_configuracoes_clinica(clinica_id))
  with check (public.oricse_pode_editar_configuracoes_clinica(clinica_id));

grant select, insert, update, delete on public.oricse_catalogo_itens to authenticated;
grant select, insert, update, delete on public.oricse_regras_comissao to authenticated;
grant select, insert, update, delete on public.oricse_remuneracao_funcionario to authenticated;
grant execute on function public.oricse_pode_editar_configuracoes_clinica(uuid) to authenticated;
