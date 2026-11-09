-- Public visitors may read only published clinic-site rows. Keeping the
-- administrative permission check in a separate policy avoids evaluating a
-- private helper function for anonymous requests.
BEGIN;

DROP POLICY IF EXISTS clinic_sites_public_read ON public.clinic_sites;
CREATE POLICY clinic_sites_public_read ON public.clinic_sites
  FOR SELECT TO anon, authenticated
  USING (status = 'publicado');

COMMIT;
