-- Aditiva. Os campos ausentes dos registros históricos permanecem nulos.
alter table public.oricse_portal_vacinas
  add column if not exists fabricante text,
  add column if not exists dose text,
  add column if not exists fabricacao text,
  add column if not exists validade text,
  add column if not exists alvo_vacinacao text,
  add column if not exists hora_aplicacao time without time zone,
  add column if not exists local_aplicacao text,
  add column if not exists veterinario_nome text,
  add column if not exists veterinario_crmv text,
  add column if not exists veterinario_uf text;

alter table public.oricse_portal_vermifugos
  add column if not exists fabricante text,
  add column if not exists dose text,
  add column if not exists fabricacao text,
  add column if not exists validade text,
  add column if not exists principio_ativo text,
  add column if not exists via text,
  add column if not exists hora_aplicacao time without time zone,
  add column if not exists local_aplicacao text,
  add column if not exists veterinario_nome text,
  add column if not exists veterinario_crmv text,
  add column if not exists veterinario_uf text;

notify pgrst, 'reload schema';
