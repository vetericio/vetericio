CREATE TABLE public.sync_salas (
  codigo_hash TEXT PRIMARY KEY,
  dados JSONB NOT NULL DEFAULT '{}'::jsonb,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.sync_salas TO service_role;

ALTER TABLE public.sync_salas ENABLE ROW LEVEL SECURITY;