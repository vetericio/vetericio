drop policy if exists oricse_animais_equipe_ler on public.oricse_animais;
create policy oricse_animais_equipe_ler on public.oricse_animais
for select to authenticated
using (public.oricse_usuario_pode_permissao(clinica_id,'recepcao.cadastros.visualizar'));

drop policy if exists oricse_animais_equipe_criar on public.oricse_animais;
create policy oricse_animais_equipe_criar on public.oricse_animais
for insert to authenticated
with check (public.oricse_usuario_pode_permissao(clinica_id,'recepcao.cadastros.criar'));

drop policy if exists oricse_animais_equipe_editar on public.oricse_animais;
create policy oricse_animais_equipe_editar on public.oricse_animais
for update to authenticated
using (public.oricse_usuario_pode_permissao(clinica_id,'recepcao.cadastros.editar'))
with check (public.oricse_usuario_pode_permissao(clinica_id,'recepcao.cadastros.editar'));

drop policy if exists oricse_animais_equipe_excluir on public.oricse_animais;
create policy oricse_animais_equipe_excluir on public.oricse_animais
for delete to authenticated
using (public.oricse_usuario_pode_permissao(clinica_id,'recepcao.cadastros.excluir'));

drop policy if exists oricse_animais_tutor_ler on public.oricse_animais;
create policy oricse_animais_tutor_ler on public.oricse_animais
for select to authenticated
using (
  exists(
    select 1 from public.oricse_portal_tutores pt
    where pt.auth_user_id=(select auth.uid()) and pt.ativo=true
      and pt.clinica_id=oricse_animais.clinica_id
      and pt.tutor_id=oricse_animais.tutor_id
  )
);

drop policy if exists oricse_portal_tutores_ler on public.oricse_portal_tutores;
create policy oricse_portal_tutores_ler on public.oricse_portal_tutores
for select to authenticated
using (
  auth_user_id=(select auth.uid())
  or public.oricse_usuario_pode_permissao(clinica_id,'recepcao.cadastros.visualizar')
);

drop policy if exists oricse_portal_convites_equipe_ler on public.oricse_portal_convites;
create policy oricse_portal_convites_equipe_ler on public.oricse_portal_convites
for select to authenticated
using (public.oricse_usuario_pode_permissao(clinica_id,'recepcao.cadastros.visualizar'));

drop policy if exists oricse_portal_vacinas_ler on public.oricse_portal_vacinas;
create policy oricse_portal_vacinas_ler on public.oricse_portal_vacinas
for select to authenticated
using (
  public.oricse_usuario_pode_permissao(clinica_id,'consultorio.atendimentos')
  or exists(
    select 1
    from public.oricse_animais a
    join public.oricse_portal_tutores pt
      on pt.clinica_id=a.clinica_id and pt.tutor_id=a.tutor_id
    where a.id=oricse_portal_vacinas.animal_id
      and a.clinica_id=oricse_portal_vacinas.clinica_id
      and pt.auth_user_id=(select auth.uid()) and pt.ativo=true
      and oricse_portal_vacinas.visivel_tutor=true
  )
);

drop policy if exists oricse_portal_vacinas_equipe_gerenciar on public.oricse_portal_vacinas;
create policy oricse_portal_vacinas_equipe_gerenciar on public.oricse_portal_vacinas
for all to authenticated
using (public.oricse_usuario_pode_permissao(clinica_id,'consultorio.atendimentos'))
with check (public.oricse_usuario_pode_permissao(clinica_id,'consultorio.atendimentos'));

drop policy if exists oricse_portal_documentos_ler on public.oricse_portal_documentos;
create policy oricse_portal_documentos_ler on public.oricse_portal_documentos
for select to authenticated
using (
  public.oricse_usuario_pode_permissao(clinica_id,'consultorio.atendimentos')
  or exists(
    select 1
    from public.oricse_animais a
    join public.oricse_portal_tutores pt
      on pt.clinica_id=a.clinica_id and pt.tutor_id=a.tutor_id
    where a.id=oricse_portal_documentos.animal_id
      and a.clinica_id=oricse_portal_documentos.clinica_id
      and pt.auth_user_id=(select auth.uid()) and pt.ativo=true
      and oricse_portal_documentos.visivel_tutor=true
  )
);

drop policy if exists oricse_portal_documentos_equipe_gerenciar on public.oricse_portal_documentos;
create policy oricse_portal_documentos_equipe_gerenciar on public.oricse_portal_documentos
for all to authenticated
using (public.oricse_usuario_pode_permissao(clinica_id,'consultorio.atendimentos'))
with check (public.oricse_usuario_pode_permissao(clinica_id,'consultorio.atendimentos'));

drop policy if exists agendamento_tutor_ler on public.oricse_agendamentos_online;
create policy agendamento_tutor_ler on public.oricse_agendamentos_online
for select to authenticated
using (tutor_auth_id=(select auth.uid()));

drop policy if exists agendamento_equipe_criar on public.oricse_agendamentos_online;
create policy agendamento_equipe_criar on public.oricse_agendamentos_online
for insert to authenticated
with check (
  public.oricse_usuario_pode_permissao(clinica_id,'recepcao.agenda')
  and exists(
    select 1 from public.oricse_agendas_online a
    where a.id=agenda_id and a.clinica_id=oricse_agendamentos_online.clinica_id
  )
);

grant select,insert,update,delete on public.oricse_animais to authenticated;
grant select on public.oricse_portal_tutores to authenticated;
grant select on public.oricse_portal_convites to authenticated;
grant select,insert,update,delete on public.oricse_portal_vacinas to authenticated;
grant select,insert,update,delete on public.oricse_portal_documentos to authenticated;
grant select,insert,update on public.oricse_agendamentos_online to authenticated;

revoke all on public.oricse_animais from anon;
revoke all on public.oricse_portal_tutores from anon;
revoke all on public.oricse_portal_convites from anon;
revoke all on public.oricse_portal_vacinas from anon;
revoke all on public.oricse_portal_documentos from anon;
