-- OricStudio: Threads OAuth, tenancy e credenciais isoladas.
create table if not exists public.oricstudio_threads_contas (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  threads_user_id text not null unique,
  username text not null,
  status text not null default 'ativa' check(status in ('ativa','reautenticar','desconectada')),
  conectado_por uuid references auth.users(id) on delete set null,
  conectado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  token_expira_em timestamptz
);
create index if not exists oricstudio_threads_contas_clinica_idx
on public.oricstudio_threads_contas(clinica_id,status);

create table if not exists public.oricstudio_threads_oauth_states (
  state_hash text primary key check(state_hash ~ '^[a-f0-9]{64}$'),
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  iniciado_por uuid not null references auth.users(id) on delete cascade,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null,
  usado_em timestamptz,
  constraint oricstudio_threads_state_expira check (expira_em > criado_em)
);
create index if not exists oricstudio_threads_states_exp_idx on public.oricstudio_threads_oauth_states(expira_em);

create table if not exists public.oricstudio_threads_tokens (
  conta_id uuid primary key references public.oricstudio_threads_contas(id) on delete cascade,
  token_cifrado_base64 text not null,
  iv_base64 text not null,
  atualizado_em timestamptz not null default now()
);

alter table public.oricstudio_threads_contas enable row level security;
alter table public.oricstudio_threads_oauth_states enable row level security;
alter table public.oricstudio_threads_tokens enable row level security;
revoke all on public.oricstudio_threads_contas,public.oricstudio_threads_oauth_states,
  public.oricstudio_threads_tokens from anon,authenticated;
grant select on public.oricstudio_threads_contas to authenticated;
create policy oricstudio_threads_contas_ler on public.oricstudio_threads_contas
for select to authenticated using (public.oricstudio_pode_acessar(clinica_id));
comment on table public.oricstudio_threads_tokens is
  'Tokens Threads AES-GCM privados, acessíveis apenas ao servidor service_role.';
