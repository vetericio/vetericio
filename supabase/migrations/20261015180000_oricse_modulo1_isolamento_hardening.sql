-- Oricse — Módulo 1: isolamento entre clínicas e endurecimento de permissões.
-- Esta migração consolida no repositório as correções já validadas no banco de produção.

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
revoke all on function public.oricse_my_clinic_context() from public, anon;
grant execute on function public.oricse_my_clinic_context() to authenticated;

revoke all on function public.oricse_pode_gerenciar_pagamentos(uuid) from public, anon;
grant execute on function public.oricse_pode_gerenciar_pagamentos(uuid) to authenticated;

revoke all on function public.oricse_registrar_atividade(uuid, text) from public, anon;
grant execute on function public.oricse_registrar_atividade(uuid, text) to authenticated;

revoke all on function public.oricse_tem_funcionalidade(uuid, text) from public, anon;
grant execute on function public.oricse_tem_funcionalidade(uuid, text) to authenticated;

revoke all on function public.oricse_verificar_funcionalidade(uuid, text) from public, anon;
grant execute on function public.oricse_verificar_funcionalidade(uuid, text) to authenticated;

revoke all on function public.oricse_impedir_multiplas_clinicas() from public, anon, authenticated;
revoke all on function public.oricse_preparar_tutor() from public, anon, authenticated;
