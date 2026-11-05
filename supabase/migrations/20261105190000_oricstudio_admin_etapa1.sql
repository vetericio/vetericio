-- OricStudio - Etapa 1/5: cadastro comercial e licenciamento central (sem liberar clinicas)
create or replace function public.oricstudio_eh_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists(
    select 1 from public.app_users a
    where a.user_id = (select auth.uid()) and a.role = 'admin'
  );
$$;
revoke all on function public.oricstudio_eh_admin() from public, anon;
grant execute on function public.oricstudio_eh_admin() to authenticated;

create table if not exists public.oricstudio_produto (
  codigo text primary key default 'oricstudio' check (codigo = 'oricstudio'),
  nome text not null default 'OricStúdio',
  descricao text not null default 'Gestão de Redes Sociais para o Mercado Pet',
  preco_centavos integer check (preco_centavos is null or preco_centavos >= 0),
  comercializacao_ativa boolean not null default false,
  disponivel_nos_planos boolean not null default false,
  logo_url text,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users(id) on delete set null
);
insert into public.oricstudio_produto (codigo)
values ('oricstudio') on conflict (codigo) do nothing;

create table if not exists public.oricstudio_licencas (
  clinica_id uuid primary key references public.clinicas(id) on delete cascade,
  status text not null default 'nao_contratado' check (status in ('nao_contratado','pendente','ativo','suspenso','expirado')),
  motivo text,
  liberado_em timestamptz,
  expira_em timestamptz,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users(id) on delete set null
);
create index if not exists oricstudio_licencas_status_idx on public.oricstudio_licencas(status);

create table if not exists public.oricstudio_auditoria (
  id bigint generated always as identity primary key,
  clinica_id uuid references public.clinicas(id) on delete set null,
  acao text not null,
  antes jsonb,
  depois jsonb,
  usuario_id uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now()
);
create index if not exists oricstudio_auditoria_criado_idx on public.oricstudio_auditoria(criado_em desc);

create or replace function public.oricstudio_registrar_licenca()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.atualizado_em := now();
    new.atualizado_por := auth.uid();
    if new.status = 'ativo' and old.status <> 'ativo' then new.liberado_em := now(); end if;
    insert into public.oricstudio_auditoria(clinica_id, acao, antes, depois, usuario_id)
    values(new.clinica_id, 'alterar_licenca', to_jsonb(old), to_jsonb(new), auth.uid());
  else
    new.atualizado_por := auth.uid();
    if new.status = 'ativo' then new.liberado_em := now(); end if;
    insert into public.oricstudio_auditoria(clinica_id, acao, antes, depois, usuario_id)
    values(new.clinica_id, 'criar_licenca', null, to_jsonb(new), auth.uid());
  end if;
  return new;
end;
$$;
drop trigger if exists oricstudio_auditar_licenca on public.oricstudio_licencas;
create trigger oricstudio_auditar_licenca before insert or update on public.oricstudio_licencas
for each row execute function public.oricstudio_registrar_licenca();

alter table public.oricstudio_produto enable row level security;
alter table public.oricstudio_licencas enable row level security;
alter table public.oricstudio_auditoria enable row level security;
revoke all on public.oricstudio_produto, public.oricstudio_licencas, public.oricstudio_auditoria from anon;
grant select, insert, update on public.oricstudio_produto, public.oricstudio_licencas to authenticated;
grant select, insert on public.oricstudio_auditoria to authenticated;
grant usage, select on sequence public.oricstudio_auditoria_id_seq to authenticated;
create policy oricstudio_produto_admin_select on public.oricstudio_produto for select to authenticated using (public.oricstudio_eh_admin());
create policy oricstudio_produto_admin_insert on public.oricstudio_produto for insert to authenticated with check (public.oricstudio_eh_admin());
create policy oricstudio_produto_admin_update on public.oricstudio_produto for update to authenticated using (public.oricstudio_eh_admin()) with check (public.oricstudio_eh_admin());
create policy oricstudio_licencas_admin_select on public.oricstudio_licencas for select to authenticated using (public.oricstudio_eh_admin());
create policy oricstudio_licencas_admin_insert on public.oricstudio_licencas for insert to authenticated with check (public.oricstudio_eh_admin());
create policy oricstudio_licencas_admin_update on public.oricstudio_licencas for update to authenticated using (public.oricstudio_eh_admin()) with check (public.oricstudio_eh_admin());
create policy oricstudio_auditoria_admin_select on public.oricstudio_auditoria for select to authenticated using (public.oricstudio_eh_admin());
-- Auditoria somente via trigger; nenhuma insercao direta pelo cliente.
revoke insert on public.oricstudio_auditoria from authenticated;
