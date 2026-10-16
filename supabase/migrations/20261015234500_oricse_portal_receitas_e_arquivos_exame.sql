create table if not exists public.oricse_portal_receitas (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  animal_id uuid not null,
  tutor_id uuid not null,
  drive_arquivo_id uuid references public.drive_arquivos(id) on delete set null,
  tipo text not null default 'normal',
  numero text,
  titulo text not null default 'Receita veterinária',
  emitida_em date not null default current_date,
  resumo text,
  visivel_tutor boolean not null default true,
  motivo_ocultacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint oricse_portal_receita_animal_mesma_clinica_fkey foreign key (clinica_id,animal_id)
    references public.oricse_animais(clinica_id,id) on delete cascade,
  constraint oricse_portal_receita_tutor_mesma_clinica_fkey foreign key (clinica_id,tutor_id)
    references public.tutores(clinica_id,id) on delete cascade,
  constraint oricse_portal_receita_visibilidade_motivo_chk check (
    visivel_tutor = true or nullif(trim(coalesce(motivo_ocultacao,'')),'') is not null
  )
);

create index if not exists oricse_portal_receitas_clinica_animal_idx
  on public.oricse_portal_receitas(clinica_id,animal_id,emitida_em desc,created_at desc);

alter table public.oricse_portal_receitas enable row level security;

drop policy if exists oricse_portal_receitas_equipe_gerenciar on public.oricse_portal_receitas;
create policy oricse_portal_receitas_equipe_gerenciar on public.oricse_portal_receitas
for all to authenticated
using (
  public.oricse_usuario_pode_permissao(clinica_id,'consultorio.receituario')
  or public.oricse_usuario_pode_permissao(clinica_id,'consultorio.atendimentos')
)
with check (
  public.oricse_usuario_pode_permissao(clinica_id,'consultorio.receituario')
  or public.oricse_usuario_pode_permissao(clinica_id,'consultorio.atendimentos')
);

drop policy if exists oricse_portal_receitas_tutor_ler on public.oricse_portal_receitas;
create policy oricse_portal_receitas_tutor_ler on public.oricse_portal_receitas
for select to authenticated
using (
  visivel_tutor=true
  and public.oricse_portal_pode_acessar_clinica(clinica_id)
  and exists(
    select 1 from public.oricse_portal_tutores pt
    where pt.auth_user_id=(select auth.uid())
      and pt.ativo=true
      and pt.clinica_id=oricse_portal_receitas.clinica_id
      and pt.tutor_id=oricse_portal_receitas.tutor_id
  )
);

grant select,insert,update,delete on public.oricse_portal_receitas to authenticated;
revoke all on public.oricse_portal_receitas from anon;
