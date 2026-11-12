-- Política por clínica: o RT define se o acesso aos receituários e ao assinador requer senha.
-- PIN global embutido no frontend é substituído por verificação no banco.
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.oricse_protecao_documental (
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  area text not null check (area in ('receituario','assinar')),
  exigida boolean not null default true,
  segredo_hash text,
  alterado_por uuid references auth.users(id),
  alterado_em timestamptz not null default now(),
  primary key(clinica_id,area),
  constraint senha_ao_ativar check (not exigida or segredo_hash is not null)
);
create table if not exists public.oricse_protecao_tentativas (
  clinica_id uuid not null,
  area text not null,
  usuario_id uuid not null,
  tentativas integer not null default 0,
  bloqueado_ate timestamptz,
  primary key (clinica_id,area,usuario_id)
);
alter table public.oricse_protecao_documental enable row level security;
alter table public.oricse_protecao_tentativas enable row level security;
revoke all on public.oricse_protecao_documental,public.oricse_protecao_tentativas from public,anon,authenticated;

create or replace function public.oricse_protecao_contexto(p_area text)
returns table(clinica_id uuid, exigida boolean, configurada boolean, pode_configurar boolean)
language plpgsql stable security definer set search_path = ''
as $$
declare cid uuid; papel_atual text;
begin
 if (select auth.uid()) is null then raise exception 'Autenticação necessária'; end if;
 if p_area not in ('receituario','assinar') then raise exception 'Área inválida'; end if;
 select a.clinica_id into cid from public.oricse_clinica_ativa_usuario a
 where a.user_id=(select auth.uid()) limit 1;
 if cid is null then
   select cu.clinica_id into cid from public.clinica_usuarios cu
   where cu.user_id=(select auth.uid()) and cu.ativo=true order by cu.created_at limit 1;
 end if;
 select cu.papel into papel_atual from public.clinica_usuarios cu
 join public.clinicas c on c.id=cu.clinica_id and c.status='ativa' and c.excluido_em is null
 where cu.clinica_id=cid and cu.user_id=(select auth.uid()) and cu.ativo=true limit 1;
 if papel_atual is null then raise exception 'Sem vínculo ativo com a clínica'; end if;
 return query select cid, coalesce(p.exigida,true), coalesce(p.segredo_hash is not null,false), papel_atual='rt'
 from (select 1) s left join public.oricse_protecao_documental p on p.clinica_id=cid and p.area=p_area;
end $$;

create or replace function public.oricse_protecao_configurar(p_area text,p_exigida boolean,p_nova_senha text default null)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare cid uuid; ctx record; segredo text; 
begin
 select * into ctx from public.oricse_protecao_contexto(p_area);
 if not ctx.pode_configurar then raise exception 'Somente o RT pode alterar a proteção documental'; end if;
 cid:=ctx.clinica_id;
 if p_nova_senha is not null and (length(p_nova_senha)<8 or length(p_nova_senha)>128)
 then raise exception 'A senha deve conter de 8 a 128 caracteres'; end if;
 select segredo_hash into segredo from public.oricse_protecao_documental where clinica_id=cid and area=p_area;
 if p_nova_senha is not null then
   segredo:=extensions.crypt(p_nova_senha,extensions.gen_salt('bf',12));
 end if;
 if p_exigida and segredo is null then raise exception 'Defina a senha antes de ativar a exigência'; end if;
 insert into public.oricse_protecao_documental(clinica_id,area,exigida,segredo_hash,alterado_por,alterado_em)
 values(cid,p_area,p_exigida,segredo,(select auth.uid()),now())
 on conflict(clinica_id,area) do update set exigida=excluded.exigida,segredo_hash=excluded.segredo_hash,
 alterado_por=excluded.alterado_por,alterado_em=excluded.alterado_em;
 delete from public.oricse_protecao_tentativas where clinica_id=cid and area=p_area;
 return true;
end $$;

create or replace function public.oricse_protecao_validar(p_area text,p_senha text)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare ctx record; guard record; segredo text; valido boolean;
begin
 select * into ctx from public.oricse_protecao_contexto(p_area);
 if not ctx.exigida then return true; end if;
 if not ctx.configurada then raise exception 'O RT precisa definir a senha desta área'; end if;
 insert into public.oricse_protecao_tentativas(clinica_id,area,usuario_id)
 values(ctx.clinica_id,p_area,(select auth.uid())) on conflict do nothing;
 select * into guard from public.oricse_protecao_tentativas
 where clinica_id=ctx.clinica_id and area=p_area and usuario_id=(select auth.uid()) for update;
 if guard.bloqueado_ate>now() then raise exception 'Muitas tentativas. Aguarde 15 minutos'; end if;
 select segredo_hash into segredo from public.oricse_protecao_documental where clinica_id=ctx.clinica_id and area=p_area;
 valido:=p_senha is not null and length(p_senha)<=128 and extensions.crypt(p_senha,segredo)=segredo;
 if valido then
   update public.oricse_protecao_tentativas set tentativas=0,bloqueado_ate=null
   where clinica_id=ctx.clinica_id and area=p_area and usuario_id=(select auth.uid());
 else
   update public.oricse_protecao_tentativas
   set tentativas=case when guard.tentativas>=4 then 0 else guard.tentativas+1 end,
       bloqueado_ate=case when guard.tentativas>=4 then now()+interval '15 minutes' else null end
   where clinica_id=ctx.clinica_id and area=p_area and usuario_id=(select auth.uid());
 end if;
 return valido;
end $$;

revoke all on function public.oricse_protecao_contexto(text) from public,anon;
revoke all on function public.oricse_protecao_configurar(text,boolean,text) from public,anon;
revoke all on function public.oricse_protecao_validar(text,text) from public,anon;
grant execute on function public.oricse_protecao_contexto(text) to authenticated;
grant execute on function public.oricse_protecao_configurar(text,boolean,text) to authenticated;
grant execute on function public.oricse_protecao_validar(text,text) to authenticated;
