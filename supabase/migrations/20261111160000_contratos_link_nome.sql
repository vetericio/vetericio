alter table public.oricse_contratos
  add column if not exists link_path text,
  add column if not exists nome_link text not null default '';

alter table public.oricse_contratos
  drop constraint if exists oricse_contratos_nome_link_size;

alter table public.oricse_contratos
  add constraint oricse_contratos_nome_link_size
  check (char_length(nome_link) <= 160);
