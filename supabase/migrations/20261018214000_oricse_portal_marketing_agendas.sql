create table if not exists public.oricse_portal_extras (
 clinica_id uuid primary key references public.clinicas(id) on delete cascade,
 opcoes jsonb not null default '{}'::jsonb,
 updated_at timestamptz not null default now()
);
create table if not exists public.oricse_portal_promocoes (
 id uuid primary key default gen_random_uuid(),
 clinica_id uuid not null references public.clinicas(id) on delete cascade,
 titulo text not null,
 descricao text not null default '',
 cupom text not null default '',
 desconto_percentual numeric(5,2) not null default 0 check(desconto_percentual>=0 and desconto_percentual<=100),
 inicio date,
 fim date,
 ativo boolean not null default false,
 created_at timestamptz not null default now()
);
create index if not exists oricse_promocoes_clinica on public.oricse_portal_promocoes(clinica_id);
alter table public.oricse_portal_extras enable row level security;
alter table public.oricse_portal_promocoes enable row level security;
revoke all on public.oricse_portal_extras,public.oricse_portal_promocoes from anon,authenticated;
create or replace function public.oricse_portal_painel(p_clinica uuid,p_opcoes jsonb default null,p_promocao jsonb default null,p_agenda_id uuid default null,p_agenda_ativa boolean default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare papel text; geral boolean; out jsonb; prm jsonb; a jsonb;
begin
 select exists(select 1 from public.app_users where user_id=auth.uid() and role='admin') into geral;
 select cu.papel into papel from public.clinica_usuarios cu where cu.user_id=auth.uid() and cu.clinica_id=p_clinica and cu.ativo=true limit 1;
 if not geral and coalesce(papel,'') not in ('rt','responsavel','admin_clinica') then raise exception 'Acesso restrito ao RT e administradores';end if;
 if p_opcoes is not null then
  if jsonb_typeof(p_opcoes)<>'object' or length(p_opcoes::text)>16000 then raise exception 'Configurações inválidas';end if;
  insert into public.oricse_portal_extras(clinica_id,opcoes) values(p_clinica,p_opcoes)
   on conflict(clinica_id) do update set opcoes=excluded.opcoes,updated_at=now();
 end if;
 if p_promocao is not null then
  if length(coalesce(p_promocao->>'titulo','')) not between 2 and 120 then raise exception 'Título da promoção inválido';end if;
  insert into public.oricse_portal_promocoes(clinica_id,titulo,descricao,cupom,desconto_percentual,inicio,fim,ativo)
  values(p_clinica, p_promocao->>'titulo',left(coalesce(p_promocao->>'descricao',''),500),left(coalesce(p_promocao->>'cupom',''),40),
   coalesce((p_promocao->>'desconto_percentual')::numeric,0),
   nullif(p_promocao->>'inicio','')::date,nullif(p_promocao->>'fim','')::date,coalesce((p_promocao->>'ativo')::boolean,false));
 end if;
 if p_agenda_id is not null then
  update public.oricse_agendas_online set portal_ativo=coalesce(p_agenda_ativa,false) where clinica_id=p_clinica and id=p_agenda_id;
  if not found then raise exception 'Agenda não encontrada';end if;
 end if;
 select coalesce(opcoes,'{}'::jsonb) into out from public.oricse_portal_extras where clinica_id=p_clinica;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'titulo',titulo,'descricao',descricao,'cupom',cupom,'desconto_percentual',desconto_percentual,'inicio',inicio,'fim',fim,'ativo',ativo) order by created_at desc),'[]'::jsonb) into prm from public.oricse_portal_promocoes where clinica_id=p_clinica;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'nome',nome,'portal_ativo',portal_ativo) order by nome),'[]'::jsonb) into a from public.oricse_agendas_online where clinica_id=p_clinica;
 return jsonb_build_object('opcoes',coalesce(out,'{}'::jsonb),'promocoes',coalesce(prm,'[]'::jsonb),'agendas',coalesce(a,'[]'::jsonb));
end $$;
revoke all on function public.oricse_portal_painel(uuid,jsonb,jsonb,uuid,boolean) from public;
grant execute on function public.oricse_portal_painel(uuid,jsonb,jsonb,uuid,boolean) to authenticated;
create or replace function public.oricse_portal_extras_publicas(p_slug text)
returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object('opcoes',coalesce((select x.opcoes from public.oricse_portal_extras x where x.clinica_id=c.id),'{}'::jsonb),
 'promocoes',coalesce((select jsonb_agg(jsonb_build_object('titulo',p.titulo,'descricao',p.descricao,'cupom',p.cupom,'desconto_percentual',p.desconto_percentual)) from public.oricse_portal_promocoes p where p.clinica_id=c.id and p.ativo and (p.inicio is null or p.inicio<=current_date) and (p.fim is null or p.fim>=current_date)),'[]'::jsonb))
 from public.clinicas c where c.slug=p_slug limit 1;
$$;
revoke all on function public.oricse_portal_extras_publicas(text) from public;
grant execute on function public.oricse_portal_extras_publicas(text) to anon,authenticated;