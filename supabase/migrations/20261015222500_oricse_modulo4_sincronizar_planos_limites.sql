create or replace function public.oricse_sincronizar_nome_plano_clinicas()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.nome is distinct from new.nome then
    update public.clinicas set plano=new.nome, updated_at=now() where plano=old.nome;
  end if;
  if old.codigo is distinct from new.codigo then
    update public.clinicas set plano=new.codigo, updated_at=now() where plano=old.codigo;
  end if;
  return new;
end;
$$;

drop trigger if exists oricse_planos_sincronizar_clinicas on public.oricse_planos;
create trigger oricse_planos_sincronizar_clinicas
after update of nome,codigo on public.oricse_planos
for each row execute function public.oricse_sincronizar_nome_plano_clinicas();

create or replace function public.oricse_ajustar_limite_ao_trocar_plano()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  limite_antigo integer;
  limite_novo integer;
  usuarios_ativos integer;
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
    select count(*)::integer into usuarios_ativos
    from public.clinica_usuarios cu
    where cu.clinica_id=old.id and cu.ativo=true;
    if new.limite_usuarios < usuarios_ativos then
      raise exception 'O limite de usuários (%) não pode ser menor que a quantidade ativa atual (%).', new.limite_usuarios, usuarios_ativos using errcode='23514';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists clinicas_ajustar_limite_plano on public.clinicas;
create trigger clinicas_ajustar_limite_plano
before insert or update of plano,limite_usuarios on public.clinicas
for each row execute function public.oricse_ajustar_limite_ao_trocar_plano();
