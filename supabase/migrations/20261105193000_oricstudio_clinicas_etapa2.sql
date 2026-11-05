-- OricStudio - Etapa 2/5 (dependente da migracao administrativa 1/5)
-- Isolamento por clinica, consulta de licenca, rascunhos e trilha de revisoes.
-- Nao cria conexoes Meta, nao agenda/publica e nao habilita pagamentos.

create or replace function public.oricstudio_pode_acessar(p_clinica_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (
      select c.status = 'ativa'
        and c.id = public.oricse_clinica_ativa_obter()
        and (
          exists(select 1 from public.app_users au where au.user_id = (select auth.uid()) and au.role = 'admin')
          or exists(select 1 from public.clinica_usuarios cu where cu.user_id = (select auth.uid()) and cu.clinica_id=c.id and cu.ativo=true)
        )
        and l.status='ativo'
        and (l.expira_em is null or l.expira_em>now())
      from public.clinicas c
      join public.oricstudio_licencas l on l.clinica_id=c.id
      where c.id=p_clinica_id
    ),
    false
  );
$$;
revoke all on function public.oricstudio_pode_acessar(uuid) from public, anon;
grant execute on function public.oricstudio_pode_acessar(uuid) to authenticated;

create or replace function public.oricstudio_meu_contexto()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'clinica_id', c.id,
    'clinica_nome', c.nome,
    'clinica_status', c.status,
    'licenca_status', coalesce(l.status,'nao_contratado'),
    'licenca_expira_em', l.expira_em,
    'tem_acesso', public.oricstudio_pode_acessar(c.id)
  )
  from public.clinicas c
  left join public.oricstudio_licencas l on l.clinica_id=c.id
  where c.id=public.oricse_clinica_ativa_obter()
    and (
      exists(select 1 from public.app_users a where a.user_id=(select auth.uid()) and a.role='admin')
      or exists(select 1 from public.clinica_usuarios cu where cu.user_id=(select auth.uid()) and cu.clinica_id=c.id and cu.ativo=true)
    );
$$;
revoke all on function public.oricstudio_meu_contexto() from public, anon;
grant execute on function public.oricstudio_meu_contexto() to authenticated;

create table if not exists public.oricstudio_publicacoes (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  titulo text not null check (char_length(trim(titulo)) between 1 and 180),
  legenda text not null default '' check (char_length(legenda)<=2200),
  tipo text not null default 'imagem' check (tipo in ('imagem','carrossel','reels','story')),
  status text not null default 'rascunho' check (status in ('rascunho','aguardando_aprovacao')),
  planejado_para timestamptz,
  criado_por uuid not null default auth.uid() references auth.users(id) on delete restrict,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists oricstudio_posts_clinica_data_idx
on public.oricstudio_publicacoes (clinica_id, criado_em desc);
create index if not exists oricstudio_posts_planejamento_idx
on public.oricstudio_publicacoes (clinica_id, planejado_para)
where planejado_para is not null;

create table if not exists public.oricstudio_publicacoes_versoes (
  id bigint generated always as identity primary key,
  publicacao_id uuid not null,
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  evento text not null check(evento in ('criar','editar','excluir')),
  dados_anteriores jsonb,
  dados_atuais jsonb,
  autor_id uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now()
);
create index if not exists oricstudio_versoes_publicacao_idx
on public.oricstudio_publicacoes_versoes (publicacao_id, criado_em desc);

create or replace function public.oricstudio_antes_atualizar()
returns trigger language plpgsql security invoker set search_path = ''
as $
begin
  if new.clinica_id is distinct from old.clinica_id
     or new.criado_por is distinct from old.criado_por
     or new.id is distinct from old.id then
    raise exception 'Não é permitido alterar a propriedade da publicação';
  end if;
  new.atualizado_em := now();
  return new;
end;
$;
revoke all on function public.oricstudio_antes_atualizar() from public,anon,authenticated;
drop trigger if exists oricstudio_publicacoes_atualizar_trigger on public.oricstudio_publicacoes;
create trigger oricstudio_publicacoes_atualizar_trigger
before update on public.oricstudio_publicacoes
for each row execute function public.oricstudio_antes_atualizar();

create or replace function public.oricstudio_publicacoes_auditar()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.oricstudio_publicacoes_versoes(publicacao_id,clinica_id,evento,dados_atuais,autor_id)
    values(new.id,new.clinica_id,'criar',to_jsonb(new),auth.uid());
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.oricstudio_publicacoes_versoes(publicacao_id,clinica_id,evento,dados_anteriores,dados_atuais,autor_id)
    values(new.id,new.clinica_id,'editar',to_jsonb(old),to_jsonb(new),auth.uid());
    return new;
  else
    insert into public.oricstudio_publicacoes_versoes(publicacao_id,clinica_id,evento,dados_anteriores,autor_id)
    values(old.id,old.clinica_id,'excluir',to_jsonb(old),auth.uid());
    return old;
  end if;
end;
$$;
revoke all on function public.oricstudio_publicacoes_auditar() from public,anon,authenticated;
drop trigger if exists oricstudio_publicacoes_audit_trigger on public.oricstudio_publicacoes;
create trigger oricstudio_publicacoes_audit_trigger
after insert or update or delete on public.oricstudio_publicacoes
for each row execute function public.oricstudio_publicacoes_auditar();

-- A biblioteca registra metadados quando o armazenamento real for conectado na etapa 3.
create table if not exists public.oricstudio_midias (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  nome text not null,
  tipo text not null check(tipo in ('imagem','video')),
  caminho_privado text not null,
  criado_em timestamptz not null default now()
);
create index if not exists oricstudio_midias_clinica_idx on public.oricstudio_midias(clinica_id,criado_em desc);

alter table public.oricstudio_publicacoes enable row level security;
alter table public.oricstudio_publicacoes_versoes enable row level security;
alter table public.oricstudio_midias enable row level security;
revoke all on public.oricstudio_publicacoes, public.oricstudio_publicacoes_versoes, public.oricstudio_midias from anon;
grant select,insert,update,delete on public.oricstudio_publicacoes to authenticated;
grant select on public.oricstudio_publicacoes_versoes to authenticated;
grant select on public.oricstudio_midias to authenticated;
-- Sequencia de auditoria permanece restrita ao trigger privilegiado.

create policy oricstudio_publicacoes_ler on public.oricstudio_publicacoes
for select to authenticated using (public.oricstudio_pode_acessar(clinica_id));
create policy oricstudio_publicacoes_criar on public.oricstudio_publicacoes
for insert to authenticated with check (
  public.oricstudio_pode_acessar(clinica_id)
  and criado_por=(select auth.uid())
);
create policy oricstudio_publicacoes_editar on public.oricstudio_publicacoes
for update to authenticated using (public.oricstudio_pode_acessar(clinica_id))
with check (public.oricstudio_pode_acessar(clinica_id));
create policy oricstudio_publicacoes_apagar on public.oricstudio_publicacoes
for delete to authenticated using (public.oricstudio_pode_acessar(clinica_id));
create policy oricstudio_versoes_ler on public.oricstudio_publicacoes_versoes
for select to authenticated using (public.oricstudio_pode_acessar(clinica_id));
create policy oricstudio_midias_ler on public.oricstudio_midias
for select to authenticated using (public.oricstudio_pode_acessar(clinica_id));

comment on table public.oricstudio_publicacoes is
  'Rascunhos locais do OricStudio; nenhuma publicacao e enviada a Meta nesta etapa.';
