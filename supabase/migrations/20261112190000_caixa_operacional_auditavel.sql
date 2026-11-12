
-- Caixa operacional: novos registros, sem migrar ou apagar lançamentos legados.
-- Alterações financeiras só pelas RPCs abaixo; tabelas abertas somente para leitura sob RLS.
-- Campos complementares para novos lançamentos manuais, sem alterar o histórico existente.
alter table public.oricse_caixa_lancamentos
  add column if not exists detalhes jsonb not null default '{}'::jsonb;
alter table public.oricse_caixa_lancamentos
  add column if not exists data_competencia date;

create table if not exists public.oricse_caixa_turnos (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete restrict,
  aberto_por uuid not null references auth.users(id),
  aberto_nome text not null default '',
  aberto_em timestamptz not null default now(),
  fundo_centavos bigint not null default 0 check (fundo_centavos between 0 and 100000000000),
  observacao_abertura text not null default '',
  status text not null default 'aberto' check (status in ('aberto','fechado')),
  fechado_por uuid references auth.users(id),
  fechado_nome text,
  fechado_em timestamptz,
  contado_centavos bigint check (contado_centavos >= 0),
  esperado_centavos bigint,
  divergencia_centavos bigint,
  justificativa_fechamento text not null default '',
  resumo_fechamento jsonb,
  constraint turno_fechamento_coerente check (
    (status='aberto' and fechado_em is null and fechado_por is null)
    or (status='fechado' and fechado_em is not null and fechado_por is not null
       and contado_centavos is not null and esperado_centavos is not null
       and divergencia_centavos is not null)
  )
);
create unique index if not exists oricse_caixa_um_aberto_clinica
  on public.oricse_caixa_turnos (clinica_id) where status='aberto';
create index if not exists oricse_caixa_turnos_historico
  on public.oricse_caixa_turnos (clinica_id, aberto_em desc);

create table if not exists public.oricse_caixa_ajustes (
  id uuid primary key,
  turno_id uuid not null references public.oricse_caixa_turnos(id) on delete restrict,
  clinica_id uuid not null references public.clinicas(id) on delete restrict,
  tipo text not null check (tipo in ('suprimento','sangria')),
  valor_centavos bigint not null check (valor_centavos > 0 and valor_centavos <= 100000000000),
  motivo text not null check (length(btrim(motivo)) >= 5),
  registrado_por uuid not null references auth.users(id),
  registrado_em timestamptz not null default now()
);
create index if not exists oricse_caixa_ajustes_por_turno
  on public.oricse_caixa_ajustes (turno_id, registrado_em);

create table if not exists public.oricse_caixa_estornos (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete restrict,
  lancamento_id uuid not null references public.oricse_caixa_lancamentos(id) on delete restrict,
  valor_centavos bigint not null check (valor_centavos > 0),
  motivo text not null check (length(btrim(motivo)) >= 10),
  status text not null default 'solicitado' check (status in ('solicitado','confirmado','rejeitado')),
  solicitado_por uuid not null references auth.users(id),
  solicitado_em timestamptz not null default now(),
  revisado_por uuid references auth.users(id),
  revisado_em timestamptz,
  referencia_comprovante text,
  observacao_revisao text
);
create index if not exists oricse_caixa_estornos_por_origem
  on public.oricse_caixa_estornos (clinica_id,lancamento_id,solicitado_em desc);

alter table public.oricse_caixa_turnos enable row level security;
alter table public.oricse_caixa_ajustes enable row level security;
alter table public.oricse_caixa_estornos enable row level security;

revoke all on public.oricse_caixa_turnos,public.oricse_caixa_ajustes,public.oricse_caixa_estornos from public,anon,authenticated;
grant select on public.oricse_caixa_turnos,public.oricse_caixa_ajustes,public.oricse_caixa_estornos to authenticated;

drop policy if exists "caixa_turnos_leitura_autorizada" on public.oricse_caixa_turnos;
create policy "caixa_turnos_leitura_autorizada" on public.oricse_caixa_turnos for select to authenticated
using (public.oricse_usuario_pode_permissao(clinica_id,'caixa.financeiro.visualizar')
       or public.oricse_usuario_pode_permissao(clinica_id,'caixa.comandas'));
drop policy if exists "caixa_ajustes_leitura_autorizada" on public.oricse_caixa_ajustes;
create policy "caixa_ajustes_leitura_autorizada" on public.oricse_caixa_ajustes for select to authenticated
using (public.oricse_usuario_pode_permissao(clinica_id,'caixa.financeiro.visualizar')
       or public.oricse_usuario_pode_permissao(clinica_id,'caixa.comandas'));
drop policy if exists "caixa_estornos_leitura_autorizada" on public.oricse_caixa_estornos;
create policy "caixa_estornos_leitura_autorizada" on public.oricse_caixa_estornos for select to authenticated
using (public.oricse_usuario_pode_permissao(clinica_id,'caixa.financeiro.visualizar')
       or public.oricse_usuario_pode_permissao(clinica_id,'caixa.comandas'));

create or replace function public.oricse_caixa_pode_operar(p_clinica_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
 select (select auth.uid()) is not null
    and exists(select 1 from public.clinicas c where c.id=p_clinica_id and c.status='ativa' and c.excluido_em is null)
    and (public.oricse_usuario_pode_permissao(p_clinica_id,'caixa.financeiro.gerenciar')
       or public.oricse_usuario_pode_permissao(p_clinica_id,'caixa.comandas'));
$$;
revoke all on function public.oricse_caixa_pode_operar(uuid) from public,anon;
grant execute on function public.oricse_caixa_pode_operar(uuid) to authenticated;

create or replace function public.oricse_caixa_abrir(
 p_clinica_id uuid,p_fundo_centavos bigint default 0,p_observacao text default ''
) returns public.oricse_caixa_turnos
language plpgsql security definer set search_path = ''
as $$
declare v_turno public.oricse_caixa_turnos;
begin
 if not public.oricse_caixa_pode_operar(p_clinica_id) then
   raise exception 'Sem permissão para abrir caixa nesta clínica.' using errcode='42501';
 end if;
 if p_fundo_centavos is null or p_fundo_centavos < 0 or p_fundo_centavos > 100000000000 then
   raise exception 'Fundo de troco inválido.' using errcode='22023';
 end if;
 insert into public.oricse_caixa_turnos(clinica_id,aberto_por,aberto_nome,fundo_centavos,observacao_abertura)
 values(p_clinica_id,(select auth.uid()),coalesce((select username from public.app_users where user_id=(select auth.uid())),'Operador'),p_fundo_centavos,coalesce(left(p_observacao,1000),''))
 returning * into v_turno;
 return v_turno;
exception when unique_violation then
 raise exception 'Já existe um caixa aberto para esta clínica. Finalize-o antes de abrir outro.' using errcode='23505';
end;
$$;
revoke all on function public.oricse_caixa_abrir(uuid,bigint,text) from public,anon;
grant execute on function public.oricse_caixa_abrir(uuid,bigint,text) to authenticated;

create or replace function public.oricse_caixa_movimentar(
 p_turno_id uuid,p_tipo text,p_valor_centavos bigint,p_motivo text,p_idempotencia uuid
) returns public.oricse_caixa_ajustes
language plpgsql security definer set search_path = ''
as $$
declare v_turno public.oricse_caixa_turnos; v_ajuste public.oricse_caixa_ajustes;
begin
 select * into v_turno from public.oricse_caixa_turnos where id=p_turno_id for update;
 if not found or not public.oricse_caixa_pode_operar(v_turno.clinica_id) then
   raise exception 'Caixa não encontrado ou sem permissão.' using errcode='42501';
 end if;
 if p_tipo not in ('sangria','suprimento') or p_valor_centavos is null
   or p_valor_centavos <= 0 or p_valor_centavos > 100000000000 or length(btrim(coalesce(p_motivo,''))) < 5 then
   raise exception 'Informe operação, valor e motivo com pelo menos cinco caracteres.' using errcode='22023';
 end if;
 if p_idempotencia is null then raise exception 'Identificador de operação obrigatório.' using errcode='22023'; end if;
 select * into v_ajuste from public.oricse_caixa_ajustes where id=p_idempotencia;
 if found then
   if v_ajuste.turno_id <> p_turno_id or v_ajuste.tipo <> p_tipo
       or v_ajuste.valor_centavos <> p_valor_centavos then
     raise exception 'Identificador de operação já utilizado.' using errcode='23505';
   end if;
   return v_ajuste;
 end if;
 if v_turno.status <> 'aberto' then
   raise exception 'Caixa fechado. Nenhuma operação foi registrada.' using errcode='23514';
 end if;
 insert into public.oricse_caixa_ajustes(id,turno_id,clinica_id,tipo,valor_centavos,motivo,registrado_por)
 values(p_idempotencia,p_turno_id,v_turno.clinica_id,p_tipo,p_valor_centavos,btrim(p_motivo),(select auth.uid()))
 returning * into v_ajuste;
 return v_ajuste;
end;
$$;
revoke all on function public.oricse_caixa_movimentar(uuid,text,bigint,text,uuid) from public,anon;
grant execute on function public.oricse_caixa_movimentar(uuid,text,bigint,text,uuid) to authenticated;

-- Caixa físico: apenas lançamentos centralizados pagos em dinheiro e operações de gaveta.
-- Recebimentos legados não sincronizados ficam fora do fechamento oficial.
create or replace function public.oricse_caixa_resumo_turno(p_turno_id uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare v_turno public.oricse_caixa_turnos; v_dinheiro bigint:=0;v_pix bigint:=0;
 v_credito bigint:=0;v_debito bigint:=0;v_outros bigint:=0;
 v_sangria bigint:=0;v_suprimento bigint:=0;v_estorno_dinheiro bigint:=0;
begin
 select * into v_turno from public.oricse_caixa_turnos where id=p_turno_id;
 if not found or not (public.oricse_usuario_pode_permissao(v_turno.clinica_id,'caixa.financeiro.visualizar')
      or public.oricse_usuario_pode_permissao(v_turno.clinica_id,'caixa.comandas')) then
   raise exception 'Sem permissão para consultar este caixa.' using errcode='42501';
 end if;
 select
  coalesce(sum(case when lower(btrim(l.forma_pagamento)) like '%dinheiro%' then
    case when l.tipo='entrada' then l.valor_centavos else -l.valor_centavos end else 0 end),0),
  coalesce(sum(case when lower(l.forma_pagamento) like '%pix%' then
    case when l.tipo='entrada' then l.valor_centavos else -l.valor_centavos end else 0 end),0),
  coalesce(sum(case when lower(l.forma_pagamento) like '%cr%dito%' then
    case when l.tipo='entrada' then l.valor_centavos else -l.valor_centavos end else 0 end),0),
  coalesce(sum(case when lower(l.forma_pagamento) like '%d%bito%' then
    case when l.tipo='entrada' then l.valor_centavos else -l.valor_centavos end else 0 end),0),
  coalesce(sum(case when lower(l.forma_pagamento) not like '%dinheiro%' and lower(l.forma_pagamento) not like '%pix%'
    and lower(l.forma_pagamento) not like '%cr%dito%' and lower(l.forma_pagamento) not like '%d%bito%' then
    case when l.tipo='entrada' then l.valor_centavos else -l.valor_centavos end else 0 end),0)
 into v_dinheiro,v_pix,v_credito,v_debito,v_outros
 from public.oricse_caixa_lancamentos l
 where l.clinica_id=v_turno.clinica_id and l.registrado_em>=v_turno.aberto_em
   and l.registrado_em<coalesce(v_turno.fechado_em,now()) and l.status='pago';

 select coalesce(sum(case when a.tipo='sangria' then a.valor_centavos else 0 end),0),
        coalesce(sum(case when a.tipo='suprimento' then a.valor_centavos else 0 end),0)
 into v_sangria,v_suprimento
 from public.oricse_caixa_ajustes a where a.turno_id=p_turno_id;
 -- Estornos manuais com comprovante diminuem o esperado em espécie somente quando
 -- a transação original foi registrada em dinheiro e confirmação foi no turno.
 select coalesce(sum(e.valor_centavos),0) into v_estorno_dinheiro
 from public.oricse_caixa_estornos e join public.oricse_caixa_lancamentos l on l.id=e.lancamento_id
 where e.clinica_id=v_turno.clinica_id and e.status='confirmado'
   and lower(l.forma_pagamento) like '%dinheiro%' and e.revisado_em>=v_turno.aberto_em
   and e.revisado_em<coalesce(v_turno.fechado_em,now());

 return jsonb_build_object(
  'fundo_centavos',v_turno.fundo_centavos,'dinheiro_centavos',v_dinheiro,
  'pix_centavos',v_pix,'credito_centavos',v_credito,'debito_centavos',v_debito,
  'outras_formas_centavos',v_outros,'sangria_centavos',v_sangria,
  'suprimento_centavos',v_suprimento,'estorno_dinheiro_centavos',v_estorno_dinheiro,
  'esperado_centavos',v_turno.fundo_centavos+v_dinheiro+v_suprimento-v_sangria-v_estorno_dinheiro,
  'fonte','Apenas lançamentos do Caixa Geral em PostgreSQL; movimentações legadas não conciliadas ficam de fora.'
 );
end;
$$;
revoke all on function public.oricse_caixa_resumo_turno(uuid) from public,anon;
grant execute on function public.oricse_caixa_resumo_turno(uuid) to authenticated;

create or replace function public.oricse_caixa_fechar(
 p_turno_id uuid,p_contado_centavos bigint,p_justificativa text default ''
) returns public.oricse_caixa_turnos
language plpgsql security definer set search_path = ''
as $$
declare v_turno public.oricse_caixa_turnos;v_resumo jsonb;v_esperado bigint;v_diferenca bigint;
begin
 select * into v_turno from public.oricse_caixa_turnos where id=p_turno_id for update;
 if not found or not public.oricse_caixa_pode_operar(v_turno.clinica_id) then
   raise exception 'Sem permissão para fechar este caixa.' using errcode='42501';
 end if;
 if v_turno.status <> 'aberto' then raise exception 'Este caixa já foi fechado.' using errcode='23514';end if;
 if p_contado_centavos is null or p_contado_centavos < 0 or p_contado_centavos>100000000000 then
   raise exception 'Valor contado inválido.' using errcode='22023';
 end if;
 v_resumo:=public.oricse_caixa_resumo_turno(p_turno_id);
 v_esperado:=(v_resumo->>'esperado_centavos')::bigint;
 v_diferenca:=p_contado_centavos-v_esperado;
 if v_diferenca<>0 and length(btrim(coalesce(p_justificativa,'')))<10 then
   raise exception 'Explique a diferença de caixa com pelo menos dez caracteres.' using errcode='22023';
 end if;
 update public.oricse_caixa_turnos
 set status='fechado',fechado_por=(select auth.uid()),
     fechado_nome=coalesce((select username from public.app_users where user_id=(select auth.uid())),'Operador'),fechado_em=now(),
     contado_centavos=p_contado_centavos,esperado_centavos=v_esperado,
     divergencia_centavos=v_diferenca,justificativa_fechamento=coalesce(p_justificativa,''),
     resumo_fechamento=v_resumo
 where id=p_turno_id returning * into v_turno;
 return v_turno;
end;
$$;
revoke all on function public.oricse_caixa_fechar(uuid,bigint,text) from public,anon;
grant execute on function public.oricse_caixa_fechar(uuid,bigint,text) to authenticated;

-- Solicitar estorno não movimenta dinheiro nem aciona o provedor de pagamento.
create or replace function public.oricse_caixa_solicitar_estorno(
 p_lancamento_id uuid,p_valor_centavos bigint,p_motivo text
) returns public.oricse_caixa_estornos
language plpgsql security definer set search_path = ''
as $$
declare v_lancamento public.oricse_caixa_lancamentos;v_reservado bigint;v_estorno public.oricse_caixa_estornos;
begin
 select * into v_lancamento from public.oricse_caixa_lancamentos where id=p_lancamento_id for update;
 if not found or not public.oricse_caixa_pode_operar(v_lancamento.clinica_id) then
   raise exception 'Lançamento inexistente ou operação não autorizada.' using errcode='42501';
 end if;
 if v_lancamento.tipo<>'entrada' or v_lancamento.status<>'pago' then
   raise exception 'Só é possível solicitar estorno de recebimentos confirmados.' using errcode='23514';
 end if;
 if p_valor_centavos is null or p_valor_centavos<=0 or length(btrim(coalesce(p_motivo,'')))<10 then
   raise exception 'Informe valor e motivo com pelo menos dez caracteres.' using errcode='22023';
 end if;
 select coalesce(sum(valor_centavos),0) into v_reservado from public.oricse_caixa_estornos
 where lancamento_id=p_lancamento_id and status in ('solicitado','confirmado');
 if v_reservado+p_valor_centavos>v_lancamento.valor_centavos then
   raise exception 'Estorno excede o valor ainda disponível da transação.' using errcode='23514';
 end if;
 insert into public.oricse_caixa_estornos (clinica_id,lancamento_id,valor_centavos,motivo,solicitado_por)
 values (v_lancamento.clinica_id,p_lancamento_id,p_valor_centavos,btrim(p_motivo),(select auth.uid()))
 returning * into v_estorno;
 return v_estorno;
end;
$$;
revoke all on function public.oricse_caixa_solicitar_estorno(uuid,bigint,text) from public,anon;
grant execute on function public.oricse_caixa_solicitar_estorno(uuid,bigint,text) to authenticated;

create or replace function public.oricse_caixa_revisar_estorno(
 p_estorno_id uuid,p_aprovar boolean,p_referencia text
) returns public.oricse_caixa_estornos
language plpgsql security definer set search_path = ''
as $$
declare v_estorno public.oricse_caixa_estornos;
begin
 select * into v_estorno from public.oricse_caixa_estornos where id=p_estorno_id for update;
 if not found or not (public.oricse_usuario_pode_permissao(v_estorno.clinica_id,'administracao.configuracoes')
    or public.oricse_identity_is_platform_admin()) then
   raise exception 'Estorno não encontrado ou sem aprovação do gestor.' using errcode='42501';
 end if;
 if v_estorno.status<>'solicitado' then raise exception 'Solicitação já revisada.' using errcode='23514';end if;
 if p_aprovar and length(btrim(coalesce(p_referencia,'')))<8 then
   raise exception 'Informe a referência do comprovante de estorno externo. O ORICSE não executa estorno no provedor.' using errcode='22023';
 end if;
 update public.oricse_caixa_estornos
 set status=case when p_aprovar then 'confirmado' else 'rejeitado' end,
     revisado_por=(select auth.uid()),revisado_em=now(),
     referencia_comprovante=case when p_aprovar then btrim(p_referencia) else null end,
     observacao_revisao=case when p_aprovar then 'Estorno externo confirmado pelo gestor; sem integração automática com provedor.'
       else coalesce(nullif(btrim(p_referencia),''),'Solicitação rejeitada pelo gestor') end
 where id=p_estorno_id returning * into v_estorno;
 return v_estorno;
end;
$$;
revoke all on function public.oricse_caixa_revisar_estorno(uuid,boolean,text) from public,anon;
grant execute on function public.oricse_caixa_revisar_estorno(uuid,boolean,text) to authenticated;
