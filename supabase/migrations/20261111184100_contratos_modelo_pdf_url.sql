alter table public.oricse_contrato_modelos
  add column if not exists template_pdf_url text;

alter table public.oricse_contratos
  add column if not exists modelo_pdf_url_snapshot text;
