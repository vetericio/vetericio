create or replace function public.oricse_portal_promocao_publicar(p_clinica uuid,p_promocao uuid,p_publicar boolean)
returns void language plpgsql security definer set search_path=public as $$
declare papel text; geral boolean;
begin
 if auth.uid() is null then raise exception 'Autenticação necessária'; end if;
 select exists(select 1 from public.app_users where user_id=auth.uid() and role='admin') into geral;
 select cu.papel into papel from public.clinica_usuarios cu where cu.user_id=auth.uid() and cu.clinica_id=p_clinica and cu.ativo=true limit 1;
 if not geral and coalesce(papel,'') not in ('rt','responsavel','admin_clinica') then raise exception 'Acesso restrito ao RT e administradores';end if;
 update public.oricse_portal_promocoes set ativo=p_publicar where id=p_promocao and clinica_id=p_clinica;
 if not found then raise exception 'Promoção não encontrada nesta clínica'; end if;
end $$;
revoke all on function public.oricse_portal_promocao_publicar(uuid,uuid,boolean) from public;
grant execute on function public.oricse_portal_promocao_publicar(uuid,uuid,boolean) to authenticated;
