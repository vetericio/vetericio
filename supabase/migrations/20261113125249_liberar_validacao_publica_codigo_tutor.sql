-- A validação roda pela Edge Function com service_role, sem sessão de funcionário.
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
  if not found or not coalesce(public.oricse_clinica_tem_funcionalidade(v_portal.clinica_id, 'portal_tutor.acesso'), false) then
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

revoke all on function public.oricse_portal_verificar_codigo_ativacao(uuid, text, text) from public, anon, authenticated;
grant execute on function public.oricse_portal_verificar_codigo_ativacao(uuid, text, text) to service_role;
