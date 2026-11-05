-- Executar SOMENTE após a migration, no SQL Editor. Tudo é desfeito ao fim.
-- Troque os três UUIDs por usuários de teste já existentes em auth.users.
begin;

create temp table clinic_sites_rls_result (
  teste text,
  esperado text,
  obtido text,
  passou boolean
);

-- Fixtures transitórias: as clínicas e sites somem no ROLLBACK.
-- Os usuários abaixo precisam existir no projeto de teste.
do $$
declare
  admin_user uuid := '00000000-0000-4000-8000-000000000101';
  other_user uuid := '00000000-0000-4000-8000-000000000102';
  clinic_a uuid := gen_random_uuid();
  clinic_b uuid := gen_random_uuid();
begin
  if not exists (select 1 from auth.users where id = admin_user)
     or not exists (select 1 from auth.users where id = other_user) then
    raise exception 'Crie os dois usuários de teste em Auth e substitua os UUIDs deste arquivo.';
  end if;

  insert into public.clinicas (id, nome, slug) values
    (clinic_a, 'Clínica RLS A', 'rls-clinica-a'), (clinic_b, 'Clínica RLS B', 'rls-clinica-b');
  insert into public.clinica_usuarios (clinica_id, user_id, papel, ativo) values
    (clinic_a, admin_user, 'admin_clinica', true), (clinic_b, other_user, 'admin_clinica', true);

  insert into public.clinic_sites (clinica_id, slug, status, config) values
    (clinic_a, 'rls-publicada', 'publicado', '{"schema_version":1}'),
    (clinic_a, 'rls-rascunho', 'rascunho', '{"schema_version":1}');

  -- Anônimo: apenas a publicada.
  perform set_config('request.jwt.claim.role', 'anon', true);
  perform set_config('request.jwt.claim.sub', '', true);
  set local role anon;
  insert into clinic_sites_rls_result
  select 'anônimo lê publicada', '1 linha', count(*)::text, count(*) = 1
  from public.clinic_sites where slug = 'rls-publicada';
  insert into clinic_sites_rls_result
  select 'anônimo não lê rascunho', '0 linhas', count(*)::text, count(*) = 0
  from public.clinic_sites where slug = 'rls-rascunho';
  reset role;

  -- Usuário da clínica A: lê o rascunho da própria clínica.
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', admin_user::text, true);
  set local role authenticated;
  insert into clinic_sites_rls_result
  select 'gestor lê próprio rascunho', '1 linha', count(*)::text, count(*) = 1
  from public.clinic_sites where slug = 'rls-rascunho';
  reset role;

  -- Usuário da clínica B: não lê o rascunho da A.
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', other_user::text, true);
  set local role authenticated;
  insert into clinic_sites_rls_result
  select 'outra clínica não lê rascunho', '0 linhas', count(*)::text, count(*) = 0
  from public.clinic_sites where slug = 'rls-rascunho';
  reset role;
end $$;

select teste, esperado, obtido, passou from clinic_sites_rls_result order by teste;
rollback;
