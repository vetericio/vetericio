-- Resultados e faixas clínicas internas. Não replica resultados para o Portal do Tutor.
begin;
create table public.oricse_exames_laboratoriais (
  id uuid primary key,
  clinica_id uuid not null references public.clinicas(id) on delete restrict,
  animal_id uuid not null,
  consulta_id uuid,
  painel text not null check (painel in ('bioquimico','hemograma','outros')),
  especie text not null check (especie in ('Cachorro','Gato','Outra')),
  realizado_em date not null check (realizado_em >= date '2000-01-01'),
  hora_exame time without time zone not null,
  laboratorio text not null check (char_length(btrim(laboratorio)) between 1 and 120),
  autor_id uuid not null,
  autor_nome text not null check (char_length(btrim(autor_nome)) between 1 and 180),
  resultados jsonb not null check (jsonb_typeof(resultados) = 'array' and jsonb_array_length(resultados) between 1 and 60),
  observacoes text not null default '' check (char_length(observacoes) <= 2500),
  drive_arquivo_id uuid references public.drive_arquivos(id) on delete restrict,
  criado_em timestamptz not null default now(),
  foreign key (clinica_id,animal_id) references public.oricse_animais(clinica_id,id) on delete restrict,
  check (drive_arquivo_id is null or drive_arquivo_id = id)
);
create index oricse_exames_lab_animal_tempo
  on public.oricse_exames_laboratoriais (clinica_id, animal_id, realizado_em desc, hora_exame desc, id);
alter table public.oricse_exames_laboratoriais enable row level security;
revoke all on public.oricse_exames_laboratoriais from public, anon, authenticated, service_role;
grant select, insert on public.oricse_exames_laboratoriais to service_role;
-- Todas as leituras e escritas passam por server functions autorizadas; sem acesso direto pelo Data API do Tutor.

create table public.oricse_referencias_laboratoriais (
  clinica_id uuid not null references public.clinicas(id) on delete restrict,
  laboratorio_chave text not null check (char_length(laboratorio_chave) between 1 and 120),
  laboratorio text not null check (char_length(laboratorio) between 1 and 120),
  especie text not null check (especie in ('Cachorro','Gato')),
  painel text not null check (painel in ('bioquimico','hemograma','outros')),
  referencias jsonb not null check (jsonb_typeof(referencias) = 'array' and jsonb_array_length(referencias) between 1 and 60),
  atualizado_por uuid not null,
  atualizado_em timestamptz not null default now(),
  primary key (clinica_id, laboratorio_chave, especie, painel)
);
alter table public.oricse_referencias_laboratoriais enable row level security;
revoke all on public.oricse_referencias_laboratoriais from public, anon, authenticated, service_role;
grant select, insert, update on public.oricse_referencias_laboratoriais to service_role;
commit;
