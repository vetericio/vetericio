-- Annotations only: reconciliation does not change the originating payment or the cash balance.
create table public.oricse_conferencia_cartoes (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  lancamento_id uuid not null,
  liquido_esperado_centavos integer not null check (liquido_esperado_centavos >= 0),
  recebido_centavos integer not null check (recebido_centavos >= 0),
  depositado_em date not null,
  anotacao text not null default '' check (char_length(anotacao) <= 240),
  conferido_por uuid not null default auth.uid(),
  conferido_em timestamptz not null default now()
);
create index on public.oricse_conferencia_cartoes(clinica_id,lancamento_id,conferido_em desc,id desc);
alter table public.oricse_conferencia_cartoes enable row level security;
revoke all on public.oricse_conferencia_cartoes from public, anon, authenticated;
grant select on public.oricse_conferencia_cartoes to authenticated;
grant insert (clinica_id,lancamento_id,liquido_esperado_centavos,recebido_centavos,depositado_em,anotacao)
  on public.oricse_conferencia_cartoes to authenticated;
create policy conferencia_cartoes_leitura on public.oricse_conferencia_cartoes for select to authenticated
using (public.oricse_usuario_pode_permissao(clinica_id,'caixa.financeiro.visualizar')
    or public.oricse_usuario_pode_permissao(clinica_id,'caixa.financeiro.gerenciar'));
create policy conferencia_cartoes_gravacao on public.oricse_conferencia_cartoes for insert to authenticated
with check (conferido_por = (select auth.uid()) and public.oricse_usuario_pode_permissao(clinica_id,'caixa.financeiro.gerenciar')
  and exists (
    select 1 from public.oricse_caixa_lancamentos l
    where l.clinica_id = oricse_conferencia_cartoes.clinica_id and l.id = oricse_conferencia_cartoes.lancamento_id
      and l.tipo = 'entrada' and l.status = 'pago'
      and translate(lower(trim(l.forma_pagamento)),'éã','ea') in ('cartao','cartao de credito','cartao de debito','credito','debito')
      and liquido_esperado_centavos <= l.valor_centavos
      and depositado_em between (l.registrado_em at time zone 'America/Sao_Paulo')::date
          and (now() at time zone 'America/Sao_Paulo')::date
  ));
