-- Six templates and independent drafts of clinic sites.
-- Existing published config/template remain untouched until explicit publication.
BEGIN;

ALTER TABLE public.clinic_sites
  DROP CONSTRAINT IF EXISTS clinic_sites_template_check;
ALTER TABLE public.clinic_sites
  ADD CONSTRAINT clinic_sites_template_check
  CHECK (template IN ('prestige','atelier','cuidado','popular','essencial','horizonte'));

ALTER TABLE public.clinic_sites
  ADD COLUMN IF NOT EXISTS draft_config jsonb,
  ADD COLUMN IF NOT EXISTS draft_template text,
  ADD COLUMN IF NOT EXISTS draft_updated_at timestamptz;

ALTER TABLE public.clinic_sites
  DROP CONSTRAINT IF EXISTS clinic_sites_draft_template_check;
ALTER TABLE public.clinic_sites
  ADD CONSTRAINT clinic_sites_draft_template_check
  CHECK (draft_template IS NULL OR draft_template IN ('prestige','atelier','cuidado','popular','essencial','horizonte'));

CREATE TABLE IF NOT EXISTS public.clinic_site_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  template text NOT NULL CHECK (template IN ('prestige','atelier','cuidado','popular','essencial','horizonte')),
  config jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS clinic_site_versions_clinic_created_idx
  ON public.clinic_site_versions (clinica_id, created_at DESC);
ALTER TABLE public.clinic_site_versions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.clinic_site_versions FROM PUBLIC;
GRANT SELECT, INSERT ON public.clinic_site_versions TO authenticated;

DROP POLICY IF EXISTS clinic_site_versions_read ON public.clinic_site_versions;
CREATE POLICY clinic_site_versions_read ON public.clinic_site_versions
  FOR SELECT TO authenticated
  USING (public.oricse_usuario_pode_permissao(clinica_id,'administracao.site'));
DROP POLICY IF EXISTS clinic_site_versions_insert ON public.clinic_site_versions;
CREATE POLICY clinic_site_versions_insert ON public.clinic_site_versions
  FOR INSERT TO authenticated
  WITH CHECK (public.oricse_usuario_pode_permissao(clinica_id,'administracao.site'));

COMMIT;
