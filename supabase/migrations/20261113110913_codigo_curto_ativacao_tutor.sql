create schema if not exists oricse_portal_privado;
revoke all on schema oricse_portal_privado from public, anon, authenticated;

create table oricse_portal_privado.codigos_ativacao (
  portal_id uuid primary key references public.oricse_portal_tutores(id) on delete cascade,
  codigo_hash text not null,
  convite_chave text not null,
  tentativas smallint not null default 0
);
alter table oricse_portal_privado.codigos_ativacao enable row level security;

-- Serializa as tentativas e permite validar somente pela função de ativação.
create function public.oricse_portal_verificar_codigo_ativacao(p_portal_id uuid, p_convite_chave text, p_codigo text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_codigo oricse_portal_privado.codigos_ativacao;
begin
  select c.* into v_codigo from oricse_portal_privado.codigos_ativacao c
  where c.portal_id = p_portal_id and c.convite_chave = p_convite_chave
  for update;

  if not found then return 'invalido'; end if;
  if v_codigo.tentativas >= 5 then return 'bloqueado'; end if;
  if v_codigo.codigo_hash = encode(extensions.digest(p_portal_id::text || p_codigo, 'sha256'), 'hex') then
    return 'valido';
  end if;

  update oricse_portal_privado.codigos_ativacao c
  set tentativas = tentativas + 1
  where c.portal_id = p_portal_id;
  return case when v_codigo.tentativas = 4 then 'bloqueado' else 'invalido' end;
end;
$$;
revoke all on function public.oricse_portal_verificar_codigo_ativacao(uuid, text, text) from public, anon, authenticated;
grant execute on function public.oricse_portal_verificar_codigo_ativacao(uuid, text, text) to service_role;

-- Preserva a assinatura para clientes antigos. O usuário vem do cadastro.
create or replace function public.oricse_portal_emitir_convite(p_tutor_id uuid, p_usuario text)
returns table(usuario text, token text, expira_em timestamptz, clinica_slug text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tutor public.tutores;
  v_portal public.oricse_portal_tutores;
  v_token text;
  v_anterior text;
  v_indice integer;
  v_bytes bytea;
  v_chave text;
  v_expira timestamptz := now() + interval '48 hours';
  v_slug text;
begin
  select t.* into v_tutor from public.tutores t where t.id = p_tutor_id;
  if not found then
    raise exception 'Tutor não encontrado.' using errcode = 'P0002';
  end if;
  if auth.uid() is null or not coalesce(public.oricse_usuario_pode_permissao(v_tutor.clinica_id, 'recepcao.cadastros.editar'), false) then
    raise exception 'Sem permissão para ativar o portal deste tutor.' using errcode = '42501';
  end if;
  if not coalesce(public.oricse_plano_permite(v_tutor.clinica_id, 'portal_tutor.acesso'), false) then
    raise exception 'O portal do tutor não está incluído no plano desta clínica.' using errcode = '42501';
  end if;

  perform public.oricse_reservar_usuario_portal_tutor(v_tutor);
  select p.* into v_portal from public.oricse_portal_tutores p
  where p.clinica_id = v_tutor.clinica_id and p.tutor_id = v_tutor.id
  for update;
  if not found then
    raise exception 'Este cadastro não tem acesso por convite.' using errcode = 'P0001';
  end if;
  if v_portal.auth_user_id is not null then
    raise exception 'Este cadastro já possui uma conta no portal.' using errcode = 'P0001';
  end if;

  select c.slug into v_slug from public.clinicas c where c.id = v_tutor.clinica_id;
  select ca.codigo_hash into v_anterior
  from oricse_portal_privado.codigos_ativacao ca where ca.portal_id = v_portal.id;

  loop
    -- Descarte o intervalo excedente para manter a distribuição uniforme.
    v_bytes := extensions.gen_random_bytes(3);
    v_indice := get_byte(v_bytes, 0) * 65536 + get_byte(v_bytes, 1) * 256 + get_byte(v_bytes, 2);
    continue when v_indice >= 16764800;
    v_indice := v_indice % 67600;
    v_token := chr(65 + v_indice / 2600) || chr(65 + (v_indice / 100) % 26)
      || lpad((v_indice % 100)::text, 2, '0');
    exit when v_anterior is distinct from encode(extensions.digest(v_portal.id::text || v_token, 'sha256'), 'hex');
  end loop;

  -- Marcador aleatório para vincular a ativação ao convite validado.
  v_chave := encode(extensions.gen_random_bytes(32), 'hex');
  insert into oricse_portal_privado.codigos_ativacao (portal_id, codigo_hash, convite_chave, tentativas)
  values (v_portal.id, encode(extensions.digest(v_portal.id::text || v_token, 'sha256'), 'hex'), v_chave, 0)
  on conflict (portal_id) do update
  set codigo_hash = excluded.codigo_hash, convite_chave = excluded.convite_chave, tentativas = 0;

  update public.oricse_portal_tutores p
  set ativo = true, clinica_slug = v_slug, convite_token_hash = v_chave,
      convite_expira_em = v_expira, updated_at = now()
  where p.id = v_portal.id;

  update public.oricse_portal_convites pc
  set token_hash = v_chave,
      expira_em = v_expira, criado_por = auth.uid()
  where pc.clinica_id = v_tutor.clinica_id and pc.tutor_id = v_tutor.id and pc.usado_em is null;
  if not found then
    insert into public.oricse_portal_convites
      (clinica_id, tutor_id, usuario, usuario_chave, token_hash, expira_em, criado_por)
    values (v_tutor.clinica_id, v_tutor.id, v_portal.usuario, v_portal.usuario_chave,
      v_chave, v_expira, auth.uid());
  end if;

  return query select v_portal.usuario, v_token, v_expira, v_slug;
end;
$$;

revoke all on function public.oricse_portal_emitir_convite(uuid, text) from public, anon;
grant execute on function public.oricse_portal_emitir_convite(uuid, text) to authenticated;
