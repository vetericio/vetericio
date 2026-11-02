create table if not exists public.oricse_banho_tosa_servicos (
 id uuid primary key default gen_random_uuid(),
 clinica_id uuid not null references public.clinicas(id) on delete cascade,
 nome text not null check (char_length(btrim(nome)) between 1 and 120),
 duracao_min integer not null default 60 check (duracao_min between 10 and 480),
 preco_centavos integer not null default 0 check (preco_centavos>=0),
 ativo boolean not null default true,
 created_at timestamptz not null default now(),
 unique (clinica_id,id)
);
create table if not exists public.oricse_banho_tosa_agendamentos (
 id uuid primary key default gen_random_uuid(),
 clinica_id uuid not null references public.clinicas(id) on delete cascade,
 animal_id uuid not null,
 tutor_id uuid not null,
 servico_id uuid,
 servico_nome text not null,
 inicio timestamptz not null,
 fim timestamptz not null,
 status text not null default 'agendado' check(status in ('agendado','recebido','em_execucao','pronto','entregue','cancelado')),
 profissional text not null default '',
 observacoes text not null default '',
 valor_centavos integer not null default 0 check(valor_centavos>=0),
 pago boolean not null default false,
 criado_em timestamptz not null default now(),
 atualizado_em timestamptz not null default now(),
 constraint bt_data_check check(fim>inicio),
 constraint bt_animal_fk foreign key(clinica_id,animal_id) references public.oricse_animais(clinica_id,id),
 constraint bt_tutor_fk foreign key(clinica_id,tutor_id) references public.tutores(clinica_id,id),
 constraint bt_servico_fk foreign key(clinica_id,servico_id) references public.oricse_banho_tosa_servicos(clinica_id,id)
);
create index if not exists bt_agendamentos_clinica_inicio on public.oricse_banho_tosa_agendamentos(clinica_id,inicio);
create index if not exists bt_agendamentos_clinica_status on public.oricse_banho_tosa_agendamentos(clinica_id,status);
alter table public.oricse_banho_tosa_servicos enable row level security;
alter table public.oricse_banho_tosa_agendamentos enable row level security;
grant select,insert,update,delete on public.oricse_banho_tosa_servicos,public.oricse_banho_tosa_agendamentos to authenticated;
create policy bt_servicos_read on public.oricse_banho_tosa_servicos for select to authenticated using (public.oricse_usuario_pode_permissao(clinica_id,'hotelzinho.visualizar') or public.oricse_usuario_pode_permissao(clinica_id,'administracao.configuracoes'));
create policy bt_servicos_manage on public.oricse_banho_tosa_servicos for all to authenticated using (public.oricse_usuario_pode_permissao(clinica_id,'hotelzinho.operar') or public.oricse_usuario_pode_permissao(clinica_id,'administracao.configuracoes')) with check (public.oricse_usuario_pode_permissao(clinica_id,'hotelzinho.operar') or public.oricse_usuario_pode_permissao(clinica_id,'administracao.configuracoes'));
create policy bt_agendamentos_read on public.oricse_banho_tosa_agendamentos for select to authenticated using (public.oricse_usuario_pode_permissao(clinica_id,'hotelzinho.visualizar') or public.oricse_usuario_pode_permissao(clinica_id,'recepcao.agenda'));
create policy bt_agendamentos_insert on public.oricse_banho_tosa_agendamentos for insert to authenticated with check (public.oricse_usuario_pode_permissao(clinica_id,'hotelzinho.operar') or public.oricse_usuario_pode_permissao(clinica_id,'recepcao.agenda'));
create policy bt_agendamentos_update on public.oricse_banho_tosa_agendamentos for update to authenticated using (public.oricse_usuario_pode_permissao(clinica_id,'hotelzinho.operar') or public.oricse_usuario_pode_permissao(clinica_id,'recepcao.agenda')) with check (public.oricse_usuario_pode_permissao(clinica_id,'hotelzinho.operar') or public.oricse_usuario_pode_permissao(clinica_id,'recepcao.agenda'));
