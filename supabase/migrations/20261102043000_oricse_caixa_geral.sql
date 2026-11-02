create table if not exists public.oricse_caixa_lancamentos (
 id uuid primary key default gen_random_uuid(),
 clinica_id uuid not null references public.clinicas(id) on delete cascade,
 setor text not null,
 origem_tipo text not null,
 origem_id uuid not null,
 tipo text not null check(tipo in ('entrada','saida')),
 status text not null check(status in ('pago','pendente','cancelado')),
 descricao text not null,
 valor_centavos integer not null check(valor_centavos>0),
 forma_pagamento text not null default '',
 registrado_em timestamptz not null default now(),
 registrado_por uuid references auth.users(id) on delete set null
);
create unique index if not exists caixa_lancamentos_origem_unica on public.oricse_caixa_lancamentos(clinica_id,origem_tipo,origem_id);
create index if not exists caixa_lancamentos_clinica_data on public.oricse_caixa_lancamentos(clinica_id,registrado_em desc);
alter table public.oricse_caixa_lancamentos enable row level security;
grant select,insert on public.oricse_caixa_lancamentos to authenticated;
create policy caixa_geral_read on public.oricse_caixa_lancamentos for select to authenticated using(public.oricse_usuario_pode_permissao(clinica_id,'caixa.financeiro.visualizar') or public.oricse_usuario_pode_permissao(clinica_id,'caixa.comandas'));
create policy caixa_geral_insert on public.oricse_caixa_lancamentos for insert to authenticated with check(public.oricse_usuario_pode_permissao(clinica_id,'caixa.comandas') or public.oricse_usuario_pode_permissao(clinica_id,'caixa.financeiro.visualizar'));
insert into public.oricse_caixa_lancamentos(clinica_id,setor,origem_tipo,origem_id,tipo,status,descricao,valor_centavos,forma_pagamento,registrado_em,registrado_por)
select p.clinica_id,'Banho e tosa','banho_tosa_pagamento',p.id,'entrada','pago','Pagamento de banho e tosa',p.valor_centavos,p.forma,p.registrado_em,p.registrado_por
from public.oricse_banho_tosa_pagamentos p
on conflict (clinica_id,origem_tipo,origem_id) do nothing;
