alter table public.clinica_drive_config drop constraint if exists clinica_drive_config_modo_check;

update public.clinica_drive_config set modo = 'oricse' where modo = 'vetericio';

alter table public.clinica_drive_config alter column modo set default 'oricse';

alter table public.clinica_drive_config
  add constraint clinica_drive_config_modo_check check (modo in ('oricse', 'personalizado'));
