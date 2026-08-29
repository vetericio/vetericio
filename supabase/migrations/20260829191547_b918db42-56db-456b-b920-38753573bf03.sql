CREATE TABLE public.transferencias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dados JSONB NOT NULL,
  criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expira_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now() + interval '24 hours'
);

GRANT ALL ON public.transferencias TO service_role;
ALTER TABLE public.transferencias ENABLE ROW LEVEL SECURITY;