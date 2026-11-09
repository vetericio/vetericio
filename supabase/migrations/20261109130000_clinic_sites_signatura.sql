-- Add the Site Signatura model to every clinic-site template constraint.
BEGIN;

ALTER TABLE public.clinic_sites
  DROP CONSTRAINT IF EXISTS clinic_sites_template_check;
ALTER TABLE public.clinic_sites
  ADD CONSTRAINT clinic_sites_template_check
  CHECK (template IN ('prestige','atelier','cuidado','popular','essencial','horizonte','signatura'));

ALTER TABLE public.clinic_sites
  DROP CONSTRAINT IF EXISTS clinic_sites_draft_template_check;
ALTER TABLE public.clinic_sites
  ADD CONSTRAINT clinic_sites_draft_template_check
  CHECK (draft_template IS NULL OR draft_template IN ('prestige','atelier','cuidado','popular','essencial','horizonte','signatura'));

ALTER TABLE public.clinic_site_versions
  DROP CONSTRAINT IF EXISTS clinic_site_versions_template_check;
ALTER TABLE public.clinic_site_versions
  ADD CONSTRAINT clinic_site_versions_template_check
  CHECK (template IN ('prestige','atelier','cuidado','popular','essencial','horizonte','signatura'));

COMMIT;
