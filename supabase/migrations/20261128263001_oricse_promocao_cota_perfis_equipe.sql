-- Aplicada depois da migração comercial que cria o benefício privado.
-- A cota de agendas continua sendo a contratada, independentemente do bônus de perfis.
create or replace function private.oricse_cota_perfis_equipe(p_clinica_id uuid)
returns table (ilimitado boolean, limite integer, bonus_perfis integer)
language sql stable security definer
set search_path = ''
as $$
  select coalesce(b.ilimitado, false),
         case when b.ilimitado is true then null::integer
              else coalesce(c.limite_usuarios, p.usuarios_inclusos, 1)
                   + coalesce(b.bonus_perfis, 0) end,
         coalesce(b.bonus_perfis, 0)
  from public.clinicas c
  left join lateral (
    select pl.usuarios_inclusos
    from public.oricse_planos pl
    where pl.codigo = c.plano or pl.nome = c.plano
    order by (pl.codigo = c.plano) desc, pl.id
    limit 1
  ) p on true
  left join lateral private.oricse_promocao_perfis_ativa(c.id) b on true
  where c.id = p_clinica_id and c.excluido_em is null;
$$;

revoke all on function private.oricse_cota_perfis_equipe(uuid) from public, anon, authenticated;

create or replace function public.oricse_cota_perfis_clinica(p_clinica_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  resultado jsonb;
  solicitante uuid := auth.uid();
begin
  if coalesce(auth.role(), '') <> 'service_role' and (
    solicitante is null or not (
      exists(select 1 from public.app_users u where u.user_id = solicitante and u.role = 'admin')
      or exists(select 1 from public.clinica_usuarios cu
                where cu.user_id = solicitante and cu.clinica_id = p_clinica_id and cu.ativo)
    )
  ) then
    raise exception 'Sem permissão para consultar os perfis desta clínica.' using errcode='42501';
  end if;
  select jsonb_build_object('ilimitado', q.ilimitado, 'limite', q.limite, 'bonus_perfis', q.bonus_perfis)
    into resultado from private.oricse_cota_perfis_equipe(p_clinica_id) q;
  if resultado is null then
    raise exception 'Não foi possível consultar a cota de perfis desta clínica.' using errcode='23503';
  end if;
  return resultado;
end;
$$;

revoke all on function public.oricse_cota_perfis_clinica(uuid) from public, anon;
grant execute on function public.oricse_cota_perfis_clinica(uuid) to authenticated, service_role;

create or replace function public.oricse_validar_limite_usuarios()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  cota record;
  ativos integer;
begin
  if not new.ativo then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.ativo is true and old.clinica_id = new.clinica_id and old.user_id = new.user_id then
    return new;
  end if;
  -- Preserva a trava transacional de vínculo por clínica da função publicada.
  perform 1 from public.clinicas c where c.id=new.clinica_id for update;
  select * into cota from private.oricse_cota_perfis_equipe(new.clinica_id);
  if not found then
    raise exception 'Clínica não encontrada ou indisponível.' using errcode='23503';
  end if;
  if cota.ilimitado then
    return new;
  end if;
  if cota.limite is null or cota.limite < 1 then
    raise exception 'Plano da clínica sem limite de usuários válido.' using errcode='23514';
  end if;
  select count(*)::integer into ativos from public.clinica_usuarios cu
  where cu.clinica_id=new.clinica_id and cu.ativo=true and cu.user_id<>new.user_id;
  if ativos >= cota.limite then
    raise exception 'Limite de usuários ativos do plano atingido (%).', cota.limite using errcode='23514';
  end if;
  return new;
end;
$$;

revoke all on function public.oricse_validar_limite_usuarios() from public, anon, authenticated;

-- Esta proteção pode não estar instalada em bancos criados antes da migração
-- original; reinstala somente o gatilho de cota, preservando os demais.
drop trigger if exists clinica_usuarios_validar_limite_plano on public.clinica_usuarios;
create trigger clinica_usuarios_validar_limite_plano
before insert or update of clinica_id,user_id,ativo on public.clinica_usuarios
for each row execute function public.oricse_validar_limite_usuarios();

CREATE OR REPLACE FUNCTION public.oricse_ajustar_limite_ao_trocar_plano()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  limite_antigo integer;
  limite_novo integer;
  usuarios_ativos integer;
  limite_perfis integer;
  beneficio record;
begin
  if tg_op='INSERT' then
    if new.limite_usuarios is null then
      select p.usuarios_inclusos into limite_novo
      from public.oricse_planos p
      where p.codigo=new.plano or p.nome=new.plano
      limit 1;
      new.limite_usuarios := coalesce(limite_novo,1);
    end if;
    return new;
  end if;

  if new.plano is distinct from old.plano then
    select p.usuarios_inclusos into limite_antigo
    from public.oricse_planos p
    where p.codigo=old.plano or p.nome=old.plano
    limit 1;
    select p.usuarios_inclusos into limite_novo
    from public.oricse_planos p
    where p.codigo=new.plano or p.nome=new.plano
    limit 1;
    if old.limite_usuarios is null or old.limite_usuarios=limite_antigo then
      new.limite_usuarios := coalesce(limite_novo,new.limite_usuarios,1);
    end if;
  end if;

  if new.limite_usuarios is not null then
    limite_perfis := new.limite_usuarios;
    -- A promoção só pode complementar o plano original. Trocas usam o limite
    -- normal do destino e mantêm o aviso existente se a equipe exceder a cota.
    if new.plano is not distinct from old.plano then
      select * into beneficio from private.oricse_promocao_perfis_ativa(old.id);
      if beneficio.ilimitado is true then
        return new;
      end if;
      limite_perfis := limite_perfis + coalesce(beneficio.bonus_perfis, 0);
    end if;
    select count(*)::integer into usuarios_ativos
    from public.clinica_usuarios cu
    where cu.clinica_id=old.id and cu.ativo=true;
    if limite_perfis < usuarios_ativos then
      raise exception 'O limite de usuários (%) não pode ser menor que a quantidade ativa atual (%).', limite_perfis, usuarios_ativos using errcode='23514';
    end if;
  end if;
  return new;
end;
$function$;

revoke all on function public.oricse_ajustar_limite_ao_trocar_plano() from public, anon, authenticated;
