create table if not exists public.oricse_portal_vermifugos (
 id uuid primary key default gen_random_uuid(),
 clinica_id uuid not null references public.clinicas(id) on delete cascade,
 animal_id uuid not null,
 nome text not null,
 administrado_em date,
 proxima_dose_em date,
 lote text,
 observacoes text,
 visivel_tutor boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint oricse_portal_vermifugos_animal_clinica_fk foreign key (clinica_id,animal_id) references public.oricse_animais(clinica_id,id) on delete cascade
);
create index if not exists oricse_portal_vermifugos_clinica_animal_idx on public.oricse_portal_vermifugos(clinica_id,animal_id,administrado_em desc);
alter table public.oricse_portal_vermifugos enable row level security;
create policy oricse_portal_vermifugos_equipe_gerenciar on public.oricse_portal_vermifugos
for all to authenticated
using (public.oricse_usuario_pode_permissao(clinica_id,'consultorio.atendimentos'))
with check (public.oricse_usuario_pode_permissao(clinica_id,'consultorio.atendimentos'));
create policy oricse_portal_vermifugos_tutor_ler on public.oricse_portal_vermifugos
for select to authenticated using (
 visivel_tutor=true and public.oricse_portal_pode_acessar_clinica(clinica_id)
 and exists(select 1 from public.oricse_animais a join public.oricse_portal_tutores pt on pt.clinica_id=a.clinica_id and pt.tutor_id=a.tutor_id
   where a.id=oricse_portal_vermifugos.animal_id and a.clinica_id=oricse_portal_vermifugos.clinica_id
   and pt.auth_user_id=(select auth.uid()) and pt.ativo=true)
);
revoke all on public.oricse_portal_vermifugos from anon;
grant select,insert,update,delete on public.oricse_portal_vermifugos to authenticated;