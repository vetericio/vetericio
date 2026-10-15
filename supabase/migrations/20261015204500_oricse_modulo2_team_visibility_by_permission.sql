-- Usuários comuns continuam vendo apenas o próprio vínculo.
-- Quem gerencia usuários/permissões ou pagamentos da equipe pode listar os membros da própria clínica.
drop policy if exists clinica_usuarios_select_self on public.clinica_usuarios;
create policy clinica_usuarios_select_self on public.clinica_usuarios
for select to authenticated
using (
  user_id = (select auth.uid())
  or public.oricse_is_platform_admin()
  or public.oricse_usuario_pode_permissao(clinica_id,'administracao.usuarios')
  or public.oricse_usuario_pode_permissao(clinica_id,'administracao.permissoes')
  or public.oricse_usuario_pode_permissao(clinica_id,'equipe.pagamentos.visualizar')
  or public.oricse_usuario_pode_permissao(clinica_id,'equipe.pagamentos.gerenciar')
);
