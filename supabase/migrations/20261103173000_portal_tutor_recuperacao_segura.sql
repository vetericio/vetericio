-- Portal do Tutor: recuperação segura por CPF, nascimento e pet vinculado à clínica.
-- O mesmo CPF pode existir em clínicas diferentes; na mesma clínica ele é único.

create unique index if not exists tutores_clinica_cpf_digitos_unico
  on public.tutores (clinica_id, cpf_digitos)
  where cpf_digitos is not null;

alter table public.oricse_portal_tutores
  alter column auth_user_id drop not null,
  add column if not exists senha_atualizada_em timestamptz,
  add column if not exists clinica_slug text,
  add column if not exists convite_token_hash text,
  add column if not exists convite_expira_em timestamptz;

create table if not exists public.oricse_portal_redefinicoes_senha (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  tutor_id uuid not null references public.tutores(id) on delete cascade,
  portal_tutor_id uuid not null references public.oricse_portal_tutores(id) on delete cascade,
  resposta_animal_id uuid not null references public.oricse_animais(id) on delete cascade,
  alternativas jsonb not null default '[]'::jsonb,
  tentativas smallint not null default 0 check (tentativas >= 0 and tentativas <= 5),
  solicitado_em timestamptz not null default now(),
  expira_em timestamptz not null,
  respondido_em timestamptz,
  senha_redefinida_em timestamptz
);

create index if not exists oricse_portal_redefinicoes_ativas_idx
  on public.oricse_portal_redefinicoes_senha (portal_tutor_id, expira_em desc)
  where senha_redefinida_em is null;

alter table public.oricse_portal_redefinicoes_senha enable row level security;
revoke all on table public.oricse_portal_redefinicoes_senha from public, anon, authenticated;

create or replace function public.oricse_portal_emitir_convite(p_tutor_id uuid,p_usuario text)
returns table(usuario text,token text,expira_em timestamptz,clinica_slug text)
language plpgsql
security definer
set search_path=''
as $$
declare
  v_clinica uuid;
  v_usuario text;
  v_token text;
  v_expira timestamptz := now()+interval '48 hours';
  v_slug text;
begin
  select t.clinica_id into v_clinica
  from public.tutores t
  where t.id=p_tutor_id;

  if v_clinica is null then
    raise exception 'Tutor não encontrado.' using errcode='P0002';
  end if;

  if not public.oricse_usuario_pode_permissao(v_clinica,'recepcao.cadastros.editar') then
    raise exception 'Sem permissão para ativar o portal deste tutor.' using errcode='42501';
  end if;

  if not public.oricse_plano_permite(v_clinica,'portal_tutor.acesso') then
    raise exception 'O portal do tutor não está incluído no plano desta clínica.' using errcode='42501';
  end if;

  v_usuario:=public.oricse_normalizar_usuario_portal(p_usuario);
  if length(v_usuario)<3 or length(v_usuario)>40 then
    raise exception 'O usuário deve ter entre 3 e 40 caracteres.' using errcode='22023';
  end if;

  if exists (
    select 1
    from public.oricse_portal_tutores pt
    where pt.clinica_id=v_clinica
      and pt.usuario_chave=v_usuario
      and pt.tutor_id<>p_tutor_id
  ) then
    raise exception 'Este usuário já está em uso nesta clínica.' using errcode='23505';
  end if;

  if exists (
    select 1
    from public.oricse_portal_tutores pt
    where pt.clinica_id=v_clinica
      and pt.tutor_id=p_tutor_id
      and pt.auth_user_id is not null
  ) then
    raise exception 'Este acesso já está ativo. A redefinição deve ser feita pelo próprio Portal do Tutor.' using errcode='P0001';
  end if;

  v_token:=encode(extensions.gen_random_bytes(24),'hex');

  insert into public.oricse_portal_tutores(
    clinica_id,tutor_id,usuario,usuario_chave,ativo,clinica_slug,convite_token_hash,convite_expira_em
  )
  values (
    v_clinica,p_tutor_id,'@'||v_usuario,v_usuario,true,
    (select c.slug from public.clinicas c where c.id=v_clinica),
    encode(extensions.digest(v_token,'sha256'),'hex'),v_expira
  )
  on conflict (clinica_id,tutor_id) do update
    set usuario=excluded.usuario,
        usuario_chave=excluded.usuario_chave,
        ativo=true,
        clinica_slug=excluded.clinica_slug,
        convite_token_hash=excluded.convite_token_hash,
        convite_expira_em=excluded.convite_expira_em,
        updated_at=now();

  delete from public.oricse_portal_convites pc
  where pc.clinica_id=v_clinica and pc.tutor_id=p_tutor_id and pc.usado_em is null;

  insert into public.oricse_portal_convites(
    clinica_id,tutor_id,usuario,usuario_chave,token_hash,expira_em,criado_por
  )
  values (
    v_clinica,p_tutor_id,'@'||v_usuario,v_usuario,
    encode(extensions.digest(v_token,'sha256'),'hex'),v_expira,(select auth.uid())
  );

  select c.slug into v_slug
  from public.clinicas c
  where c.id=v_clinica;

  return query select '@'||v_usuario,v_token,v_expira,v_slug;
end;
$$;

create or replace function public.oricse_portal_acesso_tutor_ficha(p_animal_id uuid)
returns table(
  clinica_id uuid,
  clinica_slug text,
  tutor_id uuid,
  usuario text,
  acesso_ativo boolean,
  senha_definida boolean,
  senha_atualizada_em timestamptz
)
language plpgsql
security definer
set search_path=''
as $$
declare
  v_clinica uuid;
  v_tutor uuid;
begin
  select a.clinica_id,a.tutor_id into v_clinica,v_tutor
  from public.oricse_animais a
  where a.id=p_animal_id;

  if v_clinica is null then
    raise exception 'Animal não encontrado.' using errcode='P0002';
  end if;

  if not public.oricse_usuario_pode_permissao(v_clinica,'recepcao.cadastros.editar') then
    raise exception 'Sem permissão para consultar o acesso do tutor.' using errcode='42501';
  end if;

  return query
    select c.id,c.slug,v_tutor,pt.usuario,
      coalesce(pt.ativo,false),
      (pt.auth_user_id is not null),
      pt.senha_atualizada_em
    from public.clinicas c
    left join public.oricse_portal_tutores pt
      on pt.clinica_id=c.id and pt.tutor_id=v_tutor
    where c.id=v_clinica;
end;
$$;

revoke all on function public.oricse_portal_acesso_tutor_ficha(uuid) from public,anon;
grant execute on function public.oricse_portal_acesso_tutor_ficha(uuid) to authenticated;
