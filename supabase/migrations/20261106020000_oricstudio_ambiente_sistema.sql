-- OricStúdio da plataforma: ambiente próprio, sem clínica e sem licença comercial.
-- A mesma interface React reutiliza fontes de dados isoladas por permissões RLS de administração.
create table if not exists public.oricstudio_sistema_publicacoes (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (char_length(trim(titulo)) between 1 and 180),
  legenda text not null default '' check (char_length(legenda)<=2200),
  tipo text not null default 'imagem' check (tipo in ('imagem','carrossel','reels','story')),
  status text not null default 'rascunho' check (status in ('rascunho','aguardando_aprovacao','aprovado')),
  planejado_para timestamptz,
  criado_por uuid not null default auth.uid() references auth.users(id) on delete restrict,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists oricstudio_sistema_publicacoes_planejado_idx
on public.oricstudio_sistema_publicacoes(planejado_para) where planejado_para is not null;

create table if not exists public.oricstudio_sistema_versoes (
  id bigint generated always as identity primary key,
  publicacao_id uuid not null,
  evento text not null check(evento in ('criar','editar','excluir')),
  dados_anteriores jsonb,
  dados_atuais jsonb,
  autor_id uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now()
);
create index if not exists oricstudio_sistema_versoes_post_idx
on public.oricstudio_sistema_versoes(publicacao_id,criado_em desc);

create or replace function public.oricstudio_sistema_post_auditar()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op='INSERT' then
    insert into public.oricstudio_sistema_versoes(publicacao_id,evento,dados_atuais,autor_id)
    values(new.id,'criar',to_jsonb(new),auth.uid());
    return new;
  elsif tg_op='UPDATE' then
    if new.id is distinct from old.id or new.criado_por is distinct from old.criado_por then
      raise exception 'Propriedade da publicação não pode mudar';
    end if;
    new.atualizado_em := now();
    insert into public.oricstudio_sistema_versoes(publicacao_id,evento,dados_anteriores,dados_atuais,autor_id)
    values(new.id,'editar',to_jsonb(old),to_jsonb(new),auth.uid());
    return new;
  else
    insert into public.oricstudio_sistema_versoes(publicacao_id,evento,dados_anteriores,autor_id)
    values(old.id,'excluir',to_jsonb(old),auth.uid());
    return old;
  end if;
end;
$$;
revoke all on function public.oricstudio_sistema_post_auditar() from public,anon,authenticated;
drop trigger if exists oricstudio_sistema_post_audit on public.oricstudio_sistema_publicacoes;
create trigger oricstudio_sistema_post_audit
after insert or update or delete on public.oricstudio_sistema_publicacoes
for each row execute function public.oricstudio_sistema_post_auditar();

create table if not exists public.oricstudio_sistema_preferencias (
  id text primary key default 'oricse' check(id='oricse'),
  nome_publico text not null default 'ORICSE',
  tom_de_voz text not null default 'Profissional e acolhedor',
  hashtags_padrao text not null default '',
  fuso_horario text not null default 'America/Sao_Paulo',
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users(id) on delete set null
);
insert into public.oricstudio_sistema_preferencias(id,nome_publico)
values('oricse','ORICSE') on conflict(id) do nothing;

create table if not exists public.oricstudio_sistema_midias (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo text not null check(tipo in ('imagem','video')),
  caminho_privado text not null unique,
  criado_em timestamptz not null default now()
);

-- O sistema tem sua própria biblioteca em bucket privado, sem identificar clínicas.
insert into storage.buckets (id,name,public)
values ('oricstudio-sistema','oricstudio-sistema',false)
on conflict(id) do nothing;

alter table public.oricstudio_sistema_publicacoes enable row level security;
alter table public.oricstudio_sistema_versoes enable row level security;
alter table public.oricstudio_sistema_preferencias enable row level security;
alter table public.oricstudio_sistema_midias enable row level security;
revoke all on public.oricstudio_sistema_publicacoes,public.oricstudio_sistema_versoes,
  public.oricstudio_sistema_preferencias,public.oricstudio_sistema_midias
from public,anon,authenticated;

grant select,insert,update,delete on public.oricstudio_sistema_publicacoes to authenticated;
grant select on public.oricstudio_sistema_versoes to authenticated;
grant select,insert,update on public.oricstudio_sistema_preferencias to authenticated;
grant select on public.oricstudio_sistema_midias to authenticated;

create policy oricstudio_sistema_publicacoes_admin
on public.oricstudio_sistema_publicacoes for all to authenticated
using (public.oricstudio_eh_admin()) with check(public.oricstudio_eh_admin());
create policy oricstudio_sistema_versoes_admin
on public.oricstudio_sistema_versoes for select to authenticated
using(public.oricstudio_eh_admin());
create policy oricstudio_sistema_preferencias_admin
on public.oricstudio_sistema_preferencias for all to authenticated
using(public.oricstudio_eh_admin()) with check(public.oricstudio_eh_admin());
create policy oricstudio_sistema_midias_admin
on public.oricstudio_sistema_midias for select to authenticated
using(public.oricstudio_eh_admin());

-- Os vínculos sociais da plataforma são marcados por clinica_id NULL.
-- O mesmo fluxo OAuth é usado para clientes e sistema, sem criar clínica fictícia.
alter table public.oricstudio_meta_contas alter column clinica_id drop not null;
alter table public.oricstudio_meta_oauth_states alter column clinica_id drop not null;
alter table public.oricstudio_meta_auditoria alter column clinica_id drop not null;
alter table public.oricstudio_threads_contas alter column clinica_id drop not null;
alter table public.oricstudio_threads_oauth_states alter column clinica_id drop not null;

create policy oricstudio_meta_contas_sistema_admin on public.oricstudio_meta_contas
for select to authenticated using(clinica_id is null and public.oricstudio_eh_admin());
create policy oricstudio_meta_auditoria_sistema_admin on public.oricstudio_meta_auditoria
for select to authenticated using(clinica_id is null and public.oricstudio_eh_admin());
create policy oricstudio_threads_contas_sistema_admin on public.oricstudio_threads_contas
for select to authenticated using(clinica_id is null and public.oricstudio_eh_admin());

comment on table public.oricstudio_sistema_publicacoes is
'Publicações do produto ORICSE, isoladas da base das clínicas e acessíveis somente à Administração Geral.';
comment on table public.oricstudio_sistema_midias is
'Biblioteca oficial do ORICSE; arquivos em bucket exclusivo privado sob serviço autenticado.';
