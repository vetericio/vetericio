alter table public.clinicas
  add column if not exists tipo_publico text not null default 'vet'
  check (tipo_publico in ('vet', 'pet'));

update public.clinicas
set tipo_publico = 'vet'
where tipo_publico is null;

-- A unicidade é global: o mesmo identificador não pode existir em /vet nem em /pet.
create unique index if not exists clinicas_slug_unico_global_idx
  on public.clinicas (slug)
  where slug is not null and slug <> '';