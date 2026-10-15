create or replace function public.oricse_pode_gerenciar_permissoes(p_clinica_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and (
      public.oricse_is_platform_admin()
      or public.oricse_usuario_pode_permissao(p_clinica_id,'administracao.permissoes')
    );
$$;

revoke all on function public.oricse_pode_gerenciar_permissoes(uuid) from public,anon;
grant execute on function public.oricse_pode_gerenciar_permissoes(uuid) to authenticated;
