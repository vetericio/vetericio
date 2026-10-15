-- Oricse Módulo 2: permissões por cargo e exceções por usuário.

create table if not exists public.oricse_permissoes (
  codigo text primary key,
  nome text not null,
  grupo text not null,
  descricao text not null default '',
  funcionalidade_codigo text references public.oricse_funcionalidades(codigo) on update cascade on delete set null,
  ordem integer not null default 0,
  ativo boolean not null default true
);

create table if not exists public.oricse_permissoes_papel (
  papel text not null check (papel in ('responsavel','admin_clinica','usuario','rt','veterinario','auxiliar_estagiario','recepcao')),
  permissao_codigo text not null references public.oricse_permissoes(codigo) on update cascade on delete cascade,
  permitido boolean not null default false,
  primary key (papel, permissao_codigo)
);

create table if not exists public.oricse_permissoes_usuario (
  clinica_id uuid not null,
  user_id uuid not null,
  permissao_codigo text not null references public.oricse_permissoes(codigo) on update cascade on delete cascade,
  permitido boolean not null,
  atualizado_por uuid references auth.users(id) on delete set null,
  atualizado_em timestamptz not null default now(),
  primary key (clinica_id, user_id, permissao_codigo),
  foreign key (clinica_id, user_id)
    references public.clinica_usuarios(clinica_id, user_id) on delete cascade
);

create index if not exists oricse_permissoes_usuario_clinica_idx
  on public.oricse_permissoes_usuario(clinica_id, user_id);

insert into public.oricse_permissoes(codigo,nome,grupo,descricao,funcionalidade_codigo,ordem) values
('atividade.ponto','Ponto e atividade','Atividade','Registrar e consultar a própria jornada.','atividade.ponto',10),
('recepcao.agenda','Agenda e fila','Recepção','Visualizar e operar agenda e fila de espera.','recepcao.agenda',20),
('recepcao.cadastros.visualizar','Ver tutores e animais','Recepção','Consultar cadastros de tutores e animais.','recepcao.cadastros',21),
('recepcao.cadastros.criar','Cadastrar tutores e animais','Recepção','Criar novos tutores e animais.','recepcao.cadastros',22),
('recepcao.cadastros.editar','Editar tutores e animais','Recepção','Alterar cadastros existentes.','recepcao.cadastros',23),
('recepcao.cadastros.excluir','Excluir tutores e animais','Recepção','Excluir cadastros da clínica.','recepcao.cadastros',24),
('consultorio.atendimentos','Consultas e prontuários','Consultório','Acessar consultas e prontuários.','consultorio.atendimentos',30),
('consultorio.medicacoes','Calculadora de medicações','Consultório','Acessar ferramentas de cálculo de medicações.','consultorio.medicacoes',31),
('consultorio.receituario','Receituário e assinatura','Consultório','Emitir receitas e assinar documentos.','consultorio.receituario',32),
('internacao.painel','Painel de internação','Internação','Visualizar animais internados e painel clínico.','internacao.painel',40),
('internacao.registrar','Registrar evolução e parâmetros','Internação','Registrar observações, parâmetros e evolução.','internacao.painel',41),
('internacao.medicacoes','Medicações da internação','Internação','Acessar e registrar medicações da internação.','internacao.medicacoes',42),
('internacao.plantoes','Plantões e históricos','Internação','Abrir, finalizar e consultar plantões e históricos.','internacao.plantoes',43),
('caixa.financeiro.visualizar','Ver financeiro','Caixa','Consultar financeiro e caixa.','caixa.financeiro',50),
('caixa.financeiro.gerenciar','Gerenciar financeiro','Caixa','Realizar lançamentos e alterações financeiras.','caixa.financeiro',51),
('caixa.comandas','Comandas','Caixa','Visualizar e operar comandas.','caixa.comandas',52),
('estoque.catalogo.visualizar','Ver produtos e serviços','Estoque','Consultar catálogo de produtos e serviços.','estoque.catalogo',60),
('estoque.catalogo.gerenciar','Gerenciar produtos e serviços','Estoque','Cadastrar, editar e excluir itens do catálogo.','estoque.catalogo',61),
('estoque.movimentar','Movimentar estoque','Estoque','Registrar entradas, saídas e ajustes de estoque.','estoque.movimentar',62),
('equipe.pagamentos.visualizar','Ver pagamentos da equipe','Equipe','Consultar pagamentos e remunerações da equipe.','equipe.pagamentos',70),
('equipe.pagamentos.gerenciar','Gerenciar pagamentos da equipe','Equipe','Configurar remuneração, comissão e lançamentos da equipe.','equipe.pagamentos',71),
('administracao.configuracoes','Configurações da clínica','Administração','Alterar configurações operacionais da clínica.',null,80),
('administracao.site','Site da clínica','Administração','Configurar site e domínio da clínica.','administracao.site',81),
('administracao.temas','Temas','Administração','Alterar aparência e temas.','administracao.temas',82),
('administracao.usuarios','Usuários da clínica','Administração','Criar, desativar e alterar cargos de usuários.',null,83),
('administracao.permissoes','Permissões dos usuários','Administração','Conceder ou retirar permissões individuais.',null,84)
on conflict (codigo) do update set
  nome=excluded.nome,
  grupo=excluded.grupo,
  descricao=excluded.descricao,
  funcionalidade_codigo=excluded.funcionalidade_codigo,
  ordem=excluded.ordem,
  ativo=true;

-- Completa a matriz dos planos sem sobrescrever decisões já existentes.
insert into public.oricse_plano_funcionalidades(plano_id, funcionalidade_codigo, permitido)
select p.id, f.codigo,
  case
    when p.codigo = 'master-equipe' then true
    when p.codigo = 'plus-clinica' then f.codigo in (
      'atividade.ponto','recepcao.agenda','recepcao.cadastros',
      'consultorio.atendimentos','consultorio.medicacoes','consultorio.receituario',
      'caixa.financeiro','caixa.comandas','estoque.catalogo','estoque.movimentar',
      'administracao.temas','portal_tutor.agendamento_online'
    )
    else false
  end
from public.oricse_planos p
cross join public.oricse_funcionalidades f
where p.codigo in ('plus-clinica','master-equipe')
on conflict (plano_id, funcionalidade_codigo) do nothing;

insert into public.oricse_plano_funcionalidades(plano_id, funcionalidade_codigo, permitido)
select p.id, f.codigo, false
from public.oricse_planos p
cross join public.oricse_funcionalidades f
where p.codigo='essencial'
  and not exists (
    select 1 from public.oricse_plano_funcionalidades pf
    where pf.plano_id=p.id and pf.funcionalidade_codigo=f.codigo
  )
on conflict (plano_id, funcionalidade_codigo) do nothing;

-- Defaults por cargo. Gestores têm tudo; demais cargos começam no princípio do menor privilégio.
insert into public.oricse_permissoes_papel(papel,permissao_codigo,permitido)
select r.papel, p.codigo,
  case
    when r.papel in ('responsavel','admin_clinica','rt') then true
    when r.papel='veterinario' then p.codigo in (
      'atividade.ponto','recepcao.agenda','recepcao.cadastros.visualizar',
      'consultorio.atendimentos','consultorio.medicacoes','consultorio.receituario',
      'internacao.painel','internacao.registrar','internacao.medicacoes','internacao.plantoes'
    )
    when r.papel='auxiliar_estagiario' then p.codigo in (
      'atividade.ponto','recepcao.agenda','internacao.painel','internacao.registrar','internacao.medicacoes'
    )
    when r.papel='recepcao' then p.codigo in (
      'atividade.ponto','recepcao.agenda','recepcao.cadastros.visualizar',
      'recepcao.cadastros.criar','recepcao.cadastros.editar',
      'caixa.financeiro.visualizar','caixa.financeiro.gerenciar','caixa.comandas',
      'estoque.catalogo.visualizar'
    )
    when r.papel='usuario' then p.codigo='atividade.ponto'
    else false
  end
from (values ('responsavel'),('admin_clinica'),('usuario'),('rt'),('veterinario'),('auxiliar_estagiario'),('recepcao')) r(papel)
cross join public.oricse_permissoes p
on conflict (papel,permissao_codigo) do nothing;

create or replace function public.oricse_pode_gerenciar_permissoes(p_clinica_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and (
      public.oricse_is_platform_admin()
      or exists (
        select 1
        from public.clinica_usuarios cu
        where cu.clinica_id=p_clinica_id
          and cu.user_id=(select auth.uid())
          and cu.ativo=true
          and cu.papel in ('responsavel','admin_clinica','rt')
      )
    );
$$;

create or replace function public.oricse_usuario_pode_permissao(p_clinica_id uuid, p_codigo text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.oricse_is_platform_admin()
    or exists (
      select 1
      from public.clinica_usuarios cu
      join public.oricse_permissoes p on p.codigo=p_codigo and p.ativo=true
      where cu.clinica_id=p_clinica_id
        and cu.user_id=(select auth.uid())
        and cu.ativo=true
        and (
          p.funcionalidade_codigo is null
          or public.oricse_plano_permite(p_clinica_id,p.funcionalidade_codigo)
        )
        and coalesce(
          (select pu.permitido
           from public.oricse_permissoes_usuario pu
           where pu.clinica_id=p_clinica_id
             and pu.user_id=(select auth.uid())
             and pu.permissao_codigo=p_codigo),
          (select pp.permitido
           from public.oricse_permissoes_papel pp
           where pp.papel=cu.papel and pp.permissao_codigo=p_codigo),
          false
        )
    );
$$;

create or replace function public.oricse_permissoes_efetivas(p_clinica_id uuid, p_user_id uuid default null)
returns table (
  codigo text,
  nome text,
  grupo text,
  descricao text,
  permitido boolean,
  origem text,
  ordem integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  alvo uuid := coalesce(p_user_id, (select auth.uid()));
  papel_alvo text;
begin
  if (select auth.uid()) is null then
    raise exception 'Sessão inválida.' using errcode='42501';
  end if;

  if alvo <> (select auth.uid()) and not public.oricse_pode_gerenciar_permissoes(p_clinica_id) then
    raise exception 'Sem permissão para consultar este usuário.' using errcode='42501';
  end if;

  select cu.papel into papel_alvo
  from public.clinica_usuarios cu
  where cu.clinica_id=p_clinica_id and cu.user_id=alvo and cu.ativo=true;

  if papel_alvo is null then
    raise exception 'Usuário sem vínculo ativo com esta clínica.' using errcode='42501';
  end if;

  return query
  select p.codigo,p.nome,p.grupo,p.descricao,
    case
      when p.funcionalidade_codigo is not null
       and not public.oricse_plano_permite(p_clinica_id,p.funcionalidade_codigo)
        then false
      else coalesce(pu.permitido,pp.permitido,false)
    end as permitido,
    case
      when p.funcionalidade_codigo is not null
       and not public.oricse_plano_permite(p_clinica_id,p.funcionalidade_codigo)
        then 'plano'
      when pu.permissao_codigo is not null then 'usuario'
      else 'cargo'
    end as origem,
    p.ordem
  from public.oricse_permissoes p
  left join public.oricse_permissoes_papel pp
    on pp.papel=papel_alvo and pp.permissao_codigo=p.codigo
  left join public.oricse_permissoes_usuario pu
    on pu.clinica_id=p_clinica_id and pu.user_id=alvo and pu.permissao_codigo=p.codigo
  where p.ativo=true
  order by p.ordem,p.codigo;
end;
$$;

create or replace function public.oricse_definir_permissao_usuario(
  p_clinica_id uuid,
  p_user_id uuid,
  p_codigo text,
  p_permitido boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.oricse_pode_gerenciar_permissoes(p_clinica_id) then
    raise exception 'Sem permissão para gerenciar acessos desta clínica.' using errcode='42501';
  end if;
  if not exists (
    select 1 from public.clinica_usuarios cu
    where cu.clinica_id=p_clinica_id and cu.user_id=p_user_id and cu.ativo=true
  ) then
    raise exception 'Usuário sem vínculo ativo com esta clínica.' using errcode='22023';
  end if;
  if not exists (select 1 from public.oricse_permissoes p where p.codigo=p_codigo and p.ativo=true) then
    raise exception 'Permissão inválida.' using errcode='22023';
  end if;

  insert into public.oricse_permissoes_usuario(
    clinica_id,user_id,permissao_codigo,permitido,atualizado_por,atualizado_em
  ) values (
    p_clinica_id,p_user_id,p_codigo,p_permitido,(select auth.uid()),now()
  )
  on conflict (clinica_id,user_id,permissao_codigo)
  do update set permitido=excluded.permitido, atualizado_por=excluded.atualizado_por, atualizado_em=now();
end;
$$;

create or replace function public.oricse_restaurar_permissao_usuario(
  p_clinica_id uuid,
  p_user_id uuid,
  p_codigo text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.oricse_pode_gerenciar_permissoes(p_clinica_id) then
    raise exception 'Sem permissão para gerenciar acessos desta clínica.' using errcode='42501';
  end if;
  delete from public.oricse_permissoes_usuario
  where clinica_id=p_clinica_id and user_id=p_user_id and permissao_codigo=p_codigo;
end;
$$;

alter table public.oricse_permissoes enable row level security;
alter table public.oricse_permissoes_papel enable row level security;
alter table public.oricse_permissoes_usuario enable row level security;

drop policy if exists permissoes_catalogo_ler on public.oricse_permissoes;
create policy permissoes_catalogo_ler on public.oricse_permissoes
for select to authenticated using (true);

drop policy if exists permissoes_papel_ler on public.oricse_permissoes_papel;
create policy permissoes_papel_ler on public.oricse_permissoes_papel
for select to authenticated using (true);

drop policy if exists permissoes_usuario_ler on public.oricse_permissoes_usuario;
create policy permissoes_usuario_ler on public.oricse_permissoes_usuario
for select to authenticated
using (
  user_id=(select auth.uid())
  or public.oricse_pode_gerenciar_permissoes(clinica_id)
);

drop policy if exists permissoes_usuario_gerenciar on public.oricse_permissoes_usuario;
create policy permissoes_usuario_gerenciar on public.oricse_permissoes_usuario
for all to authenticated
using (public.oricse_pode_gerenciar_permissoes(clinica_id))
with check (public.oricse_pode_gerenciar_permissoes(clinica_id));

-- Tutores passam a respeitar permissões de ação, não apenas vínculo com a clínica.
drop policy if exists tutores_select_minha_clinica on public.tutores;
create policy tutores_select_minha_clinica on public.tutores for select to authenticated
using (public.oricse_usuario_pode_permissao(clinica_id,'recepcao.cadastros.visualizar'));

drop policy if exists tutores_insert_minha_clinica on public.tutores;
create policy tutores_insert_minha_clinica on public.tutores for insert to authenticated
with check (public.oricse_usuario_pode_permissao(clinica_id,'recepcao.cadastros.criar'));

drop policy if exists tutores_update_minha_clinica on public.tutores;
create policy tutores_update_minha_clinica on public.tutores for update to authenticated
using (public.oricse_usuario_pode_permissao(clinica_id,'recepcao.cadastros.editar'))
with check (public.oricse_usuario_pode_permissao(clinica_id,'recepcao.cadastros.editar'));

drop policy if exists tutores_delete_minha_clinica on public.tutores;
create policy tutores_delete_minha_clinica on public.tutores for delete to authenticated
using (public.oricse_usuario_pode_permissao(clinica_id,'recepcao.cadastros.excluir'));

-- Catálogos e estoque.
drop policy if exists "catalogo leitura da propria clinica" on public.clinica_catalogo_itens;
create policy "catalogo leitura da propria clinica" on public.clinica_catalogo_itens for select to authenticated
using (public.oricse_usuario_pode_permissao(clinica_id,'estoque.catalogo.visualizar'));

drop policy if exists "catalogo gestao da propria clinica" on public.clinica_catalogo_itens;
create policy "catalogo gestao da propria clinica" on public.clinica_catalogo_itens for all to authenticated
using (public.oricse_usuario_pode_permissao(clinica_id,'estoque.catalogo.gerenciar'))
with check (public.oricse_usuario_pode_permissao(clinica_id,'estoque.catalogo.gerenciar'));

drop policy if exists oricse_catalogo_leitura_clinica on public.oricse_catalogo_itens;
create policy oricse_catalogo_leitura_clinica on public.oricse_catalogo_itens for select to authenticated
using (public.oricse_usuario_pode_permissao(clinica_id,'estoque.catalogo.visualizar'));

drop policy if exists oricse_catalogo_edicao_clinica on public.oricse_catalogo_itens;
create policy oricse_catalogo_edicao_clinica on public.oricse_catalogo_itens for all to authenticated
using (public.oricse_usuario_pode_permissao(clinica_id,'estoque.catalogo.gerenciar'))
with check (public.oricse_usuario_pode_permissao(clinica_id,'estoque.catalogo.gerenciar'));

-- Comissão e remuneração passam a usar a permissão específica da equipe.
drop policy if exists oricse_comissoes_leitura_clinica on public.oricse_regras_comissao;
create policy oricse_comissoes_leitura_clinica on public.oricse_regras_comissao for select to authenticated
using (public.oricse_usuario_pode_permissao(clinica_id,'equipe.pagamentos.visualizar'));

drop policy if exists oricse_comissoes_edicao_clinica on public.oricse_regras_comissao;
create policy oricse_comissoes_edicao_clinica on public.oricse_regras_comissao for all to authenticated
using (public.oricse_usuario_pode_permissao(clinica_id,'equipe.pagamentos.gerenciar'))
with check (public.oricse_usuario_pode_permissao(clinica_id,'equipe.pagamentos.gerenciar'));

drop policy if exists oricse_remuneracao_leitura_clinica on public.oricse_remuneracao_funcionario;
create policy oricse_remuneracao_leitura_clinica on public.oricse_remuneracao_funcionario for select to authenticated
using (
  public.oricse_usuario_pode_permissao(clinica_id,'equipe.pagamentos.visualizar')
  or (
    funcionario_id=(select auth.uid())
    and exists (
      select 1 from public.clinica_usuarios cu
      where cu.clinica_id=oricse_remuneracao_funcionario.clinica_id
        and cu.user_id=(select auth.uid()) and cu.ativo=true
    )
  )
);

drop policy if exists oricse_remuneracao_edicao_clinica on public.oricse_remuneracao_funcionario;
create policy oricse_remuneracao_edicao_clinica on public.oricse_remuneracao_funcionario for all to authenticated
using (public.oricse_usuario_pode_permissao(clinica_id,'equipe.pagamentos.gerenciar'))
with check (public.oricse_usuario_pode_permissao(clinica_id,'equipe.pagamentos.gerenciar'));

create or replace function public.oricse_pode_gerenciar_pagamentos(p_clinica uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.oricse_usuario_pode_permissao(p_clinica,'equipe.pagamentos.gerenciar');
$$;

revoke all on function public.oricse_pode_gerenciar_permissoes(uuid) from public, anon;
revoke all on function public.oricse_usuario_pode_permissao(uuid,text) from public, anon;
revoke all on function public.oricse_permissoes_efetivas(uuid,uuid) from public, anon;
revoke all on function public.oricse_definir_permissao_usuario(uuid,uuid,text,boolean) from public, anon;
revoke all on function public.oricse_restaurar_permissao_usuario(uuid,uuid,text) from public, anon;
grant execute on function public.oricse_pode_gerenciar_permissoes(uuid) to authenticated;
grant execute on function public.oricse_usuario_pode_permissao(uuid,text) to authenticated;
grant execute on function public.oricse_permissoes_efetivas(uuid,uuid) to authenticated;
grant execute on function public.oricse_definir_permissao_usuario(uuid,uuid,text,boolean) to authenticated;
grant execute on function public.oricse_restaurar_permissao_usuario(uuid,uuid,text) to authenticated;
grant select on public.oricse_permissoes, public.oricse_permissoes_papel, public.oricse_permissoes_usuario to authenticated;
grant insert,update,delete on public.oricse_permissoes_usuario to authenticated;
