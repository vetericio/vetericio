-- Registro aditivo e privado. Não altera as fichas, medicações ou plantões existentes.
create table if not exists public.oricse_painel_plantao_eventos (
  clinica_id uuid not null references public.clinicas(id),
  turno_chave text not null check (char_length(turno_chave) between 3 and 80),
  tipo text not null check (tipo in ('dose', 'ocorrencia', 'passagem')),
  chave text not null check (char_length(chave) between 1 and 100),
  registro_id text check (char_length(registro_id) between 1 and 300),
  paciente text check (char_length(paciente) between 1 and 300),
  medicamento text check (char_length(medicamento) between 1 and 601),
  agendado_em timestamptz,
  estado text check (estado in ('realizada', 'nao_realizada')),
  texto text not null check (char_length(texto) <= 1000),
  autor_id uuid not null,
  autor_nome text not null check (char_length(autor_nome) between 1 and 220),
  registrado_em timestamptz not null default now(),
  primary key (clinica_id, turno_chave, tipo, chave),
  check (
    (tipo = 'dose' and registro_id is not null and paciente is not null and medicamento is not null
      and agendado_em is not null and estado is not null
      and (estado <> 'nao_realizada' or char_length(btrim(texto)) > 0))
    or
    (tipo = 'ocorrencia' and registro_id is not null and paciente is not null and medicamento is null
      and agendado_em is null and estado is null and char_length(btrim(texto)) > 0)
    or
    (tipo = 'passagem' and registro_id is null and paciente is null and medicamento is null
      and agendado_em is null and estado is null and char_length(btrim(texto)) > 0)
  )
);
-- Uma mesma dose da mesma ficha não ganha segunda execução na virada do turno.
create unique index if not exists oricse_painel_plantao_dose_unica_idx
  on public.oricse_painel_plantao_eventos (clinica_id, chave) where tipo = 'dose';
create index if not exists oricse_painel_plantao_dose_horario_idx
  on public.oricse_painel_plantao_eventos (clinica_id, agendado_em, chave) where tipo = 'dose';
create index if not exists oricse_painel_plantao_eventos_passagens_idx
  on public.oricse_painel_plantao_eventos (clinica_id, registrado_em desc, chave)
  where tipo = 'passagem';
alter table public.oricse_painel_plantao_eventos enable row level security;
revoke all on public.oricse_painel_plantao_eventos from public, anon, authenticated, service_role;
grant select, insert on public.oricse_painel_plantao_eventos to service_role;
