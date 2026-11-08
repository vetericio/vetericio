create unique index if not exists oricse_agendas_online_clinica_id_id_unique
  on public.oricse_agendas_online(clinica_id,id);

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname='oricse_agendamento_agenda_mesma_clinica_fkey'
  ) then
    alter table public.oricse_agendamentos_online
      add constraint oricse_agendamento_agenda_mesma_clinica_fkey
      foreign key (clinica_id,agenda_id)
      references public.oricse_agendas_online(clinica_id,id)
      on delete cascade;
  end if;
end $$;

alter table public.oricse_agendas_online add column if not exists updated_at timestamptz not null default now();
alter table public.oricse_agendamentos_online add column if not exists updated_at timestamptz not null default now();

drop policy if exists agenda_equipe_excluir on public.oricse_agendas_online;
create policy agenda_equipe_excluir on public.oricse_agendas_online
for delete to authenticated
using (public.oricse_usuario_pode_permissao(clinica_id,'recepcao.agenda'));

drop policy if exists agendamento_equipe_excluir on public.oricse_agendamentos_online;
create policy agendamento_equipe_excluir on public.oricse_agendamentos_online
for delete to authenticated
using (public.oricse_usuario_pode_permissao(clinica_id,'recepcao.agenda'));

grant delete on public.oricse_agendas_online to authenticated;
grant delete on public.oricse_agendamentos_online to authenticated;

do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='oricse_agendas_online'
  ) then
    alter publication supabase_realtime add table public.oricse_agendas_online;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='oricse_agendamentos_online'
  ) then
    alter publication supabase_realtime add table public.oricse_agendamentos_online;
  end if;
end $$;
