GRANT SELECT, INSERT, DELETE ON public.transferencias TO service_role;

ALTER TABLE public.transferencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sem acesso direto do cliente"
ON public.transferencias
FOR SELECT
TO anon, authenticated
USING (false);