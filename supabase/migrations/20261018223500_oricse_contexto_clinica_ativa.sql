-- O contexto do administrador deve refletir exatamente a clínica que ele
-- acabou de selecionar, não a primeira clínica do seu vínculo.
create or replace function public.oricse_contexto_clinica_atual()
returns table(
  clinica_id uuid,
  clinica_nome text,
  clinica_slug text,
  clinica_dominio text,
  clinica_logo_url text
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.nome, c.slug, c.dominio, c.logo_url
  from public.clinicas c
  where c.id = public.oricse_clinica_ativa_obter()
$$;
