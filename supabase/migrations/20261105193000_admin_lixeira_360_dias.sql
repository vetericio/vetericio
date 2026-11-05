-- Lixeira administrativa com recuperação de até 360 dias.
-- Não apagar registros relacionados no ato de exclusão. Operações exclusivas do Admin.
alter table public.oricse_contratacoes
  add column if not exists excluido_em timestamptz,
  add column if not exists expira_lixeira_em timestamptz,
  add column if not exists status_antes_exclusao text;
alter table public.clinicas
  add column if not exists excluido_em timestamptz,
  add column if not exists expira_lixeira_em timestamptz,
  add column if not exists status_antes_exclusao text;
create index if not exists idx_oricse_contratacoes_lixeira on public.oricse_contratacoes (excluido_em) where excluido_em is not null;
create index if not exists idx_clinicas_lixeira on public.clinicas (excluido_em) where excluido_em is not null;
create or replace function public.oricse_admin_lixeira_mover(p_tipo text,p_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_nome text; v_clinica uuid;
begin
 if not public.oricse_is_platform_admin() then raise exception 'Acesso negado ao Administrador' using errcode='42501'; end if;
 if p_tipo='solicitacao' then
   select clinica_nome,clinica_criada_id into v_nome,v_clinica from public.oricse_contratacoes where id=p_id for update;
   if not found then raise exception 'Solicitação não encontrada' using errcode='P0002'; end if;
   update public.oricse_contratacoes set excluido_em=coalesce(excluido_em,now()),expira_lixeira_em=coalesce(expira_lixeira_em,now()+interval '360 days'),status_antes_exclusao=coalesce(status_antes_exclusao,status),updated_at=now() where id=p_id;
   -- Não excluir clínica vinculada automaticamente: precisa de exclusão específica.
 elsif p_tipo='clinica' then
   select nome into v_nome from public.clinicas where id=p_id for update;
   if not found then raise exception 'Clínica não encontrada' using errcode='P0002'; end if;
   update public.clinicas set excluido_em=coalesce(excluido_em,now()),expira_lixeira_em=coalesce(expira_lixeira_em,now()+interval '360 days'),status_antes_exclusao=coalesce(status_antes_exclusao,status),status='bloqueada',updated_at=now() where id=p_id;
 else raise exception 'Tipo não permitido' using errcode='22023';
 end if;
 return jsonb_build_object('tipo',p_tipo,'id',p_id,'nome',v_nome,'prazo_dias',360);
end $$;
create or replace function public.oricse_admin_lixeira_restaurar(p_tipo text,p_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_nome text; v_expira timestamptz;
begin
 if not public.oricse_is_platform_admin() then raise exception 'Acesso negado ao Administrador' using errcode='42501'; end if;
 if p_tipo='solicitacao' then
   select clinica_nome,expira_lixeira_em into v_nome,v_expira from public.oricse_contratacoes where id=p_id and excluido_em is not null for update;
   if not found then raise exception 'Solicitação não está na lixeira' using errcode='P0002'; end if;
   if v_expira<now() then raise exception 'Prazo de recuperação encerrado'; end if;
   update public.oricse_contratacoes set excluido_em=null,expira_lixeira_em=null,status_antes_exclusao=null,updated_at=now() where id=p_id;
 elsif p_tipo='clinica' then
   select nome,expira_lixeira_em into v_nome,v_expira from public.clinicas where id=p_id and excluido_em is not null for update;
   if not found then raise exception 'Clínica não está na lixeira' using errcode='P0002'; end if;
   if v_expira<now() then raise exception 'Prazo de recuperação encerrado'; end if;
   -- Restauração não libera automaticamente o acesso. Requer aprovação administrativa.
   update public.clinicas set excluido_em=null,expira_lixeira_em=null,status_antes_exclusao=null,status='bloqueada',updated_at=now() where id=p_id;
 else raise exception 'Tipo não permitido' using errcode='22023'; end if;
 return jsonb_build_object('tipo',p_tipo,'id',p_id,'nome',v_nome,'restaurado',true);
end $$;
revoke all on function public.oricse_admin_lixeira_mover(text,uuid), public.oricse_admin_lixeira_restaurar(text,uuid) from public;
grant execute on function public.oricse_admin_lixeira_mover(text,uuid),public.oricse_admin_lixeira_restaurar(text,uuid) to authenticated;
