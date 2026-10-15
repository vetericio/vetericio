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

  -- Clínicas que ainda usam o limite padrão acompanham a alteração do plano.
  -- Se já houver mais usuários ativos que o novo limite, preserva os atuais,
  -- mas não abre vagas adicionais até a equipe voltar ao limite contratado.
  if old.usuarios_inclusos is distinct from new.usuarios_inclusos then
    update public.clinicas c
    set limite_usuarios=greatest(
          new.usuarios_inclusos,
          (select count(*)::integer from public.clinica_usuarios cu where cu.clinica_id=c.id and cu.ativo=true)
        ),
        updated_at=now()
    where (c.plano=new.nome or c.plano=new.codigo or c.plano=old.nome or c.plano=old.codigo)
      and c.limite_usuarios=old.usuarios_inclusos;
  end if;
  return new;
end;
$$;

drop trigger if exists oricse_planos_sincronizar_clinicas on public.oricse_planos;
create trigger oricse_planos_sincronizar_clinicas
after update of nome,codigo,usuarios_inclusos on public.oricse_planos
for each row execute function public.oricse_sincronizar_nome_plano_clinicas();

revoke all on function public.oricse_sincronizar_nome_plano_clinicas() from public,anon,authenticated;
