alter table oricse_portal_privado.codigos_ativacao
  add column codigo_fixo text check (codigo_fixo ~ '^[A-Z]{2}[0-9]{2}$'),
  add column bloqueado_ate timestamptz;

create function oricse_portal_privado.atribuir_codigo_fixo(p_portal_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_bytes bytea;
  v_indice integer;
  v_codigo text;
begin
  loop
    v_bytes := extensions.gen_random_bytes(3);
    v_indice := get_byte(v_bytes, 0) * 65536 + get_byte(v_bytes, 1) * 256 + get_byte(v_bytes, 2);
    exit when v_indice < 16764800;
  end loop;
  v_indice := v_indice % 67600;
  v_codigo := chr(65 + v_indice / 2600) || chr(65 + (v_indice / 100) % 26)
    || lpad((v_indice % 100)::text, 2, '0');

  insert into oricse_portal_privado.codigos_ativacao as ca
    (portal_id, codigo_hash, convite_chave, codigo_fixo)
  values (p_portal_id, encode(extensions.digest(p_portal_id::text || v_codigo, 'sha256'), 'hex'),
    encode(extensions.gen_random_bytes(32), 'hex'), v_codigo)
  on conflict (portal_id) do update set codigo_fixo = excluded.codigo_fixo
  where ca.codigo_fixo is null;
end;
$$;

create function oricse_portal_privado.atribuir_codigo_ao_criar_acesso()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform oricse_portal_privado.atribuir_codigo_fixo(new.id);
  return new;
end;
$$;

revoke all on function oricse_portal_privado.atribuir_codigo_fixo(uuid) from public, anon, authenticated;
revoke all on function oricse_portal_privado.atribuir_codigo_ao_criar_acesso() from public, anon, authenticated;

create trigger portal_tutor_atribuir_codigo_fixo
after insert on public.oricse_portal_tutores
for each row execute function oricse_portal_privado.atribuir_codigo_ao_criar_acesso();

select oricse_portal_privado.atribuir_codigo_fixo(p.id)
from public.oricse_portal_tutores p;

create function public.oricse_portal_codigos_da_clinica(p_clinica_id uuid)
returns table(id uuid, tutor_id uuid, usuario text, ativo boolean, auth_user_id uuid, codigo_fixo text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
    or not coalesce(public.oricse_usuario_pode_permissao(p_clinica_id, 'portal_tutor.gerenciar'), false) then
    raise exception 'Sem permissão para gerenciar o Portal do Tutor.' using errcode = '42501';
  end if;

  return query
    select p.id, p.tutor_id, p.usuario, p.ativo, p.auth_user_id, c.codigo_fixo
    from public.oricse_portal_tutores p
    join oricse_portal_privado.codigos_ativacao c on c.portal_id = p.id
    where p.clinica_id = p_clinica_id;
end;
$$;
revoke all on function public.oricse_portal_codigos_da_clinica(uuid) from public, anon;
grant execute on function public.oricse_portal_codigos_da_clinica(uuid) to authenticated;

create or replace function public.oricse_portal_verificar_codigo_ativacao(p_portal_id uuid, p_convite_chave text, p_codigo text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_codigo oricse_portal_privado.codigos_ativacao;
  v_portal public.oricse_portal_tutores;
begin
  select p.* into v_portal from public.oricse_portal_tutores p
  where p.id = p_portal_id and p.ativo and p.auth_user_id is null;
  if not found or not coalesce(public.oricse_plano_permite(v_portal.clinica_id, 'portal_tutor.acesso'), false) then
    return 'invalido';
  end if;

  select c.* into v_codigo from oricse_portal_privado.codigos_ativacao c
  where c.portal_id = p_portal_id for update;
  if not found then return 'invalido'; end if;
  if v_codigo.bloqueado_ate > now() then return 'bloqueado'; end if;

  if v_codigo.bloqueado_ate is not null then
    v_codigo.tentativas := 0;
    update oricse_portal_privado.codigos_ativacao c
    set tentativas = 0, bloqueado_ate = null where c.portal_id = p_portal_id;
  end if;

  if p_codigo = v_codigo.codigo_fixo then return 'fixo'; end if;
  if v_portal.convite_expira_em > now() and p_convite_chave = v_portal.convite_token_hash
    and p_convite_chave = v_codigo.convite_chave
    and v_codigo.codigo_hash = encode(extensions.digest(p_portal_id::text || p_codigo, 'sha256'), 'hex') then
    return 'valido';
  end if;

  update oricse_portal_privado.codigos_ativacao c
  set tentativas = least(v_codigo.tentativas + 1, 5),
      bloqueado_ate = case when v_codigo.tentativas >= 4 then now() + interval '30 minutes' end
  where c.portal_id = p_portal_id;
  return case when v_codigo.tentativas >= 4 then 'bloqueado' else 'invalido' end;
end;
$$;

-- Compatibilidade com a interface anterior, que ainda chama este RPC ao convidar.
create or replace function public.oricse_portal_emitir_convite(p_tutor_id uuid, p_usuario text)
returns table(usuario text, token text, expira_em timestamptz, clinica_slug text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_portal public.oricse_portal_tutores;
begin
  select p.* into v_portal from public.oricse_portal_tutores p where p.tutor_id = p_tutor_id;
  if not found or auth.uid() is null
    or not coalesce(public.oricse_usuario_pode_permissao(v_portal.clinica_id, 'recepcao.cadastros.editar'), false)
    or not coalesce(public.oricse_plano_permite(v_portal.clinica_id, 'portal_tutor.acesso'), false) then
    raise exception 'Sem permissão para convidar este tutor.' using errcode = '42501';
  end if;
  if not v_portal.ativo or v_portal.auth_user_id is not null then
    raise exception 'Este cadastro não está disponível para primeiro acesso.';
  end if;

  return query select v_portal.usuario, c.codigo_fixo, v_portal.convite_expira_em, v_portal.clinica_slug
    from oricse_portal_privado.codigos_ativacao c where c.portal_id = v_portal.id;
end;
$$;
