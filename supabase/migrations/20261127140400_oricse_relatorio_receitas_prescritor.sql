-- Snapshots dos dados impressos no PDF para busca de receitas novas.
-- Sem retropreenchimento: a identidade de receitas históricas não é inferida.
alter table public.oricse_portal_receitas
  add column if not exists prescritor_nome text,
  add column if not exists prescritor_crmv text;
