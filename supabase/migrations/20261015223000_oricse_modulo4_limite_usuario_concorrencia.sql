create or replace function public.oricse_validar_limite_usuarios()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  limite integer;
  ativos integer;
begin
  if not new.ativo then
    return new;
  end if;

  -- Serializa alterações de vínculo da mesma clínica para impedir que duas
  -- inclusões simultâneas ultrapassem o limite do plano.
  perform 1 from public.clinicas c where c.id=new.clinica_id for update;

  limite := public.oricse_limite_usuarios_clinica(new.clinica_id);
  if limite is null or limite < 1 then
    raise exception 'Plano da clínica sem limite de usuários válido.' using errcode='23514';
  end if;

  select count(*)::integer into ativos
  from public.clinica_usuarios cu
  where cu.clinica_id=new.clinica_id
    and cu.ativo=true
    and cu.user_id<>new.user_id;

  if ativos >= limite then
    raise exception 'Limite de usuários ativos do plano atingido (%).', limite using errcode='23514';
  end if;
  return new;
end;
$$;

revoke all on function public.oricse_validar_limite_usuarios() from public, anon, authenticated;
revoke all on function public.oricse_preencher_matriz_nova_funcionalidade() from public, anon, authenticated;
revoke all on function public.oricse_preencher_matriz_novo_plano() from public, anon, authenticated;
revoke all on function public.oricse_sincronizar_nome_plano_clinicas() from public, anon, authenticated;
revoke all on function public.oricse_ajustar_limite_ao_trocar_plano() from public, anon, authenticated;
