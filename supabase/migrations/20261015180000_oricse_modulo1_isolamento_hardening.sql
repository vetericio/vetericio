-- Oricse — Módulo 1: isolamento entre clínicas e endurecimento de permissões.
-- Esta migração consolida no repositório as correções já validadas no banco de produção.

-- A matriz já existia nos ambientes legados, mas faltava na sequência
-- versionada. Ela precisa existir antes de oricse_plano_permite ser definida.
create table if not exists public.oricse_funcionalidades (
  codigo text primary key,
  nome text not null,
  grupo text not null,
  ordem integer not null default 0,
  ativo boolean not null default true
);

alter table public.oricse_funcionalidades enable row level security;

grant select on public.oricse_funcionalidades to anon, authenticated;
grant insert, update, delete on public.oricse_funcionalidades to authenticated;

drop policy if exists "public_read_oricse_funcionalidades" on public.oricse_funcionalidades;
create policy "public_read_oricse_funcionalidades"
  on public.oricse_funcionalidades for select
  to anon, authenticated
  using (true);

drop policy if exists "platform_admin_manage_oricse_funcionalidades" on public.oricse_funcionalidades;
create policy "platform_admin_manage_oricse_funcionalidades"
  on public.oricse_funcionalidades for all
  to authenticated
  using (public.oricse_is_platform_admin())
  with check (public.oricse_is_platform_admin());

insert into public.oricse_funcionalidades (codigo, nome, grupo, ordem, ativo) values
  ('atividade.ponto','Registro de atividade e ponto','Atividade',10,true),
  ('recepcao.agenda','Agenda e fila de espera','Recepção',20,true),
  ('recepcao.cadastros','Cadastro de tutores e animais','Recepção',21,true),
  ('consultorio.atendimentos','Consultas e prontuários','Consultório',30,true),
  ('consultorio.medicacoes','Calculadora de medicações','Consultório',31,true),
  ('consultorio.receituario','Receituário','Consultório',32,true),
  ('internacao.painel','Painel de internação','Internação',40,true),
  ('internacao.medicacoes','Medicações na internação','Internação',41,true),
  ('internacao.plantoes','Plantões e histórico','Internação',42,true),
  ('caixa.financeiro','Financeiro e caixa','Caixa',50,true),
  ('caixa.comandas','Comandas','Caixa',51,true),
  ('estoque.catalogo','Catálogo de produtos e serviços','Estoque',60,true),
  ('estoque.movimentar','Movimentações de estoque','Estoque',61,true),
  ('equipe.pagamentos','Pagamento da equipe','Equipe',70,true),
  ('administracao.site','Site da clínica','Administração',80,true),
  ('administracao.temas','Temas','Administração',81,true)
on conflict (codigo) do nothing;

create table if not exists public.oricse_plano_funcionalidades (
  plano_id uuid not null references public.oricse_planos(id) on update cascade on delete cascade,
  funcionalidade_codigo text not null references public.oricse_funcionalidades(codigo) on update cascade on delete cascade,
  permitido boolean not null default false,
  primary key (plano_id, funcionalidade_codigo)
);

alter table public.oricse_plano_funcionalidades enable row level security;

grant select on public.oricse_plano_funcionalidades to anon, authenticated;
grant insert, update, delete on public.oricse_plano_funcionalidades to authenticated;

drop policy if exists "public_read_oricse_plano_funcionalidades" on public.oricse_plano_funcionalidades;
create policy "public_read_oricse_plano_funcionalidades"
  on public.oricse_plano_funcionalidades for select
  to anon, authenticated
  using (true);

drop policy if exists "platform_admin_manage_oricse_plano_funcionalidades" on public.oricse_plano_funcionalidades;
create policy "platform_admin_manage_oricse_plano_funcionalidades"
  on public.oricse_plano_funcionalidades for all
  to authenticated
  using (public.oricse_is_platform_admin())
  with check (public.oricse_is_platform_admin());

-- Termos e aceites também já existiam nos ambientes legados. Declarar os
-- dois lados aqui permite criar um ambiente novo sem depender de objetos
-- criados manualmente no passado.
create table if not exists public.oricse_termos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  versao text not null,
  conteudo text not null,
  obrigatorio boolean not null default true,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  unique (titulo, versao)
);

create table if not exists public.oricse_termos_aceites (
  termo_id uuid not null references public.oricse_termos(id) on delete cascade,
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  aceito_em timestamptz not null default now(),
  primary key (termo_id, clinica_id, usuario_id)
);

alter table public.oricse_termos enable row level security;
alter table public.oricse_termos_aceites enable row level security;

grant select on public.oricse_termos to anon, authenticated;
grant select, insert on public.oricse_termos_aceites to authenticated;

drop policy if exists "public_read_active_oricse_termos" on public.oricse_termos;
create policy "public_read_active_oricse_termos"
  on public.oricse_termos for select
  to anon, authenticated
  using (ativo);

drop policy if exists "platform_admin_manage_oricse_termos" on public.oricse_termos;
create policy "platform_admin_manage_oricse_termos"
  on public.oricse_termos for all
  to authenticated
  using (public.oricse_is_platform_admin())
  with check (public.oricse_is_platform_admin());

-- Lançamentos de remuneração já eram utilizados por funções existentes, mas
-- faltavam no histórico de schema. A chave composta garante que um item de
-- catálogo nunca seja associado a outra clínica.
create table if not exists public.oricse_pagamento_lancamentos (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  funcionario_id uuid not null,
  catalogo_item_id uuid references public.oricse_catalogo_itens(id) on delete set null,
  tipo text not null,
  descricao text not null,
  valor numeric(12,2) not null,
  quantidade numeric(12,3) not null default 1,
  data date not null default current_date,
  hora_inicio time,
  hora_fim time,
  criado_por uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (clinica_id, id)
);

-- Estruturas da jornada: o backend do módulo 2 as utiliza para registrar ponto.
-- Mantê-las aqui garante que uma instalação nova tenha a mesma base do ambiente existente.
create table if not exists public.oricse_jornada_config (
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  funcionario_id uuid not null references auth.users(id) on delete cascade,
  modalidade text not null check (modalidade in ('hora', 'diaria')),
  valor_unitario numeric(12, 2) not null check (valor_unitario >= 0),
  atualizado_em timestamptz not null default now(),
  primary key (clinica_id, funcionario_id)
);

create table if not exists public.oricse_jornada_registros (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  funcionario_id uuid not null references auth.users(id) on delete cascade,
  modalidade text not null check (modalidade in ('hora', 'diaria')),
  data date not null default current_date,
  valor_unitario numeric(12, 2) not null check (valor_unitario >= 0),
  estado text not null check (estado in ('ativa', 'pausada', 'finalizada', 'diaria')),
  segundos_trabalhados integer not null default 0 check (segundos_trabalhados >= 0),
  iniciado_em timestamptz not null default now(),
  ultimo_inicio_em timestamptz,
  finalizado_em timestamptz,
  criado_em timestamptz not null default now()
);

create index if not exists oricse_jornada_registros_clinica_funcionario_estado_idx
  on public.oricse_jornada_registros(clinica_id, funcionario_id, estado);

alter table public.oricse_jornada_config enable row level security;
alter table public.oricse_jornada_registros enable row level security;

-- Agenda online já era consumida pelas políticas do módulo 2, mas a definição
-- não estava em nenhuma migration. Esta base precede as políticas seguintes.
create table if not exists public.oricse_agendas_online (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  nome text not null,
  responsavel text not null default '',
  inicio time not null default '08:00',
  fim time not null default '18:00',
  dias_semana integer[] not null default array[1, 2, 3, 4, 5],
  intervalo_min integer not null default 30 check (intervalo_min > 0),
  modalidade text not null default 'gratuita',
  antecedencia_horas integer not null default 1 check (antecedencia_horas >= 0),
  portal_ativo boolean not null default false,
  pagamento_valor numeric(12, 2),
  pagamento_modo_valor text,
  pagamento_descricao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.oricse_agendas_online enable row level security;

create table if not exists public.oricse_agendamentos_online (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  agenda_id uuid not null references public.oricse_agendas_online(id) on delete restrict,
  tutor_auth_id uuid references auth.users(id) on delete set null,
  tutor_id uuid,
  animal_id uuid,
  animal_referencia text not null default '',
  tipo text not null default 'consulta',
  inicio timestamptz not null,
  fim timestamptz not null,
  estado text not null default 'pendente',
  origem text not null default 'portal',
  dados jsonb not null default '{}'::jsonb,
  observacoes text,
  pagamento_confirmado_em timestamptz,
  criado_em timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (fim > inicio)
);

create index if not exists oricse_agendamentos_online_clinica_inicio_idx
  on public.oricse_agendamentos_online(clinica_id, inicio);

alter table public.oricse_agendamentos_online enable row level security;

-- Compatibilidade da tela administrativa antiga. A tabela continua restrita
-- ao administrador da plataforma e é sincronizada à matriz nova no módulo 4.
create table if not exists public.oricse_clinica_autorizacoes (
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  funcionalidade_codigo text not null references public.oricse_funcionalidades(codigo) on delete cascade,
  decisao text not null check (decisao in ('permitir', 'bloquear')),
  motivo text,
  atualizado_por uuid references auth.users(id) on delete set null,
  atualizado_em timestamptz not null default now(),
  primary key (clinica_id, funcionalidade_codigo)
);

alter table public.oricse_clinica_autorizacoes enable row level security;

drop policy if exists oricse_clinica_autorizacoes_admin on public.oricse_clinica_autorizacoes;
create policy oricse_clinica_autorizacoes_admin
on public.oricse_clinica_autorizacoes
for all to authenticated
using (public.oricse_is_platform_admin())
with check (public.oricse_is_platform_admin());

-- Seleção persistente da clínica ativa por usuário. Diversas telas usam estas
-- funções; a ausência da migration original impedia a criação de uma base nova.
create table if not exists public.oricse_clinica_ativa_usuario (
  user_id uuid primary key references auth.users(id) on delete cascade,
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  updated_at timestamptz not null default now()
);

alter table public.oricse_clinica_ativa_usuario enable row level security;

create or replace function public.oricse_clinica_ativa_obter()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select a.clinica_id
  from public.oricse_clinica_ativa_usuario a
  where a.user_id = (select auth.uid())
    and (
      public.oricse_is_platform_admin()
      or exists (
        select 1 from public.clinica_usuarios cu
        where cu.clinica_id = a.clinica_id
          and cu.user_id = (select auth.uid())
          and cu.ativo
      )
    )
$$;

create or replace function public.oricse_clinica_ativa_definir(p_clinica uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Sessão inválida' using errcode = '42501';
  end if;

  if not public.oricse_is_platform_admin()
     and not public.oricse_usuario_na_clinica(p_clinica) then
    raise exception 'Sem acesso à clínica selecionada' using errcode = '42501';
  end if;

  insert into public.oricse_clinica_ativa_usuario(user_id, clinica_id, updated_at)
  values ((select auth.uid()), p_clinica, now())
  on conflict (user_id) do update
    set clinica_id = excluded.clinica_id,
        updated_at = excluded.updated_at;

  return p_clinica;
end;
$$;

revoke all on function public.oricse_clinica_ativa_obter() from public, anon;
revoke all on function public.oricse_clinica_ativa_definir(uuid) from public, anon;
grant execute on function public.oricse_clinica_ativa_obter() to authenticated;
grant execute on function public.oricse_clinica_ativa_definir(uuid) to authenticated;

alter table public.oricse_pagamento_lancamentos enable row level security;

grant select, insert, update, delete on public.oricse_pagamento_lancamentos to authenticated;

drop policy if exists "oricse_pagamento_lancamentos_clinica" on public.oricse_pagamento_lancamentos;
create policy "oricse_pagamento_lancamentos_clinica"
  on public.oricse_pagamento_lancamentos for all
  to authenticated
  using (public.oricse_usuario_na_clinica(clinica_id))
  with check (public.oricse_usuario_na_clinica(clinica_id));

create or replace function public.is_active_admin(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select _user_id is not null
    and _user_id = (select auth.uid())
    and public.oricse_is_platform_admin();
$$;

revoke all on function public.is_active_admin(uuid) from public, anon;
grant execute on function public.is_active_admin(uuid) to authenticated;

create or replace function public.oricse_pode_excluir_tutor(p_clinica_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and public.oricse_usuario_na_clinica(p_clinica_id)
    and (
      public.oricse_is_platform_admin()
      or exists (
        select 1
        from public.clinica_usuarios cu
        where cu.clinica_id = p_clinica_id
          and cu.user_id = (select auth.uid())
          and cu.ativo
          and cu.papel in ('responsavel', 'admin_clinica', 'rt')
      )
    );
$$;

revoke all on function public.oricse_pode_excluir_tutor(uuid) from public, anon;
grant execute on function public.oricse_pode_excluir_tutor(uuid) to authenticated;

create or replace function public.oricse_pode_editar_configuracoes_clinica(p_clinica_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and public.oricse_usuario_na_clinica(p_clinica_id)
    and (
      public.oricse_is_platform_admin()
      or exists (
        select 1
        from public.clinica_usuarios cu
        where cu.clinica_id = p_clinica_id
          and cu.user_id = (select auth.uid())
          and cu.ativo
          and cu.papel in ('responsavel', 'admin_clinica', 'rt')
      )
    );
$$;

revoke all on function public.oricse_pode_editar_configuracoes_clinica(uuid) from public, anon;
grant execute on function public.oricse_pode_editar_configuracoes_clinica(uuid) to authenticated;

create or replace function public.oricse_plano_permite(p_clinica_id uuid, p_codigo text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and public.oricse_usuario_na_clinica(p_clinica_id)
    and (
      public.oricse_is_platform_admin()
      or exists (
        select 1
        from public.clinicas c
        join public.oricse_planos p
          on (p.codigo = c.plano or p.nome = c.plano)
        join public.oricse_plano_funcionalidades pf
          on pf.plano_id = p.id
        join public.oricse_funcionalidades f
          on f.codigo = pf.funcionalidade_codigo
        where c.id = p_clinica_id
          and c.status = 'ativa'
          and p.ativo
          and f.ativo
          and pf.permitido
          and f.codigo = p_codigo
      )
    );
$$;

revoke all on function public.oricse_plano_permite(uuid, text) from public, anon;
grant execute on function public.oricse_plano_permite(uuid, text) to authenticated;

-- Tutores: leitura/escrita somente na própria clínica; exclusão apenas para funções de gestão.
drop policy if exists tutores_delete_minha_clinica on public.tutores;
create policy tutores_delete_minha_clinica
  on public.tutores for delete to authenticated
  using (public.oricse_pode_excluir_tutor(clinica_id));

-- Catálogo legado: gestão somente por responsáveis/admin da clínica/RT.
drop policy if exists "catalogo gestao da propria clinica" on public.clinica_catalogo_itens;
create policy "catalogo gestao da propria clinica"
  on public.clinica_catalogo_itens for all to authenticated
  using (public.oricse_pode_editar_configuracoes_clinica(clinica_id))
  with check (public.oricse_pode_editar_configuracoes_clinica(clinica_id));

-- Aceites: o usuário só registra e lê o próprio aceite na clínica ativa.
drop policy if exists aceites_inserir on public.oricse_termos_aceites;
create policy aceites_inserir
  on public.oricse_termos_aceites for insert to authenticated
  with check (
    usuario_id = (select auth.uid())
    and public.oricse_usuario_na_clinica(clinica_id)
  );

drop policy if exists aceites_ler on public.oricse_termos_aceites;
create policy aceites_ler
  on public.oricse_termos_aceites for select to authenticated
  using (
    public.oricse_is_platform_admin()
    or (
      usuario_id = (select auth.uid())
      and public.oricse_usuario_na_clinica(clinica_id)
    )
  );

-- Remuneração: vínculo histórico/inativo não pode manter leitura de outra clínica.
drop policy if exists oricse_remuneracao_leitura_clinica on public.oricse_remuneracao_funcionario;
create policy oricse_remuneracao_leitura_clinica
  on public.oricse_remuneracao_funcionario for select to authenticated
  using (
    public.oricse_pode_editar_configuracoes_clinica(clinica_id)
    or (
      funcionario_id = (select auth.uid())
      and exists (
        select 1
        from public.clinica_usuarios cu
        where cu.clinica_id = oricse_remuneracao_funcionario.clinica_id
          and cu.user_id = (select auth.uid())
          and cu.ativo = true
      )
    )
  );

-- Integridade: um lançamento financeiro não pode apontar para item de outra clínica.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.oricse_pagamento_lancamentos'::regclass
      and conname = 'oricse_pagamento_item_mesma_clinica_fkey'
  ) then
    alter table public.oricse_pagamento_lancamentos
      add constraint oricse_pagamento_item_mesma_clinica_fkey
      foreign key (clinica_id, catalogo_item_id)
      references public.oricse_catalogo_itens(clinica_id, id);
  end if;
end $$;

-- Drive: duas clínicas não podem compartilhar a mesma raiz nem registrar o mesmo arquivo.
create unique index if not exists clinica_drive_config_root_folder_unique
  on public.clinica_drive_config(root_folder_id)
  where root_folder_id is not null;

create unique index if not exists drive_arquivos_drive_file_unique
  on public.drive_arquivos(drive_file_id)
  where drive_file_id is not null;

-- Funções internas SECURITY DEFINER não ficam expostas ao acesso anônimo.
do $$
declare
  assinatura text;
begin
  foreach assinatura in array array[
    'public.oricse_my_clinic_context()',
    'public.oricse_pode_gerenciar_pagamentos(uuid)',
    'public.oricse_registrar_atividade(uuid,text)',
    'public.oricse_tem_funcionalidade(uuid,text)',
    'public.oricse_verificar_funcionalidade(uuid,text)'
  ] loop
    if to_regprocedure(assinatura) is not null then
      execute format('revoke all on function %s from public, anon', assinatura);
      execute format('grant execute on function %s to authenticated', assinatura);
    end if;
  end loop;

  foreach assinatura in array array[
    'public.oricse_impedir_multiplas_clinicas()',
    'public.oricse_preparar_tutor()'
  ] loop
    if to_regprocedure(assinatura) is not null then
      execute format('revoke all on function %s from public, anon, authenticated', assinatura);
    end if;
  end loop;
end $$;
