-- Piloto da Gestão de Clientes: acesso limitado à clínica Veterício.
-- A proteção fica na função usada pelas policies/RPCs, não apenas no menu.
create or replace function public.oricse_usuario_pode_permissao(p_clinica_id uuid,p_codigo text)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select
    (
      p_codigo !~ '^crm\\.'
      or exists (
        select 1
        from public.clinicas c
        where c.id = p_clinica_id
          and c.slug = 'vetericio'
      )
    )
    and (
      public.oricse_is_platform_admin()
      or (
        public.oricse_acesso_administrativo_liberado(p_clinica_id)
        and exists (
          select 1
          from public.clinica_usuarios cu
          join public.oricse_permissoes p on p.codigo=p_codigo and p.ativo=true
          where cu.clinica_id=p_clinica_id
            and cu.user_id=(select auth.uid())
            and cu.ativo=true
            and (
              p.funcionalidade_codigo is null
              or public.oricse_plano_permite(p_clinica_id,p.funcionalidade_codigo)
            )
            and coalesce(
              (select pu.permitido from public.oricse_permissoes_usuario pu
               where pu.clinica_id=p_clinica_id and pu.user_id=(select auth.uid())
                 and pu.permissao_codigo=p_codigo),
              (select pp.permitido from public.oricse_permissoes_papel pp
               where pp.papel=cu.papel and pp.permissao_codigo=p_codigo),
              false
            )
        )
      )
    );
$$;
