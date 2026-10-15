create table if not exists public.oricse_portal_exames (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  animal_id uuid not null,
  titulo text not null,
  tipo text not null default 'Exame',
  realizado_em date,
  resultado_resumo text,
  drive_arquivo_id uuid references public.drive_arquivos(id) on delete set null,
  visivel_tutor boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint oricse_portal_exame_animal_mesma_clinica_fkey foreign key (clinica_id,animal_id)
    references public.oricse_animais(clinica_id,id) on delete cascade
);

create index if not exists oricse_portal_exames_clinica_animal_idx
  on public.oricse_portal_exames(clinica_id,animal_id,realizado_em desc);

alter table public.oricse_portal_exames enable row level security;

drop policy if exists oricse_portal_exames_equipe_gerenciar on public.oricse_portal_exames;
create policy oricse_portal_exames_equipe_gerenciar on public.oricse_portal_exames
for all to authenticated
using (public.oricse_usuario_pode_permissao(clinica_id,'consultorio.atendimentos'))
with check (public.oricse_usuario_pode_permissao(clinica_id,'consultorio.atendimentos'));

drop policy if exists oricse_portal_exames_ler on public.oricse_portal_exames;
create policy oricse_portal_exames_ler on public.oricse_portal_exames
for select to authenticated
using (
  public.oricse_usuario_pode_permissao(clinica_id,'consultorio.atendimentos')
  or (
    public.oricse_portal_pode_acessar_clinica(clinica_id)
    and exists(
      select 1
      from public.oricse_animais a
      join public.oricse_portal_tutores pt
        on pt.clinica_id=a.clinica_id and pt.tutor_id=a.tutor_id
      where a.id=oricse_portal_exames.animal_id
        and a.clinica_id=oricse_portal_exames.clinica_id
        and pt.auth_user_id=(select auth.uid())
        and pt.ativo=true
        and oricse_portal_exames.visivel_tutor=true
    )
  )
);

revoke all on table public.oricse_portal_exames from anon;
grant select,insert,update,delete on table public.oricse_portal_exames to authenticated;

alter table public.oricse_portal_vacinas alter column visivel_tutor set default false;
alter table public.oricse_portal_documentos alter column visivel_tutor set default false;

create index if not exists oricse_portal_vacinas_clinica_animal_idx
  on public.oricse_portal_vacinas(clinica_id,animal_id,aplicada_em desc);
create index if not exists oricse_portal_documentos_clinica_animal_idx
  on public.oricse_portal_documentos(clinica_id,animal_id,data_documento desc);
