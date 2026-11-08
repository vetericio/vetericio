-- Corrige a ausência do gatilho de isenção integral no banco de produção.
-- Reinstala de forma idempotente a regra de classificação já prevista no projeto.
CREATE OR REPLACE FUNCTION public.oricse_classificar_isencao_integral()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NEW.status = 'aguardando_pagamento'
    AND NEW.valor_total = 0
    AND NEW.promo_codigo IS NOT NULL
    AND NEW.promo_valor_original > 0
    AND NEW.promo_desconto >= NEW.promo_valor_original
    AND NEW.promo_valor_final = 0
  THEN
    NEW.status := 'isento_aguardando_aprovacao';
    NEW.updated_at := NOW();
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.oricse_classificar_isencao_integral()
FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.oricse_contratacoes'::regclass
      AND tgname = 'oricse_contratacao_classifica_isencao_integral'
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER oricse_contratacao_classifica_isencao_integral
    BEFORE INSERT OR UPDATE OF status, valor_total, promo_codigo,
      promo_valor_original, promo_desconto, promo_valor_final
    ON public.oricse_contratacoes
    FOR EACH ROW EXECUTE FUNCTION public.oricse_classificar_isencao_integral();
  END IF;
END;
$$;
