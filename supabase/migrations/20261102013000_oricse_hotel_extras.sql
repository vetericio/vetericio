create table if not exists public.oricse_hotel_extras (
 id uuid primary key default gen_random_uuid(),
 clinica_id uuid not null references public.clinicas(id) on delete cascade,
 estadia_id uuid not null,
 categoria text not null check (categoria in ('Alimentação','Ração','Brinquedo','Serviço','Outro')),
 descricao text not null check (char_length(btrim(descricao)) between 1 and 200),
 quantidade numeric(12,3) not null check (quantidade > 0),
 valor_unitario_centavos integer not null check (valor_unitario_centavos >= 0),
 criado_por uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 constraint hotel_extras_estadia_fk foreign key (clinica_id,estadia_id) references public.oricse_hotel_estadias(clinica_id,id) on delete cascade
);
create index if not exists hotel_extras_estadia_idx on public.oricse_hotel_extras(clinica_id,estadia_id,created_at desc);
alter table public.oricse_hotel_extras enable row level security;
grant select,insert,delete on public.oricse_hotel_extras to authenticated;
create policy hotel_extras_read on public.oricse_hotel_extras for select to authenticated using (public.oricse_usuario_pode_permissao(clinica_id,'hotelzinho.visualizar') or public.oricse_usuario_pode_permissao(clinica_id,'hotelzinho.operar') or public.oricse_usuario_pode_permissao(clinica_id,'hotelzinho.gerenciar'));
create policy hotel_extras_insert on public.oricse_hotel_extras for insert to authenticated with check (public.oricse_usuario_pode_permissao(clinica_id,'hotelzinho.operar') or public.oricse_usuario_pode_permissao(clinica_id,'hotelzinho.gerenciar'));
create policy hotel_extras_delete on public.oricse_hotel_extras for delete to authenticated using (public.oricse_usuario_pode_permissao(clinica_id,'hotelzinho.gerenciar'));
