-- Excluir uma solicitação também bloqueia e move a clínica vinculada à Lixeira.
-- A restauração mantém o funcionamento bloqueado até autorização explícita.
-- Não exclui dados fisicamente; tudo ocorre na mesma transação.
create or replace function public.oricse_admin_lixeira_mover(p_tipo text,p_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_nome text; v_clinica uuid; v_agora timestamptz:=now(); v_vinculos int;
begin
 if not public.oricse_is_platform_admin() then raise exception 'Acesso negado ao Administrador' using errcode='42501'; end if;
 if p_tipo='solicitacao' then
   select clinica_nome,clinica_criada_id into v_nome,v_clinica from public.oricse_contratacoes where id=p_id for update;
   if not found then raise exception 'Solicitação não encontrada' using errcode='P0002'; end if;
   if v_clinica is not null then
     -- Impede ocultar uma clínica que possua outra contratação vigente.
     select count(*) into v_vinculos from public.oricse_contratacoes
       where clinica_criada_id=v_clinica and id<>p_id and excluido_em is null and status not in ('cancelada','recusada');
     if v_vinculos>0 then raise exception 'A clínica possui outra solicitação vigente. Exclua a clínica separadamente após revisar os vínculos.' using errcode='23503'; end if;
     perform 1 from public.clinicas where id=v_clinica for update;
   end if;
   update public.oricse_contratacoes
   set excluido_em=coalesce(excluido_em,v_agora),
       expira_lixeira_em=coalesce(expira_lixeira_em,v_agora+interval '360 days'),
       status_antes_exclusao=coalesce(status_antes_exclusao,status),updated_at=v_agora
   where id=p_id;
   if v_clinica is not null then
     update public.clinicas
     set excluido_em=coalesce(excluido_em,v_agora),
         expira_lixeira_em=coalesce(expira_lixeira_em,v_agora+interval '360 days'),
         status_antes_exclusao=coalesce(status_antes_exclusao,status),
         status='bloqueada',updated_at=v_agora
     where id=v_clinica;
   end if;
 elsif p_tipo='clinica' then
   select nome into v_nome from public.clinicas where id=p_id for update;
   if not found then raise exception 'Clínica não encontrada' using errcode='P0002'; end if;
   update public.clinicas
   set excluido_em=coalesce(excluido_em,v_agora),
       expira_lixeira_em=coalesce(expira_lixeira_em,v_agora+interval '360 days'),
       status_antes_exclusao=coalesce(status_antes_exclusao,status),
       status='bloqueada',updated_at=v_agora
   where id=p_id;
   -- Evitar solicitações de clínica excluída aparecendo como prontas na fila.
   update public.oricse_contratacoes
   set excluido_em=coalesce(excluido_em,v_agora),
       expira_lixeira_em=coalesce(expira_lixeira_em,v_agora+interval '360 days'),
       status_antes_exclusao=coalesce(status_antes_exclusao,status),updated_at=v_agora
   where clinica_criada_id=p_id;
 else raise exception 'Tipo não permitido' using errcode='22023'; end if;
 return jsonb_build_object('tipo',p_tipo,'id',p_id,'nome',v_nome,'clinica_vinculada',v_clinica,'prazo_dias',360);
end $$;

create or replace function public.oricse_admin_lixeira_restaurar(p_tipo text,p_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_nome text; v_expira timestamptz; v_clinica uuid;
begin
 if not public.oricse_is_platform_admin() then raise exception 'Acesso negado ao Administrador' using errcode='42501'; end if;
 if p_tipo='solicitacao' then
   select clinica_nome,expira_lixeira_em,clinica_criada_id into v_nome,v_expira,v_clinica
   from public.oricse_contratacoes where id=p_id and excluido_em is not null for update;
   if not found then raise exception 'Solicitação não está na Lixeira' using errcode='P0002'; end if;
   if v_expira<now() then raise exception 'Prazo de recuperação encerrado'; end if;
   update public.oricse_contratacoes set excluido_em=null,expira_lixeira_em=null,status_antes_exclusao=null,updated_at=now() where id=p_id;
   if v_clinica is not null then
     update public.clinicas set excluido_em=null,expira_lixeira_em=null,status_antes_exclusao=null,
       status='bloqueada',updated_at=now()
     where id=v_clinica and excluido_em is not null and expira_lixeira_em>=now();
   end if;
 elsif p_tipo='clinica' then
   select nome,expira_lixeira_em into v_nome,v_expira from public.clinicas where id=p_id and excluido_em is not null for update;
   if not found then raise exception 'Clínica não está na Lixeira' using errcode='P0002'; end if;
   if v_expira<now() then raise exception 'Prazo de recuperação encerrado'; end if;
   update public.clinicas set excluido_em=null,expira_lixeira_em=null,status_antes_exclusao=null,status='bloqueada',updated_at=now() where id=p_id;
   update public.oricse_contratacoes set excluido_em=null,expira_lixeira_em=null,status_antes_exclusao=null,updated_at=now()
     where clinica_criada_id=p_id and excluido_em is not null and expira_lixeira_em>=now();
 else raise exception 'Tipo não permitido' using errcode='22023'; end if;
 return jsonb_build_object('tipo',p_tipo,'id',p_id,'nome',v_nome,'restaurado',true,'clinica_vinculada',v_clinica);
end $$;
revoke all on function public.oricse_admin_lixeira_mover(text,uuid),public.oricse_admin_lixeira_restaurar(text,uuid) from public,anon;
grant execute on function public.oricse_admin_lixeira_mover(text,uuid),public.oricse_admin_lixeira_restaurar(text,uuid) to authenticated;

-- Reconciliação pontual: a solicitação @alvoradapet já está excluída,
-- mas a clínica criada a partir dela permaneceu ativa por causa do bug anterior.
update public.clinicas c
set excluido_em=sol.excluido_em,
    expira_lixeira_em=sol.expira_lixeira_em,
    status_antes_exclusao=coalesce(c.status_antes_exclusao,c.status),
    status='bloqueada',updated_at=now()
from public.oricse_contratacoes sol
where sol.clinica_criada_id=c.id
  and sol.slug_desejado='alvoradapet'
  and sol.excluido_em is not null
  and c.excluido_em is null
  and not exists (select 1 from public.oricse_contratacoes other
    where other.clinica_criada_id=c.id and other.id<>sol.id
      and other.excluido_em is null and other.status not in ('cancelada','recusada'));
