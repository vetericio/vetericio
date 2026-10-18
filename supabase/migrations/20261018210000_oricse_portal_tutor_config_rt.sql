create table if not exists public.oricse_portal_tutor_config (
 clinica_id uuid primary key references public.clinicas(id) on delete cascade,
 mensagem_boas_vindas text not null default 'Bem-vindo ao Portal do Tutor!',
 telefone_publico text not null default '',
 whatsapp_publico text not null default '',
 instrucoes_agendamento text not null default '',
 exibir_agendamento boolean not null default true,
 exibir_documentos boolean not null default true,
 updated_at timestamptz not null default now()
);
alter table public.oricse_portal_tutor_config enable row level security;
revoke all on public.oricse_portal_tutor_config from anon, authenticated;
create or replace function public.oricse_portal_config_gerenciar(p_clinica_id uuid,p_mensagem text default null,p_telefone text default null,p_whatsapp text default null,p_instrucoes text default null,p_agendamento boolean default null,p_documentos boolean default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare perfil text; papel text; cfg public.oricse_portal_tutor_config;
begin
 select role into perfil from public.app_users where user_id=auth.uid();
 select cu.papel into papel from public.clinica_usuarios cu where cu.clinica_id=p_clinica_id and cu.user_id=auth.uid() and cu.ativo=true limit 1;
 if perfil is distinct from 'admin' and coalesce(papel,'') not in ('rt','responsavel','admin_clinica')
 then raise exception 'Apenas o RT, responsável ou administrador pode configurar o portal'; end if;
 if not exists(select 1 from public.clinicas where id=p_clinica_id) then raise exception 'Clínica inexistente'; end if;
 if p_mensagem is not null then
  if length(p_mensagem)>500 or length(coalesce(p_telefone,''))>40 or length(coalesce(p_whatsapp,''))>40 or length(coalesce(p_instrucoes,''))>1000
  then raise exception 'Texto acima do limite permitido'; end if;
  insert into public.oricse_portal_tutor_config(clinica_id,mensagem_boas_vindas,telefone_publico,whatsapp_publico,instrucoes_agendamento,exibir_agendamento,exibir_documentos)
  values(p_clinica_id,p_mensagem,coalesce(p_telefone,''),coalesce(p_whatsapp,''),coalesce(p_instrucoes,''),coalesce(p_agendamento,true),coalesce(p_documentos,true))
  on conflict (clinica_id) do update set mensagem_boas_vindas=excluded.mensagem_boas_vindas,telefone_publico=excluded.telefone_publico,whatsapp_publico=excluded.whatsapp_publico,instrucoes_agendamento=excluded.instrucoes_agendamento,exibir_agendamento=excluded.exibir_agendamento,exibir_documentos=excluded.exibir_documentos,updated_at=now();
 end if;
 select * into cfg from public.oricse_portal_tutor_config where clinica_id=p_clinica_id;
 return coalesce(to_jsonb(cfg) - 'clinica_id' - 'updated_at',
 '{"mensagem_boas_vindas":"Bem-vindo ao Portal do Tutor!","telefone_publico":"","whatsapp_publico":"","instrucoes_agendamento":"","exibir_agendamento":true,"exibir_documentos":true}'::jsonb);
end $$;
revoke all on function public.oricse_portal_config_gerenciar(uuid,text,text,text,text,boolean,boolean) from public;
grant execute on function public.oricse_portal_config_gerenciar(uuid,text,text,text,text,boolean,boolean) to authenticated;
create or replace function public.oricse_portal_config_publica(p_slug text)
returns jsonb language sql stable security definer set search_path=public as $$
 select coalesce((select to_jsonb(c) - 'clinica_id' - 'updated_at' from public.oricse_portal_tutor_config c
 join public.clinicas cl on cl.id=c.clinica_id where cl.slug=p_slug limit 1),
 '{"mensagem_boas_vindas":"Bem-vindo ao Portal do Tutor!","telefone_publico":"","whatsapp_publico":"","instrucoes_agendamento":"","exibir_agendamento":true,"exibir_documentos":true}'::jsonb);
$$;
revoke all on function public.oricse_portal_config_publica(text) from public;
grant execute on function public.oricse_portal_config_publica(text) to anon,authenticated;
