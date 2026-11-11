alter table public.oricse_contrato_modelos
  add column if not exists template_pdf_base64 text;

alter table public.oricse_contratos
  add column if not exists modelo_pdf_base64_snapshot text;

alter table public.oricse_contrato_modelos
  drop constraint if exists oricse_contrato_modelos_template_pdf_size;

alter table public.oricse_contrato_modelos
  add constraint oricse_contrato_modelos_template_pdf_size
  check (template_pdf_base64 is null or char_length(template_pdf_base64) <= 4_000_000);

alter table public.oricse_contratos
  drop constraint if exists oricse_contratos_modelo_pdf_snapshot_size;

alter table public.oricse_contratos
  add constraint oricse_contratos_modelo_pdf_snapshot_size
  check (modelo_pdf_base64_snapshot is null or char_length(modelo_pdf_base64_snapshot) <= 4_000_000);
