create table if not exists public.clinica_catalogo_itens (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  tipo text not null check (tipo in ('servico', 'produto')),
  nome text not null check (char_length(trim(nome)) > 0),
  preco numeric(12,2) not null default 0 check (preco >= 0),
  categoria text,
  comissao numeric(12,2) check (comissao is null or comissao >= 0),
  codigo_tributacao text,
  cnae text,
  descricao_prefeitura text,
  aliquota_iss numeric(5,2) check (aliquota_iss is null or (aliquota_iss >= 0 and aliquota_iss <= 100)),
  estoque_atual numeric(12,3),
  estoque_minimo numeric(12,3),
  fornecedor text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clinica_catalogo_itens_clinica_tipo_idx
  on public.clinica_catalogo_itens (clinica_id, tipo);

alter table public.clinica_catalogo_itens enable row level security;

drop policy if exists "catalogo leitura da propria clinica" on public.clinica_catalogo_itens;
create policy "catalogo leitura da propria clinica"
on public.clinica_catalogo_itens for select to authenticated
using (exists (
  select 1 from public.clinica_usuarios cu
  where cu.clinica_id = clinica_catalogo_itens.clinica_id
    and cu.user_id = (select auth.uid())
    and cu.ativo = true
));

drop policy if exists "catalogo gestao da propria clinica" on public.clinica_catalogo_itens;
create policy "catalogo gestao da propria clinica"
on public.clinica_catalogo_itens for all to authenticated
using (
  exists (
    select 1 from public.clinica_usuarios cu
    where cu.clinica_id = clinica_catalogo_itens.clinica_id
      and cu.user_id = (select auth.uid())
      and cu.ativo = true
      and cu.papel in ('admin', 'clinica', 'rt')
  )
  or exists (
    select 1 from public.app_users au
    where au.user_id = (select auth.uid())
      and au.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.clinica_usuarios cu
    where cu.clinica_id = clinica_catalogo_itens.clinica_id
      and cu.user_id = (select auth.uid())
      and cu.ativo = true
      and cu.papel in ('admin', 'clinica', 'rt')
  )
  or exists (
    select 1 from public.app_users au
    where au.user_id = (select auth.uid())
      and au.role = 'admin'
  )
);