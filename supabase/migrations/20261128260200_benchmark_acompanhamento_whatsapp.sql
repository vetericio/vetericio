-- Operator observations, not provider delivery receipts.
create table public.oricse_whatsapp_acompanhamentos (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  evento_id uuid not null references public.oricse_crm_eventos(id) on delete cascade,
  situacao text not null check(situacao in ('entrega_observada','resposta_observada')),
  registrado_por uuid not null default auth.uid(),
  registrado_em timestamptz not null default now(),
  unique (clinica_id,evento_id,situacao)
);
alter table public.oricse_whatsapp_acompanhamentos enable row level security;
revoke all on public.oricse_whatsapp_acompanhamentos from public,anon,authenticated;
grant select on public.oricse_whatsapp_acompanhamentos to authenticated;
grant insert (clinica_id,evento_id,situacao) on public.oricse_whatsapp_acompanhamentos to authenticated;
create policy whatsapp_acompanhamentos_leitura on public.oricse_whatsapp_acompanhamentos for select to authenticated
using (public.oricse_usuario_pode_permissao(clinica_id,'crm.visualizar')
  or public.oricse_usuario_pode_permissao(clinica_id,'crm.enviar')
  or public.oricse_usuario_pode_permissao(clinica_id,'crm.gerenciar'));
create policy whatsapp_acompanhamentos_registro on public.oricse_whatsapp_acompanhamentos for insert to authenticated
with check (registrado_por=(select auth.uid())
  and (public.oricse_usuario_pode_permissao(clinica_id,'crm.enviar') or public.oricse_usuario_pode_permissao(clinica_id,'crm.gerenciar'))
  and exists (
    select 1 from public.oricse_crm_eventos e
    where e.id=oricse_whatsapp_acompanhamentos.evento_id and e.clinica_id=oricse_whatsapp_acompanhamentos.clinica_id
    and e.canal='whatsapp' and e.status='enviado'
  )
);
