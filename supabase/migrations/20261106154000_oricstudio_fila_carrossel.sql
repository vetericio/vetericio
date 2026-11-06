-- Dados persistidos dos contêineres do carrossel para retries idempotentes.
begin;
alter table public.oricstudio_envios
  add column if not exists conteineres_filhos text[] not null default '{}'::text[];
alter table public.oricstudio_envios
  add column if not exists meta_publicacao_confirmada_em timestamptz;
comment on column public.oricstudio_envios.iniciada_publicacao_em is
  'Quando preenchida, nunca chamar media_publish novamente sem confirmação externa; evita duplicação.';
commit;