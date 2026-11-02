alter table public.oricse_banho_tosa_agendamentos
 add column if not exists avaliacao_entrada text not null default '',
 add column if not exists restricoes text not null default '',
 add column if not exists checklist jsonb not null default '{}'::jsonb,
 add column if not exists entrada_em timestamptz,
 add column if not exists inicio_real_em timestamptz,
 add column if not exists pronto_em timestamptz,
 add column if not exists entregue_em timestamptz,
 add column if not exists observacoes_saida text not null default '';
create table if not exists public.oricse_banho_tosa_extras (
 id uuid primary key default gen_random_uuid(),
 clinica_id uuid not null references public.clinicas(id) on delete cascade,
 agendamento_id uuid not null references public.oricse_banho_tosa_agendamentos(id) on delete cascade,
 descricao text not null check (char_length(btrim(descricao)) between 1 and 200),
 quantidade numeric(10,3) not null check(quantidade>0),
 valor_unitario_centavos integer not null check(valor_unitario_centavos>=0),
 criado_em timestamptz not null default now()
);
create index if not exists bt_extras_agendamento_idx on public.oricse_banho_tosa_extras (clinica_id,agendamento_id);
alter table public.oricse_banho_tosa_extras enable row level security;
grant select,insert,delete on public.oricse_banho_tosa_extras to authenticated;
create policy bt_extras_read on public.oricse_banho_tosa_extras for select to authenticated using(public.oricse_usuario_pode_permissao(clinica_id,'hotelzinho.visualizar') or public.oricse_usuario_pode_permissao(clinica_id,'recepcao.agenda'));
create policy bt_extras_insert on public.oricse_banho_tosa_extras for insert to authenticated with check(public.oricse_usuario_pode_permissao(clinica_id,'hotelzinho.operar') or public.oricse_usuario_pode_permissao(clinica_id,'recepcao.agenda'));
create policy bt_extras_delete on public.oricse_banho_tosa_extras for delete to authenticated using(public.oricse_usuario_pode_permissao(clinica_id,'hotelzinho.gerenciar'));
