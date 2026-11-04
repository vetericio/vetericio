-- ORICSE: limites coletivos de animais por plano (sem exclusão de dados existentes).
-- Regra: NULL = ilimitado. Todos os usuários de uma clínica compartilham a mesma cota.
CREATE TABLE IF NOT EXISTS public.oricse_planos_limites (
  plano_codigo text PRIMARY KEY,
  plano_nome text NOT NULL,
  limite_animais integer,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT oricse_planos_limites_codigo_ck CHECK (plano_codigo ~ '^[a-z0-9][a-z0-9-]*$'),
  CONSTRAINT oricse_planos_limites_valor_ck CHECK (limite_animais IS NULL OR limite_animais BETWEEN 1 AND 1000000)
);
ALTER TABLE public.oricse_planos_limites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.oricse_planos_limites FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.oricse_planos_limites TO authenticated;
GRANT ALL ON TABLE public.oricse_planos_limites TO service_role;
DROP POLICY IF EXISTS oricse_planos_limites_admin ON public.oricse_planos_limites;
CREATE POLICY oricse_planos_limites_admin ON public.oricse_planos_limites
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.app_users u WHERE u.user_id = (SELECT auth.uid()) AND u.role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.app_users u WHERE u.user_id = (SELECT auth.uid()) AND u.role = 'admin'));

-- Serializa cadastros SQL simultâneos por clínica, inclusive via RPCs SECURITY DEFINER.
CREATE OR REPLACE FUNCTION public.oricse_conferir_cota_animais()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  plano_atual text;
  capacidade integer;
  quantidade bigint;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.clinica_id IS NOT DISTINCT FROM OLD.clinica_id THEN
    RETURN NEW;
  END IF;
  SELECT c.plano INTO plano_atual FROM public.clinicas c
    WHERE c.id = NEW.clinica_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Clínica não encontrada para o cadastro do animal';
  END IF;
  SELECT p.limite_animais INTO capacidade
    FROM public.oricse_planos_limites p
    WHERE p.plano_codigo = plano_atual OR p.plano_nome = plano_atual
    ORDER BY (p.plano_codigo = plano_atual) DESC LIMIT 1;
  IF capacidade IS NULL THEN RETURN NEW; END IF;
  SELECT count(*) INTO quantidade FROM public.oricse_animais a WHERE a.clinica_id = NEW.clinica_id;
  IF quantidade >= capacidade THEN
    RAISE EXCEPTION 'Limite de % animais do plano atingido para esta clínica. Solicite a ampliação do plano.', capacidade
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.oricse_conferir_cota_animais() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS oricse_limite_animais_por_plano ON public.oricse_animais;
CREATE TRIGGER oricse_limite_animais_por_plano
  BEFORE INSERT OR UPDATE OF clinica_id ON public.oricse_animais
  FOR EACH ROW EXECUTE FUNCTION public.oricse_conferir_cota_animais();

COMMENT ON TABLE public.oricse_planos_limites IS
  'Cotas de animais por plano/clínica. NULL = ilimitado. Não exclui animais existentes ao reduzir cota.';
