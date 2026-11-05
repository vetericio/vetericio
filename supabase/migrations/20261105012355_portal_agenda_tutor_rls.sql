-- Permite que o tutor veja no Portal também os agendamentos criados pela Recepção e pela agenda interna.
-- A associação continua limitada ao mesmo tutor e à mesma clínica.
drop policy if exists agendamento_tutor_ler on public.oricse_agendamentos_online;

create policy agendamento_tutor_ler
on public.oricse_agendamentos_online
for select
to authenticated
using (
  public.oricse_portal_pode_acessar_clinica(clinica_id)
  and (
    tutor_auth_id = (select auth.uid())
    or exists (
      select 1
      from public.oricse_portal_tutores pt
      where pt.auth_user_id = (select auth.uid())
        and pt.tutor_id = oricse_agendamentos_online.tutor_id
        and pt.clinica_id = oricse_agendamentos_online.clinica_id
        and pt.ativo = true
    )
  )
);
