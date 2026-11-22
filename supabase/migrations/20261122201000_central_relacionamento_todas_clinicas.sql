-- Expande a Central de Relacionamento para todas as clínicas.
-- Mantém isolamento por clínica, verificação de usuário, papéis e autenticação.
-- A restrição à clínica piloto foi removida sem permitir acesso anônimo.
begin;

create or replace function public.oricse_usuario_pode_permissao(p_clinica_id uuid,p_codigo text)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select
    (
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


update public.oricse_funcionalidades
set nome='Central de Relacionamento', grupo='Relacionamento'
where codigo='crm.inteligente';

update public.oricse_permissoes
set nome=case codigo
  when 'crm.visualizar' then 'Ver Central de Relacionamento'
  when 'crm.enviar' then 'Operar contatos e retornos'
  when 'crm.gerenciar' then 'Configurar relacionamento'
  when 'crm.campanhas' then 'Criar campanhas de relacionamento'
  when 'crm.automacoes' then 'Gerenciar jornadas de relacionamento'
  else nome end,
  grupo='Relacionamento'
where codigo like 'crm.%';

-- Liberação da funcionalidade em todos os planos, inclusive Solo e Essencial.
-- Não altera cargos, permissões individuais ou exceções de clínicas.
update public.oricse_plano_funcionalidades
set permitido=true
where funcionalidade_codigo='crm.inteligente';

-- Gestor da Veterício confirmou o consentimento de marketing dos tutores
-- existentes em 22/11/2026. Restrito à sua clínica, sem alterar outras.
-- O campo do cadastro permitirá revogação posterior individual.
update public.tutores
set dados=jsonb_set(coalesce(dados,'{}'::jsonb),'{autorizaMarketing}','true'::jsonb,true)
    || jsonb_build_object('registroAutorizacaoMarketing','confirmado_pelo_gestor_2026-11-22'),
    updated_at=now()
where clinica_id=(select id from public.clinicas where slug='vetericio')
  and lower(coalesce(dados->>'autorizaMarketing','false')) <> 'true';

commit;
