-- Branding do Portal do Tutor: somente admins da clínica ou admin global podem editar.
alter table public.oricse_portal_tutor_config
  add column if not exists nome_exibicao text not null default '',
  add column if not exists logo_clinica_url text not null default '',
  add column if not exists logo_cabecalho_url text not null default '',
  add column if not exists titulo_cabecalho text not null default 'PORTAL DO TUTOR',
  add column if not exists subtitulo_cabecalho text not null default 'Acompanhe seus pets, agende serviços e acesse documentos em um só lugar.';

create or replace function public.oricse_portal_marca_admin(
 p_clinica_id uuid,
 p_nome text default null,
 p_logo_clinica text default null,
 p_logo_cabecalho text default null,
 p_titulo text default null,
 p_subtitulo text default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_perfil text;
 v_papel text;
 v_cfg public.oricse_portal_tutor_config;
 v_nome text;
 v_logo text;
 v_cabecalho text;
 v_titulo text;
 v_subtitulo text;
begin
 if (select auth.uid()) is null then raise exception 'Autenticação obrigatória.' using errcode='42501';end if;
 select role into v_perfil from public.app_users where user_id=(select auth.uid());
 select papel into v_papel from public.clinica_usuarios
 where clinica_id=p_clinica_id and user_id=(select auth.uid()) and ativo=true limit 1;
 if coalesce(v_perfil,'')<>'admin' and coalesce(v_papel,'')<>'admin_clinica' then
   raise exception 'Somente o administrador da clínica pode alterar a identidade do portal.' using errcode='42501';
 end if;
 if not exists(select 1 from public.clinicas where id=p_clinica_id) then
   raise exception 'Clínica inexistente.' using errcode='P0002';
 end if;
 if p_nome is not null then
   v_nome:=trim(p_nome);v_logo:=trim(coalesce(p_logo_clinica,''));
   v_cabecalho:=trim(coalesce(p_logo_cabecalho,''));
   v_titulo:=trim(coalesce(p_titulo,''));
   v_subtitulo:=trim(coalesce(p_subtitulo,''));
   if length(v_nome)>160 or length(v_logo)>1000 or length(v_cabecalho)>1000
      or length(v_titulo)>90 or length(v_subtitulo)>300 or v_titulo='' then
     raise exception 'Preencha os campos dentro dos limites permitidos.' using errcode='22023';
   end if;
   if (v_logo<>'' and v_logo !~* '^https://[^[:space:]<>]+$') or
      (v_cabecalho<>'' and v_cabecalho !~* '^https://[^[:space:]<>]+$') then
      raise exception 'A logo precisa ter um endereço HTTPS válido.' using errcode='22023';
   end if;
   insert into public.oricse_portal_tutor_config
     (clinica_id,nome_exibicao,logo_clinica_url,logo_cabecalho_url,titulo_cabecalho,subtitulo_cabecalho)
   values (p_clinica_id,v_nome,v_logo,v_cabecalho,v_titulo,v_subtitulo)
   on conflict(clinica_id) do update set
     nome_exibicao=excluded.nome_exibicao,
     logo_clinica_url=excluded.logo_clinica_url,
     logo_cabecalho_url=excluded.logo_cabecalho_url,
     titulo_cabecalho=excluded.titulo_cabecalho,
     subtitulo_cabecalho=excluded.subtitulo_cabecalho,
     updated_at=now();
 end if;
 select * into v_cfg from public.oricse_portal_tutor_config where clinica_id=p_clinica_id;
 return coalesce(to_jsonb(v_cfg)-'clinica_id'-'updated_at','{}'::jsonb);
end $$;
revoke all on function public.oricse_portal_marca_admin(uuid,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.oricse_portal_marca_admin(uuid,text,text,text,text,text) to authenticated;
