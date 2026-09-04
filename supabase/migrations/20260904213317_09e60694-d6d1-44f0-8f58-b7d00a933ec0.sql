DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public' AND t.relname = 'sync_salas' AND c.contype IN ('p','u')
  ) THEN
    ALTER TABLE public.sync_salas ADD CONSTRAINT sync_salas_codigo_hash_key UNIQUE (codigo_hash);
  END IF;
END $$;