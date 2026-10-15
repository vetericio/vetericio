alter table public.oricse_crm_eventos
  drop constraint if exists oricse_crm_eventos_tutor_mesma_clinica_fkey;

alter table public.oricse_crm_eventos
  add constraint oricse_crm_eventos_tutor_fkey
  foreign key (tutor_id) references public.tutores(id) on delete set null;

drop policy if exists crm_eventos_operar on public.oricse_crm_eventos;
create policy crm_eventos_operar on public.oricse_crm_eventos for all to authenticated
using (
  public.oricse_usuario_pode_permissao(clinica_id,'crm.enviar')
  or public.oricse_usuario_pode_permissao(clinica_id,'crm.gerenciar')
)
with check (
  (
    public.oricse_usuario_pode_permissao(clinica_id,'crm.enviar')
    or public.oricse_usuario_pode_permissao(clinica_id,'crm.gerenciar')
  )
  and (
    tutor_id is null
    or exists (
      select 1 from public.tutores t
      where t.id = tutor_id and t.clinica_id = oricse_crm_eventos.clinica_id
    )
  )
);
