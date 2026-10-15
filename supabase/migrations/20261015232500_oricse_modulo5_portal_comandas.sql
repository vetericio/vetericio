create table if not exists public.oricse_portal_comandas (
  id uuid primary key,
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  tutor_id uuid not null,
  animal_id uuid not null,
  numero bigint not null,
  status text not null check(status in ('Aberta','Finalizada')),
  origem text not null default 'Recepção',
  aberta_em timestamptz not null,
  finalizada_em timestamptz,
  itens jsonb not null default '[]'::jsonb,
  pagamentos jsonb not null default '[]'::jsonb,
  total numeric(12,2) not null default 0,
  total_pago numeric(12,2) not null default 0,
  saldo numeric(12,2) not null default 0,
  visivel_tutor boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint oricse_portal_comanda_tutor_mesma_clinica_fkey foreign key (clinica_id,tutor_id)
    references public.tutores(clinica_id,id) on delete cascade,
  constraint oricse_portal_comanda_animal_mesma_clinica_fkey foreign key (clinica_id,animal_id)
    references public.oricse_animais(clinica_id,id) on delete cascade
);
create index if not exists oricse_portal_comandas_animal_idx on public.oricse_portal_comandas(clinica_id,animal_id,aberta_em desc);
alter table public.oricse_portal_comandas enable row level security;

drop policy if exists oricse_portal_comandas_equipe_ler on public.oricse_portal_comandas;
create policy oricse_portal_comandas_equipe_ler on public.oricse_portal_comandas
for select to authenticated
using (public.oricse_usuario_pode_permissao(clinica_id,'caixa.comandas'));

drop policy if exists oricse_portal_comandas_equipe_gerenciar on public.oricse_portal_comandas;
create policy oricse_portal_comandas_equipe_gerenciar on public.oricse_portal_comandas
for all to authenticated
using (public.oricse_usuario_pode_permissao(clinica_id,'caixa.comandas'))
with check (public.oricse_usuario_pode_permissao(clinica_id,'caixa.comandas'));

drop policy if exists oricse_portal_comandas_tutor_ler on public.oricse_portal_comandas;
create policy oricse_portal_comandas_tutor_ler on public.oricse_portal_comandas
for select to authenticated
using (
  visivel_tutor=true
  and public.oricse_portal_pode_acessar_clinica(clinica_id)
  and exists(
    select 1 from public.oricse_portal_tutores pt
    where pt.auth_user_id=(select auth.uid()) and pt.ativo=true
      and pt.clinica_id=oricse_portal_comandas.clinica_id
      and pt.tutor_id=oricse_portal_comandas.tutor_id
  )
);

grant select,insert,update,delete on public.oricse_portal_comandas to authenticated;
revoke all on public.oricse_portal_comandas from anon;
