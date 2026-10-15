create extension if not exists pgcrypto;

insert into public.oricse_funcionalidades(codigo,nome,grupo,ativo,ordem)
values ('portal_tutor.acesso','Portal do tutor','Portal do tutor',true,89)
on conflict (codigo) do update set nome=excluded.nome,grupo=excluded.grupo,ativo=true,ordem=excluded.ordem;

insert into public.oricse_plano_funcionalidades(plano_id,funcionalidade_codigo,permitido)
select p.id,'portal_tutor.acesso',(p.codigo in ('plus-clinica','master-equipe'))
from public.oricse_planos p
where p.ativo=true
on conflict (plano_id,funcionalidade_codigo) do update set permitido=excluded.permitido;

create table if not exists public.oricse_animais (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  tutor_id uuid not null,
  nome text not null,
  especie text not null default '',
  raca text not null default '',
  sexo text not null default '',
  nascimento date,
  peso_kg numeric(10,3),
  foto_url text,
  dados jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint oricse_animais_tutor_mesma_clinica_fkey foreign key (clinica_id,tutor_id)
    references public.tutores(clinica_id,id) on delete cascade
);
create unique index if not exists oricse_animais_clinica_id_id_unique on public.oricse_animais(clinica_id,id);
create index if not exists oricse_animais_clinica_tutor_idx on public.oricse_animais(clinica_id,tutor_id,nome);
alter table public.oricse_animais enable row level security;

create table if not exists public.oricse_portal_tutores (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  tutor_id uuid not null,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  usuario text not null,
  usuario_chave text not null,
  ativo boolean not null default true,
  ultimo_acesso_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint oricse_portal_tutor_mesma_clinica_fkey foreign key (clinica_id,tutor_id)
    references public.tutores(clinica_id,id) on delete cascade,
  unique(clinica_id,tutor_id),
  unique(clinica_id,usuario_chave),
  unique(auth_user_id)
);
create index if not exists oricse_portal_tutores_clinica_idx on public.oricse_portal_tutores(clinica_id,ativo);
alter table public.oricse_portal_tutores enable row level security;

create table if not exists public.oricse_portal_convites (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  tutor_id uuid not null,
  usuario text not null,
  usuario_chave text not null,
  token_hash text not null,
  expira_em timestamptz not null,
  usado_em timestamptz,
  criado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint oricse_portal_convite_tutor_mesma_clinica_fkey foreign key (clinica_id,tutor_id)
    references public.tutores(clinica_id,id) on delete cascade
);
create unique index if not exists oricse_portal_convite_ativo_usuario_idx on public.oricse_portal_convites(clinica_id,usuario_chave) where usado_em is null;
create index if not exists oricse_portal_convites_tutor_idx on public.oricse_portal_convites(clinica_id,tutor_id,created_at desc);
alter table public.oricse_portal_convites enable row level security;

create table if not exists public.oricse_portal_vacinas (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  animal_id uuid not null,
  nome text not null,
  aplicada_em date,
  reforco_em date,
  lote text,
  observacoes text,
  visivel_tutor boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint oricse_portal_vacina_animal_mesma_clinica_fkey foreign key (clinica_id,animal_id)
    references public.oricse_animais(clinica_id,id) on delete cascade
);
alter table public.oricse_portal_vacinas enable row level security;

create table if not exists public.oricse_portal_documentos (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  animal_id uuid not null,
  drive_arquivo_id uuid references public.drive_arquivos(id) on delete set null,
  titulo text not null,
  tipo text not null default 'Documento',
  data_documento date,
  observacoes text,
  visivel_tutor boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint oricse_portal_documento_animal_mesma_clinica_fkey foreign key (clinica_id,animal_id)
    references public.oricse_animais(clinica_id,id) on delete cascade
);
alter table public.oricse_portal_documentos enable row level security;

alter table public.oricse_agendas_online add column if not exists timezone text not null default 'America/Sao_Paulo';
alter table public.oricse_agendas_online add column if not exists tipo text not null default 'Consultório';
alter table public.oricse_agendas_online add column if not exists cor text not null default 'verde';

alter table public.oricse_agendamentos_online alter column tutor_auth_id drop not null;
alter table public.oricse_agendamentos_online add column if not exists tutor_id uuid;
alter table public.oricse_agendamentos_online add column if not exists animal_id uuid;
alter table public.oricse_agendamentos_online add column if not exists tipo text not null default 'Consulta';
alter table public.oricse_agendamentos_online add column if not exists observacoes text;
alter table public.oricse_agendamentos_online add column if not exists origem text not null default 'portal_tutor';
alter table public.oricse_agendamentos_online add column if not exists dados jsonb not null default '{}'::jsonb;

do $$ begin
  if not exists (select 1 from pg_constraint where conname='oricse_agendamento_tutor_mesma_clinica_fkey') then
    alter table public.oricse_agendamentos_online add constraint oricse_agendamento_tutor_mesma_clinica_fkey foreign key (clinica_id,tutor_id) references public.tutores(clinica_id,id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname='oricse_agendamento_animal_mesma_clinica_fkey') then
    alter table public.oricse_agendamentos_online add constraint oricse_agendamento_animal_mesma_clinica_fkey foreign key (clinica_id,animal_id) references public.oricse_animais(clinica_id,id) on delete set null;
  end if;
end $$;
