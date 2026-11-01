-- Hotelzinho do ORICSE: hospedagens, acomodações, cuidados e atualizações ao tutor.

insert into public.oricse_funcionalidades (codigo, nome, grupo, ordem, ativo)
values ('hotelzinho.modulo', 'Hotelzinho', 'Hotelzinho', 85, true)
on conflict (codigo) do update set
  nome = excluded.nome,
  grupo = excluded.grupo,
  ordem = excluded.ordem,
  ativo = true;

insert into public.oricse_plano_funcionalidades (plano_id, funcionalidade_codigo, permitido)
select p.id, 'hotelzinho.modulo', p.codigo in ('plus-clinica', 'master-equipe')
from public.oricse_planos p
where p.ativo = true
on conflict (plano_id, funcionalidade_codigo) do nothing;

insert into public.oricse_permissoes (codigo, nome, grupo, descricao, funcionalidade_codigo, ordem, ativo)
values
  ('hotelzinho.visualizar', 'Visualizar hotelzinho', 'Hotelzinho', 'Consultar reservas, hóspedes e cuidados.', 'hotelzinho.modulo', 85, true),
  ('hotelzinho.operar', 'Operar hospedagens', 'Hotelzinho', 'Criar reservas, registrar check-in e check-out, cuidados e avisos.', 'hotelzinho.modulo', 86, true),
  ('hotelzinho.gerenciar', 'Gerenciar hotelzinho', 'Hotelzinho', 'Administrar acomodações e registros do hotelzinho.', 'hotelzinho.modulo', 87, true)
on conflict (codigo) do update set
  nome = excluded.nome,
  grupo = excluded.grupo,
  descricao = excluded.descricao,
  funcionalidade_codigo = excluded.funcionalidade_codigo,
  ordem = excluded.ordem,
  ativo = true;

with papeis(papel) as (
  values ('responsavel'), ('admin_clinica'), ('rt'), ('veterinario'), ('auxiliar_estagiario'), ('recepcao'), ('usuario')
), permissoes(codigo) as (
  values ('hotelzinho.visualizar'), ('hotelzinho.operar'), ('hotelzinho.gerenciar')
)
insert into public.oricse_permissoes_papel (papel, permissao_codigo, permitido)
select p.papel, pe.codigo,
  case
    when p.papel in ('responsavel', 'admin_clinica', 'rt') then true
    when p.papel in ('veterinario', 'auxiliar_estagiario', 'recepcao') and pe.codigo in ('hotelzinho.visualizar', 'hotelzinho.operar') then true
    else false
  end
from papeis p cross join permissoes pe
on conflict (papel, permissao_codigo) do nothing;

create unique index if not exists tutores_clinica_id_id_unique
  on public.tutores (clinica_id, id);
create unique index if not exists oricse_animais_clinica_id_id_unique
  on public.oricse_animais (clinica_id, id);

create table if not exists public.oricse_hotel_acomodacoes (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  nome text not null check (char_length(btrim(nome)) between 1 and 100),
  especie text not null default 'Todos',
  capacidade integer not null default 1 check (capacidade > 0 and capacidade <= 500),
  descricao text not null default '',
  ativa boolean not null default true,
  criado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinica_id, id)
);

create table if not exists public.oricse_hotel_estadias (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  animal_id uuid not null,
  tutor_id uuid not null,
  acomodacao_id uuid,
  status text not null default 'reservada'
    check (status in ('reservada', 'hospedado', 'concluida', 'cancelada')),
  chegada_prevista timestamptz not null,
  saida_prevista timestamptz not null,
  checkin_em timestamptz,
  checkout_em timestamptz,
  alimentacao text not null default '',
  medicacoes text not null default '',
  restricoes text not null default '',
  instrucoes text not null default '',
  pertences jsonb not null default '[]'::jsonb,
  observacoes text not null default '',
  valor_diaria_centavos integer not null default 0 check (valor_diaria_centavos >= 0),
  valor_final_centavos integer check (valor_final_centavos is null or valor_final_centavos >= 0),
  criado_por uuid references auth.users(id) on delete set null,
  checkin_por uuid references auth.users(id) on delete set null,
  checkout_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinica_id, id),
  check (saida_prevista > chegada_prevista),
  constraint oricse_hotel_estadias_animal_fkey
    foreign key (clinica_id, animal_id) references public.oricse_animais(clinica_id, id) on delete restrict,
  constraint oricse_hotel_estadias_tutor_fkey
    foreign key (clinica_id, tutor_id) references public.tutores(clinica_id, id) on delete restrict,
  constraint oricse_hotel_estadias_acomodacao_fkey
    foreign key (clinica_id, acomodacao_id) references public.oricse_hotel_acomodacoes(clinica_id, id) on delete restrict
);

create table if not exists public.oricse_hotel_cuidados (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  estadia_id uuid not null,
  tipo text not null check (tipo in ('alimentacao', 'passeio', 'medicacao', 'observacao')),
  descricao text not null check (char_length(btrim(descricao)) between 1 and 2000),
  ocorrido_em timestamptz not null default now(),
  registrado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint oricse_hotel_cuidados_estadia_fkey
    foreign key (clinica_id, estadia_id) references public.oricse_hotel_estadias(clinica_id, id) on delete cascade
);

create table if not exists public.oricse_hotel_atualizacoes (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  estadia_id uuid not null,
  mensagem text not null check (char_length(btrim(mensagem)) between 1 and 2000),
  canal text not null default 'whatsapp' check (canal in ('whatsapp', 'manual')),
  status text not null default 'link_aberto' check (status in ('preparada', 'link_aberto')),
  criado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint oricse_hotel_atualizacoes_estadia_fkey
    foreign key (clinica_id, estadia_id) references public.oricse_hotel_estadias(clinica_id, id) on delete cascade
);

create index if not exists oricse_hotel_acomodacoes_clinica_idx
  on public.oricse_hotel_acomodacoes (clinica_id, ativa, nome);
create index if not exists oricse_hotel_estadias_clinica_status_datas_idx
  on public.oricse_hotel_estadias (clinica_id, status, chegada_prevista, saida_prevista);
create index if not exists oricse_hotel_estadias_animal_idx
  on public.oricse_hotel_estadias (clinica_id, animal_id, created_at desc);
create index if not exists oricse_hotel_cuidados_estadia_data_idx
  on public.oricse_hotel_cuidados (clinica_id, estadia_id, ocorrido_em desc);
create index if not exists oricse_hotel_atualizacoes_estadia_data_idx
  on public.oricse_hotel_atualizacoes (clinica_id, estadia_id, created_at desc);

alter table public.oricse_hotel_acomodacoes enable row level security;
alter table public.oricse_hotel_estadias enable row level security;
alter table public.oricse_hotel_cuidados enable row level security;
alter table public.oricse_hotel_atualizacoes enable row level security;

grant select, insert, update, delete on public.oricse_hotel_acomodacoes to authenticated;
grant select, insert, update, delete on public.oricse_hotel_estadias to authenticated;
grant select, insert, update, delete on public.oricse_hotel_cuidados to authenticated;
grant select, insert, update, delete on public.oricse_hotel_atualizacoes to authenticated;

create policy hotel_acomodacoes_select on public.oricse_hotel_acomodacoes
  for select to authenticated using (
    public.oricse_usuario_pode_permissao(clinica_id, 'hotelzinho.visualizar')
    or public.oricse_usuario_pode_permissao(clinica_id, 'hotelzinho.operar')
    or public.oricse_usuario_pode_permissao(clinica_id, 'hotelzinho.gerenciar')
  );
create policy hotel_acomodacoes_manage on public.oricse_hotel_acomodacoes
  for all to authenticated using (
    public.oricse_usuario_pode_permissao(clinica_id, 'hotelzinho.gerenciar')
  ) with check (
    public.oricse_usuario_pode_permissao(clinica_id, 'hotelzinho.gerenciar')
  );

create policy hotel_tutores_select on public.tutores
  for select to authenticated using (
    public.oricse_usuario_pode_permissao(clinica_id, 'hotelzinho.visualizar')
    or public.oricse_usuario_pode_permissao(clinica_id, 'hotelzinho.operar')
    or public.oricse_usuario_pode_permissao(clinica_id, 'hotelzinho.gerenciar')
  );
create policy hotel_animais_select on public.oricse_animais
  for select to authenticated using (
    public.oricse_usuario_pode_permissao(clinica_id, 'hotelzinho.visualizar')
    or public.oricse_usuario_pode_permissao(clinica_id, 'hotelzinho.operar')
    or public.oricse_usuario_pode_permissao(clinica_id, 'hotelzinho.gerenciar')
  );

create policy hotel_estadias_select on public.oricse_hotel_estadias
  for select to authenticated using (
    public.oricse_usuario_pode_permissao(clinica_id, 'hotelzinho.visualizar')
    or public.oricse_usuario_pode_permissao(clinica_id, 'hotelzinho.operar')
    or public.oricse_usuario_pode_permissao(clinica_id, 'hotelzinho.gerenciar')
  );
create policy hotel_estadias_insert on public.oricse_hotel_estadias
  for insert to authenticated with check (
    public.oricse_usuario_pode_permissao(clinica_id, 'hotelzinho.operar')
    or public.oricse_usuario_pode_permissao(clinica_id, 'hotelzinho.gerenciar')
  );
create policy hotel_estadias_update on public.oricse_hotel_estadias
  for update to authenticated using (
    public.oricse_usuario_pode_permissao(clinica_id, 'hotelzinho.operar')
    or public.oricse_usuario_pode_permissao(clinica_id, 'hotelzinho.gerenciar')
  ) with check (
    public.oricse_usuario_pode_permissao(clinica_id, 'hotelzinho.operar')
    or public.oricse_usuario_pode_permissao(clinica_id, 'hotelzinho.gerenciar')
  );
create policy hotel_estadias_delete on public.oricse_hotel_estadias
  for delete to authenticated using (
    public.oricse_usuario_pode_permissao(clinica_id, 'hotelzinho.gerenciar')
  );

create policy hotel_cuidados_select on public.oricse_hotel_cuidados
  for select to authenticated using (
    public.oricse_usuario_pode_permissao(clinica_id, 'hotelzinho.visualizar')
    or public.oricse_usuario_pode_permissao(clinica_id, 'hotelzinho.operar')
    or public.oricse_usuario_pode_permissao(clinica_id, 'hotelzinho.gerenciar')
  );
create policy hotel_cuidados_insert on public.oricse_hotel_cuidados
  for insert to authenticated with check (
    public.oricse_usuario_pode_permissao(clinica_id, 'hotelzinho.operar')
    or public.oricse_usuario_pode_permissao(clinica_id, 'hotelzinho.gerenciar')
  );
create policy hotel_cuidados_manage on public.oricse_hotel_cuidados
  for update to authenticated using (
    public.oricse_usuario_pode_permissao(clinica_id, 'hotelzinho.gerenciar')
  ) with check (
    public.oricse_usuario_pode_permissao(clinica_id, 'hotelzinho.gerenciar')
  );
create policy hotel_cuidados_delete on public.oricse_hotel_cuidados
  for delete to authenticated using (
    public.oricse_usuario_pode_permissao(clinica_id, 'hotelzinho.gerenciar')
  );

create policy hotel_atualizacoes_select on public.oricse_hotel_atualizacoes
  for select to authenticated using (
    public.oricse_usuario_pode_permissao(clinica_id, 'hotelzinho.visualizar')
    or public.oricse_usuario_pode_permissao(clinica_id, 'hotelzinho.operar')
    or public.oricse_usuario_pode_permissao(clinica_id, 'hotelzinho.gerenciar')
  );
create policy hotel_atualizacoes_insert on public.oricse_hotel_atualizacoes
  for insert to authenticated with check (
    public.oricse_usuario_pode_permissao(clinica_id, 'hotelzinho.operar')
    or public.oricse_usuario_pode_permissao(clinica_id, 'hotelzinho.gerenciar')
  );
create policy hotel_atualizacoes_delete on public.oricse_hotel_atualizacoes
  for delete to authenticated using (
    public.oricse_usuario_pode_permissao(clinica_id, 'hotelzinho.gerenciar')
  );
