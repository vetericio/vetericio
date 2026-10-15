create or replace function public.oricse_normalizar_usuario_portal(p_usuario text)
returns text
language sql
stable
set search_path='public'
as $$
  select trim(both '.' from regexp_replace(
    regexp_replace(lower(unaccent(trim(leading '@' from coalesce(p_usuario,'')))), '[^a-z0-9._-]+', '.', 'g'),
    '\\.{2,}', '.', 'g'
  ));
$$;

create or replace function public.oricse_portal_identidade_atual()
returns table(clinica_id uuid,tutor_id uuid,portal_id uuid,usuario text)
language sql
stable
security definer
set search_path=''
as $$
  select pt.clinica_id,pt.tutor_id,pt.id,pt.usuario
  from public.oricse_portal_tutores pt
  join public.clinicas c on c.id=pt.clinica_id and c.status='ativa'
  where pt.auth_user_id=(select auth.uid()) and pt.ativo=true
  limit 1;
$$;

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
  select t.clinica_id into v_clinica from public.tutores t where t.id=p_tutor_id;
  if v_clinica is null then raise exception 'Tutor não encontrado.' using errcode='P0002'; end if;
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
  if exists(select 1 from public.oricse_portal_tutores pt where pt.clinica_id=v_clinica and pt.usuario_chave=v_usuario and pt.tutor_id<>p_tutor_id) then
    raise exception 'Este usuário já está em uso nesta clínica.' using errcode='23505';
  end if;
  delete from public.oricse_portal_convites pc where pc.clinica_id=v_clinica and pc.tutor_id=p_tutor_id and pc.usado_em is null;
  v_token:=encode(gen_random_bytes(24),'hex');
  insert into public.oricse_portal_convites(clinica_id,tutor_id,usuario,usuario_chave,token_hash,expira_em,criado_por)
  values(v_clinica,p_tutor_id,'@'||v_usuario,v_usuario,encode(digest(v_token,'sha256'),'hex'),v_expira,(select auth.uid()));
  select c.slug into v_slug from public.clinicas c where c.id=v_clinica;
  return query select '@'||v_usuario,v_token,v_expira,v_slug;
end;
$$;

create or replace function public.oricse_portal_meu_contexto()
returns table(
  clinica_id uuid,clinica_nome text,clinica_slug text,clinica_logo_url text,
  tutor_id uuid,tutor_nome text,tutor_telefone text,tutor_email text,usuario text
)
language sql
stable
security definer
set search_path=''
as $$
  select c.id,c.nome,c.slug,c.logo_url,t.id,t.nome,t.telefone,t.email,pt.usuario
  from public.oricse_portal_tutores pt
  join public.clinicas c on c.id=pt.clinica_id and c.status='ativa'
  join public.tutores t on t.id=pt.tutor_id and t.clinica_id=pt.clinica_id
  where pt.auth_user_id=(select auth.uid()) and pt.ativo=true
  limit 1;
$$;

create or replace function public.oricse_portal_atualizar_perfil(p_telefone text,p_email text)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare v_clinica uuid; v_tutor uuid;
begin
  select i.clinica_id,i.tutor_id into v_clinica,v_tutor from public.oricse_portal_identidade_atual() i;
  if v_tutor is null then raise exception 'Acesso de tutor inválido.' using errcode='42501'; end if;
  update public.tutores set telefone=nullif(trim(p_telefone),''),email=nullif(lower(trim(p_email)),'') where id=v_tutor and clinica_id=v_clinica;
end;
$$;

revoke all on function public.oricse_normalizar_usuario_portal(text) from public,anon;
revoke all on function public.oricse_portal_identidade_atual() from public,anon;
revoke all on function public.oricse_portal_emitir_convite(uuid,text) from public,anon;
revoke all on function public.oricse_portal_meu_contexto() from public,anon;
revoke all on function public.oricse_portal_atualizar_perfil(text,text) from public,anon;
grant execute on function public.oricse_normalizar_usuario_portal(text) to authenticated;
grant execute on function public.oricse_portal_identidade_atual() to authenticated;
grant execute on function public.oricse_portal_emitir_convite(uuid,text) to authenticated;
grant execute on function public.oricse_portal_meu_contexto() to authenticated;
grant execute on function public.oricse_portal_atualizar_perfil(text,text) to authenticated;
