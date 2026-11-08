BEGIN;
-- Drafts are private: published pages have a public row, so draft JSON must
-- never reside in columns publicly visible in the same table.
CREATE TABLE IF NOT EXISTS public.clinic_site_drafts (
  clinica_id uuid PRIMARY KEY REFERENCES public.clinicas(id) ON DELETE CASCADE,
  template text NOT NULL CHECK (template IN ('prestige','atelier','cuidado','popular','essencial','horizonte')),
  config jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.clinic_site_drafts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.clinic_site_drafts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinic_site_drafts TO authenticated;
DROP POLICY IF EXISTS clinic_site_drafts_read ON public.clinic_site_drafts;
CREATE POLICY clinic_site_drafts_read ON public.clinic_site_drafts
  FOR SELECT TO authenticated USING (
    public.oricse_usuario_pode_permissao(clinica_id,'administracao.site'));
DROP POLICY IF EXISTS clinic_site_drafts_insert ON public.clinic_site_drafts;
CREATE POLICY clinic_site_drafts_insert ON public.clinic_site_drafts
  FOR INSERT TO authenticated WITH CHECK (
    public.oricse_usuario_pode_permissao(clinica_id,'administracao.site'));
DROP POLICY IF EXISTS clinic_site_drafts_update ON public.clinic_site_drafts;
CREATE POLICY clinic_site_drafts_update ON public.clinic_site_drafts
  FOR UPDATE TO authenticated
  USING (public.oricse_usuario_pode_permissao(clinica_id,'administracao.site'))
  WITH CHECK (public.oricse_usuario_pode_permissao(clinica_id,'administracao.site'));
DROP POLICY IF EXISTS clinic_site_drafts_delete ON public.clinic_site_drafts;
CREATE POLICY clinic_site_drafts_delete ON public.clinic_site_drafts
  FOR DELETE TO authenticated USING (
    public.oricse_usuario_pode_permissao(clinica_id,'administracao.site'));

-- Column-level privileges ensure that the earlier nullable draft columns
-- cannot be fetched from an otherwise public published-site row.
REVOKE SELECT ON public.clinic_sites FROM anon, authenticated;
GRANT SELECT (
  id, clinica_id, slug, status, template, config, publicado_em, created_at, updated_at
) ON public.clinic_sites TO anon, authenticated;
COMMIT;