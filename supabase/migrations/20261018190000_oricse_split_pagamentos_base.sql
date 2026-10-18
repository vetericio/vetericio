-- Infraestrutura de preços e split, SEM ativação de pagamentos de produção.
-- Percentuais do Mercado Pago são estimativas administrativas; confirmação é feita via API/webhook.
create table if not exists public.oricse_taxas_modalidade (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid references public.clinicas(id) on delete cascade,
  modalidade text not null check (modalidade in ('pix','cartao','boleto')),
  mp_percentual numeric(7,4) not null check (mp_percentual >= 0 and mp_percentual < 100),
  mp_fixo_centavos integer not null default 0 check (mp_fixo_centavos >= 0),
  oricse_percentual numeric(7,4) not null check (oricse_percentual >= 0 and oricse_percentual < 100),
  ativo boolean not null default true,
  updated_at timestamptz not null default now()
);
create unique index if not exists oricse_taxas_modalidade_global_uniq on public.oricse_taxas_modalidade(modalidade) where clinica_id is null;
create unique index if not exists oricse_taxas_modalidade_clinica_uniq on public.oricse_taxas_modalidade(clinica_id,modalidade) where clinica_id is not null;
create table if not exists public.oricse_precos_portal (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  titulo text not null,
  modo text not null check (modo in ('receber','cobrar')),
  valor_centavos integer not null check (valor_centavos > 0),
  ativo boolean not null default true,
  updated_at timestamptz not null default now()
);
create index if not exists oricse_precos_portal_clinica_idx on public.oricse_precos_portal(clinica_id);
create table if not exists public.oricse_pagamentos (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid references public.clinicas(id) on delete restrict,
  tipo text not null check (tipo in ('plano_oricse','portal_tutor')),
  origem_id uuid,
  modalidade text check (modalidade in ('pix','cartao','boleto')),
  bruto_centavos integer not null check (bruto_centavos >= 0),
  estimativa_mp_centavos integer not null default 0,
  estimativa_oricse_centavos integer not null default 0,
  estimativa_clinica_centavos integer not null default 0,
  recebido_mp_centavos integer,
  recebido_oricse_centavos integer,
  recebido_clinica_centavos integer,
  mp_payment_id text unique,
  status text not null default 'criado' check (status in ('criado','pendente','aprovado','recusado','cancelado','estornado')),
  taxas_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Fail closed: nenhuma escrita/consulta direta pelo cliente nos dados financeiros sensíveis.
-- Acesso financeiro exclusivamente através de funções servidoras autorizadas.
alter table public.oricse_taxas_modalidade enable row level security;
alter table public.oricse_precos_portal enable row level security;
alter table public.oricse_pagamentos enable row level security;
revoke all on public.oricse_taxas_modalidade,public.oricse_precos_portal,public.oricse_pagamentos from anon,authenticated;
comment on table public.oricse_pagamentos is 'Pagamentos financeiros: API servidor valida usuário e clínica, confirma webhook MP e concilia antes de mudar status.';
