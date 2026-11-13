create or replace function public.oricse_definir_autoria_preventiva()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := auth.uid();
  v_perfil record;
begin
  if tg_op = 'UPDATE' then
    new.veterinario_nome := old.veterinario_nome;
    new.veterinario_crmv := old.veterinario_crmv;
    new.veterinario_uf := old.veterinario_uf;
    return new;
  end if;

  -- Rotinas internas sem sessão (ex.: carga de demonstração) não atribuem autoria.
  if v_usuario is null then
    return new;
  end if;

  select nullif(btrim(p.nome_completo), '') as nome,
         nullif(btrim(p.crmv), '') as crmv,
         upper(btrim(p.crmv_uf)) as uf
    into v_perfil
    from public.oricse_pessoas p
    where p.user_id = v_usuario;

  if not found or v_perfil.nome is null or v_perfil.crmv is null
    or v_perfil.crmv !~ '[0-9]' or v_perfil.uf is null
    or v_perfil.uf !~ '^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$' then
    raise exception using errcode = '22023', message = 'Complete nome, CRMV e UF no cadastro profissional do seu perfil.';
  end if;

  new.veterinario_nome := v_perfil.nome;
  new.veterinario_crmv := v_perfil.crmv;
  new.veterinario_uf := v_perfil.uf;
  return new;
end;
$$;

revoke execute on function public.oricse_definir_autoria_preventiva() from public, anon, authenticated;

drop trigger if exists oricse_autoria_preventiva on public.oricse_portal_vacinas;
create trigger oricse_autoria_preventiva
before insert or update on public.oricse_portal_vacinas
for each row execute function public.oricse_definir_autoria_preventiva();

create table if not exists public.oricse_selos_profissionais (
  user_id uuid primary key references auth.users (id) on delete cascade,
  assinatura text check (assinatura like 'data:image/png;base64,%' and length(assinatura) <= 6000000),
  carimbo text check (carimbo like 'data:image/png;base64,%' and length(carimbo) <= 6000000)
);

alter table public.oricse_selos_profissionais enable row level security;
revoke all on public.oricse_selos_profissionais from public, anon, authenticated;
grant select, insert, update on public.oricse_selos_profissionais to authenticated;

drop policy if exists oricse_selos_do_perfil on public.oricse_selos_profissionais;
create policy oricse_selos_do_perfil on public.oricse_selos_profissionais
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop trigger if exists oricse_autoria_preventiva on public.oricse_portal_vermifugos;
create trigger oricse_autoria_preventiva
before insert or update on public.oricse_portal_vermifugos
for each row execute function public.oricse_definir_autoria_preventiva();
