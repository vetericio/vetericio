begin;
drop policy if exists clinic_sites_manage_own_clinic on public.clinic_sites;
drop policy if exists clinic_sites_public_read on public.clinic_sites;
drop table if exists public.clinic_sites;
commit;
