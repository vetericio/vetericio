-- Canal de contato por clínica, editável somente pelo administrador.
alter table public.oricse_portal_tutor_config
 add column if not exists canais_contato jsonb not null default '{}'::jsonb;
create or replace function public.oricse_portal_contatos_admin(
 p_clinica_id uuid,
 p_canais jsonb default null
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_perfil text;v_papel text;v_cfg jsonb;v_chave text;v_valor text;
begin
 if auth.uid() is null then raise exception 'Autenticação obrigatória.' using errcode='42501';end if;
 select role into v_perfil from public.app_users where user_id=auth.uid();
 select papel into v_papel from public.clinica_usuarios where clinica_id=p_clinica_id and user_id=auth.uid() and ativo=true limit 1;
 if coalesce(v_perfil,'')<>'admin' and coalesce(v_papel,'')<>'admin_clinica' then
   raise exception 'Somente administradores podem configurar os contatos do portal.' using errcode='42501';
 end if;
 if not exists(select 1 from public.clinicas where id=p_clinica_id) then raise exception 'Clínica inexistente.';end if;
 if p_canais is not null then
   if jsonb_typeof(p_canais)<>'object' or (select count(*) from jsonb_object_keys(p_canais))>12 then
     raise exception 'Formato de contatos inválido.' using errcode='22023';
   end if;
   for v_chave,v_valor in select key,value from jsonb_each_text(p_canais) loop
     if v_chave not in ('whatsapp','instagram','facebook','x','tiktok','youtube','site','email','telefone','endereco','horario','linkedin') then
       raise exception 'Campo de contato inválido.' using errcode='22023';
     end if;
     if length(v_valor)>400 then raise exception 'Contato acima do limite.' using errcode='22023';end if;
     if v_chave in ('instagram','facebook','x','tiktok','youtube','site','linkedin') and v_valor<>'' and v_valor !~* '^https://[^[:space:]<>]+$' then
       raise exception 'Links de redes sociais devem começar com https://.' using errcode='22023';
     end if;
     if v_chave='email' and v_valor<>'' and v_valor !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
       raise exception 'E-mail inválido.' using errcode='22023';
     end if;
   end loop;
   insert into public.oricse_portal_tutor_config(clinica_id,canais_contato)
   values(p_clinica_id,p_canais)
   on conflict(clinica_id) do update set canais_contato=excluded.canais_contato,updated_at=now();
 end if;
 select canais_contato into v_cfg from public.oricse_portal_tutor_config where clinica_id=p_clinica_id;
 return coalesce(v_cfg,'{}'::jsonb);
end $$;
revoke all on function public.oricse_portal_contatos_admin(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.oricse_portal_contatos_admin(uuid,jsonb) to authenticated;
