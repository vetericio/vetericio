-- Amplia os perfis de parceiros atendidos pela Oricse.
alter table public.clinicas
  drop constraint if exists clinicas_tipo_publico_check;

alter table public.clinicas
  add constraint clinicas_tipo_publico_check
  check (tipo_publico in (
    'vet',
    'clinica',
    'hospital',
    'domicilio',
    'pet',
    'banho_tosa',
    'hotel',
    'ong',
    'diagnostico',
    'ensino',
    'outro'
  ));
