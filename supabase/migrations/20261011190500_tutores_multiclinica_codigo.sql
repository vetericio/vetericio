-- Tutores multiclínica com código público imutável e sequência global.
-- Formato: #<inicial-da-clínica><6 dígitos>, ex.: #V000001.
-- Nomes podem se repetir; CPF é obrigatório e único apenas dentro de cada clínica.

create extension if not exists unaccent;
create sequence if not exists public.tutor_codigo_global_seq start with 1 increment by 1 no cycle;

create table if not exists public.tutores (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  codigo_numero bigint not null unique,
  codigo_publico text not null unique,
  nome text not null,
  nome_chave text not null,
  cpf text not null,
  cpf_digitos text not null,
  telefone text,
  outro_telefone text,
  email text,
  dados jsonb not null default '{}'::jsonb,
  criado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists tutores_clinica_cpf_unico_idx
  on public.tutores(clinica_id, cpf_digitos);
create index if not exists tutores_clinica_codigo_idx
  on public.tutores(clinica_id, codigo_publico);
create index if not exists tutores_clinica_nome_idx
  on public.tutores(clinica_id, nome_chave);

create or replace function public.oricse_normalizar_nome(valor text)
returns text
language sql
stable
set search_path = public
as $$
  select lower(unaccent(regexp_replace(trim(coalesce(valor, '')), '\s+', ' ', 'g')))
$$;

create or replace function public.oricse_preparar_tutor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  clinica_nome text;
  inicial text;
begin
  new.nome := regexp_replace(trim(new.nome), '\s+', ' ', 'g');
  new.nome_chave := public.oricse_normalizar_nome(new.nome);
  new.cpf_digitos := regexp_replace(coalesce(new.cpf, ''), '\D', '', 'g');

  if length(new.cpf_digitos) <> 11 then
    raise exception 'CPF obrigatório e deve conter 11 dígitos.' using errcode = '23514';
  end if;

  -- Mantém o CPF armazenado em formato canônico, sem depender da máscara do frontend.
  new.cpf := new.cpf_digitos;
  new.updated_at := now();

  if tg_op = 'INSERT' then
    if new.codigo_numero is null then
      new.codigo_numero := nextval('public.tutor_codigo_global_seq');
    end if;

    if new.codigo_publico is null or btrim(new.codigo_publico) = '' then
      select c.nome into clinica_nome from public.clinicas c where c.id = new.clinica_id;
      inicial := upper(substr(regexp_replace(unaccent(coalesce(clinica_nome, 'O')), '[^[:alnum:]]', '', 'g'), 1, 1));
      if coalesce(inicial, '') = '' then inicial := 'O'; end if;
      new.codigo_publico := '#' || inicial || lpad(new.codigo_numero::text, 6, '0');
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists tutores_preparar_trg on public.tutores;
create trigger tutores_preparar_trg
before insert or update of nome, cpf, clinica_id on public.tutores
for each row execute function public.oricse_preparar_tutor();

create or replace function public.oricse_usuario_na_clinica(p_clinica_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1 from public.clinica_usuarios cu
      where cu.clinica_id = p_clinica_id
        and cu.user_id = auth.uid()
        and cu.ativo = true
    )
    or exists (
      select 1 from public.app_users au
      where au.user_id = auth.uid() and au.role = 'admin'
    )
$$;

create or replace function public.oricse_my_clinic_context()
returns table(clinica_id uuid, clinica_nome text)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.nome
  from public.clinica_usuarios cu
  join public.clinicas c on c.id = cu.clinica_id
  where cu.user_id = auth.uid() and cu.ativo = true
  order by cu.created_at asc
  limit 1
$$;

alter table public.tutores enable row level security;

drop policy if exists tutores_select_minha_clinica on public.tutores;
create policy tutores_select_minha_clinica on public.tutores
for select to authenticated
using (public.oricse_usuario_na_clinica(clinica_id));

drop policy if exists tutores_insert_minha_clinica on public.tutores;
create policy tutores_insert_minha_clinica on public.tutores
for insert to authenticated
with check (public.oricse_usuario_na_clinica(clinica_id));

drop policy if exists tutores_update_minha_clinica on public.tutores;
create policy tutores_update_minha_clinica on public.tutores
for update to authenticated
using (public.oricse_usuario_na_clinica(clinica_id))
with check (public.oricse_usuario_na_clinica(clinica_id));

drop policy if exists tutores_delete_minha_clinica on public.tutores;
create policy tutores_delete_minha_clinica on public.tutores
for delete to authenticated
using (public.oricse_usuario_na_clinica(clinica_id));

grant usage, select on sequence public.tutor_codigo_global_seq to authenticated;
grant select, insert, update, delete on public.tutores to authenticated;
grant execute on function public.oricse_my_clinic_context() to authenticated;
grant execute on function public.oricse_usuario_na_clinica(uuid) to authenticated;

-- Garante que a sequência nunca volte para trás caso a tabela já tenha sido populada manualmente.
select setval(
  'public.tutor_codigo_global_seq',
  greatest(coalesce((select max(codigo_numero) from public.tutores), 0), 1),
  coalesce((select max(codigo_numero) from public.tutores), 0) > 0
);
