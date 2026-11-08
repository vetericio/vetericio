-- Verificação pública e limitada da disponibilidade do subdomínio solicitado.
-- Não revela dados de clínicas nem de pedidos e não altera reservas.
CREATE OR REPLACE FUNCTION public.oricse_slug_disponivel(p_slug text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_slug text := lower(btrim(coalesce(p_slug,'')));
BEGIN
  IF length(v_slug) < 3 OR length(v_slug) > 30
     OR v_slug !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])$'
     OR v_slug = ANY(ARRAY['www','admin','app','api','login','portal','tutor',
       'suporte','mail','email','blog','sistema','oricse'])
  THEN
    RETURN false;
  END IF;
  RETURN NOT EXISTS (
    SELECT 1 FROM public.clinicas c WHERE lower(c.slug) = v_slug
  ) AND NOT EXISTS (
    SELECT 1 FROM public.oricse_contratacoes p
    WHERE lower(p.slug_desejado) = v_slug
      AND p.status IN ('isento_aguardando_aprovacao','pagamento_aprovado',
        'em_analise','em_configuracao','ativada','aprovada','ativa')
      AND p.excluido_em IS NULL
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.oricse_slug_disponivel(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.oricse_slug_disponivel(text) TO anon, authenticated;
