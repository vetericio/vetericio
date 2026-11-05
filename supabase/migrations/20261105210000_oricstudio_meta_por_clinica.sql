-- OricStúdio etapa 3/5: cada clínica autoriza suas próprias contas profissionais Meta.
-- Infraestrutura isolada; credenciais, tokens e estados OAuth não são acessíveis no cliente.
create table if not exists public.oricstudio_meta_contas (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  instagram_user_id text not null unique,
  username text not null,
  account_type text,
  status text not null default 'ativa' check(status in ('ativa','reautenticar','desconectada','incompleta')),
  escopos text[] not null default '{}'::text[],
  conectado_por uuid references auth.users(id) on delete set null,
  conectado_em timestamptz not null default now(),
  token_expira_em timestamptz,
  atualizado_em timestamptz not null default now(),
  ultimo_erro text
);
create index if not exists oricstudio_meta_contas_clinica_idx
on public.oricstudio_meta_contas(clinica_id, status);

create table if not exists public.oricstudio_meta_oauth_states (
  state_hash text primary key check(state_hash ~ '^[a-f0-9]{64}$'),
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  iniciado_por uuid not null references auth.users(id) on delete cascade,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null,
  usado_em timestamptz,
  constraint oricstudio_state_expira_depois check (expira_em > criado_em)
);
create index if not exists oricstudio_meta_oauth_exp_idx
on public.oricstudio_meta_oauth_states(expira_em);

create table if not exists public.oricstudio_meta_tokens (
  conta_id uuid primary key references public.oricstudio_meta_contas(id) on delete cascade,
  algoritmo text not null default 'AES-256-GCM' check(algoritmo = 'AES-256-GCM'),
  token_cifrado_base64 text not null,
  iv_base64 text not null,
  token_expira_em timestamptz,
  atualizado_em timestamptz not null default now()
);
create table if not exists public.oricstudio_meta_auditoria (
  id bigint generated always as identity primary key,
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  conta_id uuid references public.oricstudio_meta_contas(id) on delete set null,
  usuario_id uuid references auth.users(id) on delete set null,
  acao text not null check (acao in ('conectar','desconectar','falha_oauth','verificar','renovar')),
  detalhes jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now()
);
create index if not exists oricstudio_meta_audit_clinica_idx
on public.oricstudio_meta_auditoria(clinica_id,criado_em desc);

alter table public.oricstudio_meta_contas enable row level security;
alter table public.oricstudio_meta_oauth_states enable row level security;
alter table public.oricstudio_meta_tokens enable row level security;
alter table public.oricstudio_meta_auditoria enable row level security;

-- Expor somente metadados não sensíveis para clínica licenciada.
revoke all on public.oricstudio_meta_contas,
  public.oricstudio_meta_oauth_states,
  public.oricstudio_meta_tokens,
  public.oricstudio_meta_auditoria from anon, authenticated;
grant select on public.oricstudio_meta_contas,public.oricstudio_meta_auditoria to authenticated;
create policy oricstudio_meta_contas_ler on public.oricstudio_meta_contas
for select to authenticated using (public.oricstudio_pode_acessar(clinica_id));
create policy oricstudio_meta_auditoria_ler on public.oricstudio_meta_auditoria
for select to authenticated using (public.oricstudio_pode_editar(clinica_id));

-- Escrever conexões e segredos SOMENTE pelo servidor autenticado com papel service_role.
-- Não conceder acesso direto via Data API às tabelas de tokens ou OAuth states.
comment on table public.oricstudio_meta_tokens is
  'Segredos AES-GCM separados por conta; acesso exclusivo ao servidor, sem policies nem GRANT para authenticated.';
comment on table public.oricstudio_meta_contas is
  'Cada conta profissional Meta pertence a exatamente uma clínica. Não há ligação com Gestor 2.0.';
