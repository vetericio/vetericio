-- Cópia operacional dos PDFs de contrato no Google Drive central da ORICSE.
alter table public.oricse_contrato_arquivos
  add column if not exists drive_file_id text,
  add column if not exists drive_file_url text,
  add column if not exists drive_folder_id text;

create index if not exists oricse_contrato_arquivos_drive_idx
  on public.oricse_contrato_arquivos(drive_file_id)
  where drive_file_id is not null;
