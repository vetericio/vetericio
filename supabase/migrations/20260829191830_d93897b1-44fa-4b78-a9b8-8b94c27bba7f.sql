ALTER TABLE public.transferencias ADD COLUMN codigo TEXT NOT NULL;
CREATE UNIQUE INDEX transferencias_codigo_idx ON public.transferencias (codigo);