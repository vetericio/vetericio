-- Perfil individual: um cadastro por conta Auth, independente da clínica.
-- CPF, endereço e telefone não são expostos na Data API de clientes.
create table if not exists public.oricse_pessoas (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nome_completo text not null check (char_length(btrim(nome_completo)) between 3 and 180),
  crmv text,
  crmv_uf text,
  cpf text,
  mapa text,
  telefone text,
  endereco text,
  updated_at timestamptz not null default now(),
  constraint oricse_pessoas_cpf_formato check (cpf is null or cpf ~ '^[0-9]{11}$')
);
alter table public.oricse_pessoas enable row level security;
revoke all on table public.oricse_pessoas from public, anon, authenticated;
grant select, insert, update, delete on table public.oricse_pessoas to service_role;
comment on table public.oricse_pessoas is 'Dados individuais reservados do profissional. Somente funções de servidor autorizadas podem consultar e alterar.';
