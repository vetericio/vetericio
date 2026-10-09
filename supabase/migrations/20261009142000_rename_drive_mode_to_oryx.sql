-- Renomeia o modo padrão do armazenamento central para Oryx.
update public.clinica_drive_config
set modo = 'oryx'
where modo = 'vetericio';

alter table public.clinica_drive_config
  drop constraint if exists clinica_drive_config_modo_check;

alter table public.clinica_drive_config
  alter column modo set default 'oryx';

alter table public.clinica_drive_config
  add constraint clinica_drive_config_modo_check
  check (modo in ('oryx','personalizado'));
