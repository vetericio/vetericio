create table if not exists public.oricse_mp_oauth_sessoes (
 state_hash text primary key,
 clinica_id uuid not null references public.clinicas(id) on delete cascade,
 iniciado_por uuid not null,
 code_verifier_cifrado text not null,
 expira_em timestamptz not null,
 criado_em timestamptz not null default now()
);
create index if not exists oricse_mp_oauth_sessoes_expira_idx on public.oricse_mp_oauth_sessoes(expira_em);
alter table public.oricse_mp_oauth_sessoes enable row level security;
revoke all on public.oricse_mp_oauth_sessoes from anon,authenticated;
-- OAuth sempre pelo servidor com chave service_role.