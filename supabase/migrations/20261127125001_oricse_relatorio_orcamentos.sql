-- Registro de acompanhamento: sem criar venda, cobrança ou movimento de estoque.
create table if not exists public.oricse_relatorio_orcamentos (
  clinica_id uuid not null references public.clinicas(id) on delete restrict,
  id uuid not null,
  titulo text not null default 'Venda Expressa',
  valor_centavos integer not null check (valor_centavos between 0 and 100000000),
  criado_por uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now(),
  validade_em date not null,
  venda_id uuid,
  vinculado_em timestamptz,
  primary key (clinica_id, id),
  unique (clinica_id, venda_id),
  foreign key (clinica_id, venda_id)
    references public.oricse_vendas_expressas (clinica_id, id) on delete restrict,
  check ((venda_id is null) = (vinculado_em is null))
);

create index if not exists oricse_relatorio_orcamentos_data_idx
  on public.oricse_relatorio_orcamentos (clinica_id, criado_em, id);

alter table public.oricse_relatorio_orcamentos enable row level security;
revoke all on public.oricse_relatorio_orcamentos from public, anon, authenticated;
grant select, insert, update on public.oricse_relatorio_orcamentos to service_role;
