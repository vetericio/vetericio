create table if not exists public.oricstudio_meta_exclusoes (
  id uuid primary key default gen_random_uuid(),
  confirmation_code text not null unique check (confirmation_code ~ '^ORICSE[A-F0-9]{36}$'),
  meta_user_hash text not null check (meta_user_hash ~ '^[a-f0-9]{64}$'),
  status text not null default 'pending' check (status in ('pending','completed','failed')),
  ultimo_erro text,
  criado_em timestamptz not null default now(),
  concluido_em timestamptz
);

create index if not exists oricstudio_meta_exclusoes_status_idx
on public.oricstudio_meta_exclusoes(status, criado_em desc);

alter table public.oricstudio_meta_exclusoes enable row level security;
revoke all on public.oricstudio_meta_exclusoes from anon, authenticated;
