-- Reserva o usuário do portal junto ao cadastro, sem criar senha nem emitir convite.
create function public.oricse_reservar_usuario_portal_tutor(p_tutor public.tutores)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slug text;
  v_partes text[];
  v_primeiro text;
  v_bases text[];
  v_base text;
  v_chave text;
  v_sufixo text := '';
  v_numero integer := 2;
  v_indice integer := 1;
begin
  if exists (
    select 1 from public.oricse_portal_tutores p
    where p.clinica_id = p_tutor.clinica_id and p.tutor_id = p_tutor.id
  ) then return; end if;

  select c.slug into v_slug from public.clinicas c where c.id = p_tutor.clinica_id;
  if v_slug = 'alvorada' and p_tutor.dados->>'demo' = 'true' then return; end if;

  v_partes := regexp_split_to_array(trim(regexp_replace(
    lower(public.oricse_normalizar_nome(p_tutor.nome)), '[^a-z0-9]+', ' ', 'g'
  )), ' +');
  v_primeiro := coalesce(nullif(v_partes[1], ''), 'tutor');
  v_bases := array['tut.' || left(v_primeiro, 36)];
  v_bases := v_bases || array(
    select 'tut.' || left(v_primeiro, 35) || inicial
    from (
      select left(parte, 1) as inicial, min(ordem) as posicao
      from unnest(v_partes) with ordinality as nomes(parte, ordem)
      where ordem > 1 and parte not in ('da', 'das', 'de', 'do', 'dos', 'e')
      group by left(parte, 1)
      order by min(ordem)
    ) sobrenomes
    order by posicao
  );
  if length(v_primeiro) > 1 then
    v_bases := array_append(v_bases, 'tut.' || left(v_primeiro, least(length(v_primeiro) - 1, 36)));
  end if;

  loop
    if v_indice <= cardinality(v_bases) then
      v_chave := v_bases[v_indice];
      v_indice := v_indice + 1;
    else
      v_sufixo := v_numero::text;
      v_base := 'tut.' || left(v_primeiro, 36 - length(v_sufixo));
      v_chave := v_base || v_sufixo;
      v_numero := v_numero + 1;
    end if;
    insert into public.oricse_portal_tutores
      (clinica_id, tutor_id, usuario, usuario_chave, clinica_slug, ativo)
    values (p_tutor.clinica_id, p_tutor.id, '@' || v_chave, v_chave, v_slug, true)
    on conflict do nothing;
    if found then return; end if;

    if exists (
      select 1 from public.oricse_portal_tutores p
      where p.clinica_id = p_tutor.clinica_id and p.tutor_id = p_tutor.id
    ) then return; end if;

  end loop;
end;
$$;

create function public.oricse_tutor_reservar_usuario_ao_cadastrar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.oricse_reservar_usuario_portal_tutor(new);
  return new;
end;
$$;

revoke all on function public.oricse_reservar_usuario_portal_tutor(public.tutores) from public, anon, authenticated;
revoke all on function public.oricse_tutor_reservar_usuario_ao_cadastrar() from public, anon, authenticated;

create trigger tutores_reservar_usuario_portal
after insert on public.tutores
for each row execute function public.oricse_tutor_reservar_usuario_ao_cadastrar();

do $$
declare
  v_tutor public.tutores;
begin
  for v_tutor in select * from public.tutores order by created_at, id loop
    perform public.oricse_reservar_usuario_portal_tutor(v_tutor);
  end loop;
end;
$$;

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
  v_token := encode(extensions.gen_random_bytes(24), 'hex');

  update public.oricse_portal_tutores p
  set ativo = true, clinica_slug = v_slug, convite_token_hash = encode(extensions.digest(v_token, 'sha256'), 'hex'),
      convite_expira_em = v_expira, updated_at = now()
  where p.id = v_portal.id;

  update public.oricse_portal_convites pc
  set token_hash = encode(extensions.digest(v_token, 'sha256'), 'hex'),
      expira_em = v_expira, criado_por = auth.uid()
  where pc.clinica_id = v_tutor.clinica_id and pc.tutor_id = v_tutor.id and pc.usado_em is null;
  if not found then
    insert into public.oricse_portal_convites
      (clinica_id, tutor_id, usuario, usuario_chave, token_hash, expira_em, criado_por)
    values (v_tutor.clinica_id, v_tutor.id, v_portal.usuario, v_portal.usuario_chave,
      encode(extensions.digest(v_token, 'sha256'), 'hex'), v_expira, auth.uid());
  end if;

  return query select v_portal.usuario, v_token, v_expira, v_slug;
end;
$$;

revoke all on function public.oricse_portal_emitir_convite(uuid, text) from public, anon;
grant execute on function public.oricse_portal_emitir_convite(uuid, text) to authenticated;
