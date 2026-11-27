-- Tutor confirmations are separate from the payment/booking state. Quotes
-- freeze the published items; approval and conversion do not create payment,
-- stock movements, accounting records, or notifications.
create schema if not exists oricse_private;

create table public.oricse_portal_agenda_interacoes (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete restrict,
  agendamento_id uuid not null references public.oricse_agendamentos_online(id) on delete cascade,
  tutor_id uuid not null,
  autor_id uuid references auth.users(id) on delete set null,
  tipo text not null check (tipo in ('confirmacao','pedido','resposta')),
  horario_referencia timestamptz not null,
  pedido_id uuid references public.oricse_portal_agenda_interacoes(id) on delete cascade,
  mensagem text not null default '' check (length(mensagem) <= 500),
  criado_em timestamptz not null default now(),
  check ((tipo='resposta')=(pedido_id is not null)),
  foreign key (clinica_id,tutor_id) references public.tutores(clinica_id,id) on delete cascade
);
create index on public.oricse_portal_agenda_interacoes (clinica_id,agendamento_id,criado_em);
create unique index on public.oricse_portal_agenda_interacoes (clinica_id,agendamento_id,tutor_id,horario_referencia)
  where tipo='confirmacao';
create unique index on public.oricse_portal_agenda_interacoes (pedido_id) where tipo='resposta';
alter table public.oricse_portal_agenda_interacoes enable row level security;
revoke all on public.oricse_portal_agenda_interacoes from public,anon,authenticated;

-- All state changes go through narrowly authorized RPCs, with no direct writes
-- available to authenticated users. Shared helper returns only a boolean.
create or replace function oricse_private.portal_operacao_equipe(p_clinica uuid,p_permissao text)
returns boolean language sql stable security invoker set search_path='' as $$
  select (select auth.uid()) is not null
    and coalesce(lower(auth.jwt()->>'email'),'') <> 'alvorada@vetericio.local'
    and coalesce(auth.jwt()->'app_metadata'->>'oricse_demo_clinica','') <> 'alvorada'
    and exists(select 1 from public.clinicas c where c.id=p_clinica and c.status='ativa' and c.excluido_em is null)
    and coalesce(public.oricse_usuario_pode_permissao(p_clinica,p_permissao),false);
$$;
create or replace function oricse_private.portal_operacao_tutor(p_clinica uuid,p_tutor uuid)
returns boolean language sql stable security invoker set search_path='' as $$
  select (select auth.uid()) is not null
    and coalesce(lower(auth.jwt()->>'email'),'') <> 'alvorada@vetericio.local'
    and coalesce(auth.jwt()->'app_metadata'->>'oricse_demo_clinica','') <> 'alvorada'
    and exists(select 1 from public.clinicas c where c.id=p_clinica and c.status='ativa' and c.excluido_em is null)
    and coalesce(public.oricse_portal_pode_acessar_clinica(p_clinica),false)
    and exists(select 1 from public.oricse_portal_tutores pt
      where pt.clinica_id=p_clinica and pt.tutor_id=p_tutor and pt.ativo and pt.auth_user_id=(select auth.uid()));
$$;
revoke all on function oricse_private.portal_operacao_equipe(uuid,text), oricse_private.portal_operacao_tutor(uuid,uuid)
  from public,anon,authenticated;

create or replace function public.oricse_portal_agenda_interagir(
  p_clinica uuid,p_agendamento uuid,p_horario timestamptz,p_acao text,p_mensagem text default null,p_pedido uuid default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare a public.oricse_agendamentos_online; anterior public.oricse_portal_agenda_interacoes; resultado uuid;
  texto text := btrim(coalesce(p_mensagem,''));
begin
  if (select auth.uid()) is null or p_acao is null or p_acao not in ('confirmacao','pedido','resposta') then
    raise exception 'Ação não disponível.' using errcode='42501';
  end if;
  if length(texto)>500 or (p_acao='resposta' and texto='') then raise exception 'Revise a mensagem (até 500 caracteres).'; end if;

  -- Serialize the tutor and staff actions with real agenda edits to prevent
  -- confirming a stale slot. A paid/held/cancelled status is never overwritten.
  select * into a from public.oricse_agendamentos_online where id=p_agendamento and clinica_id=p_clinica for update;
  if not found or a.tutor_id is null or
      (p_acao='resposta' and not oricse_private.portal_operacao_equipe(p_clinica,'recepcao.agenda')) or
      (p_acao<>'resposta' and not oricse_private.portal_operacao_tutor(p_clinica,a.tutor_id)) then
    raise exception 'Agendamento indisponível.' using errcode='42501';
  end if;
  if p_acao='resposta' then
    select * into anterior from public.oricse_portal_agenda_interacoes
      where id=p_pedido and agendamento_id=a.id and clinica_id=a.clinica_id and tutor_id=a.tutor_id and tipo='pedido';
    if not found then raise exception 'Pedido indisponível.' using errcode='42501'; end if;
    select id into resultado from public.oricse_portal_agenda_interacoes where pedido_id=anterior.id;
    if found then return resultado; end if;
  else
    if a.inicio is distinct from p_horario or a.inicio<=now()
      or a.estado is distinct from 'confirmado'
      or coalesce(a.dados->>'status_clinico','') in ('Cancelado','Finalizado','Não compareceu','Faltou','Em atendimento','Chegou') then
      raise exception 'O horário mudou ou não aceita esta ação. Atualize a agenda.';
    end if;
    if p_acao='confirmacao' then
      select id into resultado from public.oricse_portal_agenda_interacoes
        where clinica_id=a.clinica_id and agendamento_id=a.id and tutor_id=a.tutor_id
          and tipo='confirmacao' and horario_referencia=a.inicio;
      if found then return resultado; end if;
    else
      select i.id into resultado from public.oricse_portal_agenda_interacoes i
        where i.clinica_id=a.clinica_id and i.agendamento_id=a.id and i.tutor_id=a.tutor_id and i.tipo='pedido'
          and not exists(select 1 from public.oricse_portal_agenda_interacoes r where r.pedido_id=i.id)
        order by i.criado_em desc limit 1;
      if found then return resultado; end if;
    end if;
  end if;
  insert into public.oricse_portal_agenda_interacoes(clinica_id,agendamento_id,tutor_id,autor_id,tipo,horario_referencia,pedido_id,mensagem)
    values(a.clinica_id,a.id,a.tutor_id,(select auth.uid()),p_acao,
      case when p_acao='resposta' then anterior.horario_referencia else a.inicio end,
      case when p_acao='resposta' then anterior.id else null end,
      case when p_acao='confirmacao' then '' else texto end)
    returning id into resultado;
  return resultado;
end;
$$;
create or replace function public.oricse_portal_agenda_respostas(p_clinica uuid,p_tutor uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare resultado jsonb;
begin
  if not (case when p_tutor is null then oricse_private.portal_operacao_equipe(p_clinica,'recepcao.agenda')
    else oricse_private.portal_operacao_tutor(p_clinica,p_tutor) end) then
    raise exception 'Agenda indisponível.' using errcode='42501';
  end if;
  -- Limit parent events, never omit a reply attached to an included request.
  with base as (
    select i.id,i.agendamento_id,i.tipo,i.pedido_id,i.mensagem,i.criado_em,i.horario_referencia,
      a.inicio,a.estado,a.tipo as servico,coalesce(pet.nome,a.animal_referencia) as animal,t.nome as tutor
    from public.oricse_portal_agenda_interacoes i
    join public.oricse_agendamentos_online a on a.id=i.agendamento_id and a.clinica_id=i.clinica_id and a.tutor_id=i.tutor_id
    join public.tutores t on t.id=i.tutor_id and t.clinica_id=i.clinica_id
    left join public.oricse_animais pet on pet.id=a.animal_id and pet.clinica_id=a.clinica_id and pet.tutor_id=i.tutor_id
    where i.clinica_id=p_clinica and (p_tutor is null or i.tutor_id=p_tutor) and i.tipo<>'resposta'
    order by (i.tipo='pedido' and not exists(
      select 1 from public.oricse_portal_agenda_interacoes r where r.pedido_id=i.id
    )) desc,i.criado_em desc,i.id desc limit 150
  ), unidos as (
    select * from base union all
    select r.id,r.agendamento_id,r.tipo,r.pedido_id,r.mensagem,r.criado_em,r.horario_referencia,
      b.inicio,b.estado,b.servico,b.animal,b.tutor
    from base b join public.oricse_portal_agenda_interacoes r on r.pedido_id=b.id
      and r.agendamento_id=b.agendamento_id and r.clinica_id=p_clinica
  )
  select coalesce(jsonb_agg(to_jsonb(x) order by x.criado_em desc,x.id desc),'[]'::jsonb)
  into resultado from unidos x;
  return resultado;
end;
$$;

create table public.oricse_portal_orcamentos (
  id uuid primary key,
  clinica_id uuid not null references public.clinicas(id) on delete restrict,
  tutor_id uuid not null,
  animal_id uuid not null,
  itens jsonb not null check (jsonb_typeof(itens)='array'),
  pedido jsonb not null,
  total_centavos integer not null check (total_centavos between 0 and 100000000),
  observacoes text not null check (length(observacoes)<=1000),
  validade_em date not null,
  estado text not null default 'compartilhado' check (estado in ('compartilhado','aprovado','convertido')),
  compartilhou_id uuid references auth.users(id) on delete set null,
  compartilhado_em timestamptz not null default now(),
  aprovado_por uuid references auth.users(id) on delete set null,
  aprovado_em timestamptz,
  convertido_por uuid references auth.users(id) on delete set null,
  convertido_em timestamptz,
  unique (clinica_id,id),
  foreign key (clinica_id,tutor_id) references public.tutores(clinica_id,id) on delete restrict,
  foreign key (clinica_id,animal_id) references public.oricse_animais(clinica_id,id) on delete restrict,
  check ((estado='compartilhado')=(aprovado_em is null)),
  check ((estado='convertido')=(convertido_em is not null))
);
create index on public.oricse_portal_orcamentos (clinica_id,tutor_id,compartilhado_em desc);
create index on public.oricse_portal_orcamentos (clinica_id,estado,compartilhado_em desc);
alter table public.oricse_portal_orcamentos enable row level security;
revoke all on public.oricse_portal_orcamentos from public,anon,authenticated;

alter table public.oricse_portal_comandas add column orcamento_portal_id uuid;
alter table public.oricse_portal_comandas add constraint oricse_comanda_orcamento_fk
  foreign key (clinica_id,orcamento_portal_id) references public.oricse_portal_orcamentos(clinica_id,id) on delete restrict;
create unique index on public.oricse_portal_comandas (clinica_id,orcamento_portal_id) where orcamento_portal_id is not null;

-- Reproduces the catalog's species/sex specificity and inclusive weight cutoff.
create function oricse_private.portal_preco_item_orcamento(
  p_faixas jsonb,p_valor numeric,p_especie text,p_sexo text,p_peso numeric
) returns numeric language sql immutable set search_path='' as $$
  with faixas as (
    select f.ord,f.value,
      case when f.value->>'especie' in ('Cão','Gato') then f.value->>'especie' end as esp,
      case when f.value->>'sexo' in ('Macho','Fêmea') then f.value->>'sexo' end as sx
    from jsonb_array_elements(case when jsonb_typeof(p_faixas)='array' then p_faixas else '[]'::jsonb end)
      with ordinality f(value,ord)
  ), condicao as (
    select esp,sx from faixas
    where p_especie in ('Cão','Gato') and p_sexo in ('Macho','Fêmea') and p_peso between .001 and 60
      and (esp is null or esp=p_especie) and (sx is null or sx=p_sexo)
    order by (esp is not null)::integer+(sx is not null)::integer desc,(esp is not null) desc,ord
    limit 1
  )
  select case when exists(select 1 from faixas) then (
    select case when jsonb_typeof(f.value->'valor')='number' then (f.value->>'valor')::numeric end
    from faixas f join condicao c on c.esp is not distinct from f.esp and c.sx is not distinct from f.sx
    where case jsonb_typeof(f.value->'ateKg')
      when 'null' then true when 'number' then p_peso<=(f.value->>'ateKg')::numeric else false end
    order by f.ord limit 1
  ) else p_valor end;
$$;
revoke all on function oricse_private.portal_preco_item_orcamento(jsonb,numeric,text,text,numeric) from public,anon,authenticated;

create or replace function public.oricse_portal_orcamento_compartilhar(
  p_clinica uuid,p_id uuid,p_tutor uuid,p_animal uuid,p_validade_dias integer,
  p_observacoes text,p_linhas jsonb,p_total_centavos integer
) returns uuid language plpgsql security definer set search_path='' as $$
declare antigo public.oricse_portal_orcamentos; produto public.oricse_catalogo_itens;
  linha jsonb; itens_prontos jsonb:='[]'::jsonb; pedido_atual jsonb; q numeric; v numeric; subtotal numeric; total numeric:=0;
  obs text:=btrim(coalesce(p_observacoes,''));
begin
  if not oricse_private.portal_operacao_equipe(p_clinica,'caixa.comandas') then
    raise exception 'Sem acesso para compartilhar orçamentos.' using errcode='42501';
  end if;
  if p_id is null or p_validade_dias is null or p_validade_dias not between 1 and 365
    or length(obs)>1000 or p_total_centavos is null or p_total_centavos not between 0 and 100000000
    or jsonb_typeof(p_linhas) is distinct from 'array' or jsonb_array_length(p_linhas) not between 1 and 100
    or octet_length(p_linhas::text)>50000 then raise exception 'Revise os dados do orçamento.'; end if;
  if not coalesce(public.oricse_clinica_tem_funcionalidade(p_clinica,'portal_tutor.acesso'),false)
    or not exists(select 1 from public.oricse_animais where clinica_id=p_clinica and id=p_animal and tutor_id=p_tutor)
    or not exists(select 1 from public.oricse_portal_tutores where clinica_id=p_clinica and tutor_id=p_tutor and ativo and auth_user_id is not null) then
    raise exception 'Vincule o animal a um tutor com acesso ativo ao Portal nesta clínica.';
  end if;
  pedido_atual:=jsonb_build_object('itens',p_linhas,'validade',p_validade_dias,'total',p_total_centavos,'observacoes',obs);
  perform pg_advisory_xact_lock(hashtextextended('oricse-orcamento-portal:'||p_id::text,0));
  select * into antigo from public.oricse_portal_orcamentos where id=p_id;
  if found then
    if antigo.clinica_id=p_clinica and antigo.tutor_id=p_tutor and antigo.animal_id=p_animal
      and antigo.compartilhou_id=(select auth.uid()) and antigo.pedido=pedido_atual then return antigo.id; end if;
    raise exception 'Já existe outro orçamento com esta referência.';
  end if;
  for linha in select value from jsonb_array_elements(p_linhas) loop
    if coalesce(linha->>'produtoId','') !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
      or coalesce(linha->>'id','') !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
      or coalesce(linha->>'quantidade','') !~ '^[0-9]{1,5}(\.[0-9]{1,3})?$'
      or coalesce(linha->>'peso','') !~ '^([0-9]{1,2}(\.[0-9]{1,3})?)?$'
      or exists(select 1 from jsonb_array_elements(itens_prontos) i where i->>'id'=linha->>'id') then
      raise exception 'Revise as quantidades e os itens do orçamento.';
    end if;
    q:=(linha->>'quantidade')::numeric;
    select * into produto from public.oricse_catalogo_itens
      where clinica_id=p_clinica and id=(linha->>'produtoId')::uuid and ativo and tipo in ('servico','produto')
      for share;
    if not found or q not between .001 and 10000 then raise exception 'Item de catálogo indisponível.'; end if;
    v:=oricse_private.portal_preco_item_orcamento(
      case when produto.tipo='servico' then produto.faixas_peso else null end,
      produto.valor,linha->>'especie',linha->>'sexo',nullif(linha->>'peso','')::numeric);
    if v is null or v not between 0 and 1000000 then raise exception 'Preço indisponível. Revise as faixas do catálogo.'; end if;
    v:=round(v,2);
    subtotal:=round(q*v*100);
    if coalesce(linha->>'valorCentavos','') !~ '^[0-9]{1,10}$' or coalesce(linha->>'subtotalCentavos','') !~ '^[0-9]{1,12}$' then
      raise exception 'Revise os preços exibidos no orçamento.';
    end if;
    if v*100<>(linha->>'valorCentavos')::numeric or subtotal<>(linha->>'subtotalCentavos')::numeric then
      raise exception 'O preço de um item mudou. Confira os valores antes de compartilhar.';
    end if;
    total:=total+subtotal;
    itens_prontos:=itens_prontos||jsonb_build_array(jsonb_build_object(
      'id',linha->>'id','catalogoItemId',produto.id,'descricao',produto.nome,'quantidade',q,
      'valorUnitario',v,'subtotalCentavos',subtotal,'tipo',produto.tipo,'criadoEm',now(),'criadoPor','Orçamento do Portal'));
  end loop;
  if total<>p_total_centavos then raise exception 'O preço mudou. Confira o orçamento antes de compartilhar.'; end if;
  insert into public.oricse_portal_orcamentos
    (id,clinica_id,tutor_id,animal_id,itens,pedido,total_centavos,observacoes,validade_em,compartilhou_id)
  values (p_id,p_clinica,p_tutor,p_animal,itens_prontos,pedido_atual,total,obs,
    (now() at time zone 'America/Sao_Paulo')::date+p_validade_dias,(select auth.uid()));
  return p_id;
end;
$$;

create or replace function public.oricse_portal_orcamento_aprovar(p_clinica uuid,p_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare o public.oricse_portal_orcamentos;
begin
  select * into o from public.oricse_portal_orcamentos where id=p_id and clinica_id=p_clinica for update;
  if not found or not oricse_private.portal_operacao_tutor(p_clinica,o.tutor_id)
    or not exists(select 1 from public.oricse_animais where id=o.animal_id and tutor_id=o.tutor_id and clinica_id=p_clinica) then
    raise exception 'Orçamento indisponível.' using errcode='42501';
  end if;
  if o.estado in ('aprovado','convertido') then return o.id; end if;
  if o.validade_em<(now() at time zone 'America/Sao_Paulo')::date then raise exception 'Este orçamento está vencido.'; end if;
  update public.oricse_portal_orcamentos set estado='aprovado',aprovado_em=now(),aprovado_por=(select auth.uid()) where id=o.id;
  return o.id;
end;
$$;

create or replace function public.oricse_portal_orcamento_converter(p_clinica uuid,p_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare o public.oricse_portal_orcamentos; nova uuid; sequencia bigint;
begin
  if not oricse_private.portal_operacao_equipe(p_clinica,'caixa.comandas') then
    raise exception 'Sem acesso para abrir comandas.' using errcode='42501';
  end if;
  select * into o from public.oricse_portal_orcamentos where id=p_id and clinica_id=p_clinica for update;
  if not found or o.estado not in ('aprovado','convertido') then raise exception 'Orçamento aprovado não encontrado.'; end if;
  select id into nova from public.oricse_portal_comandas where clinica_id=p_clinica and orcamento_portal_id=o.id;
  if found then return nova; end if;
  if o.estado='convertido' then raise exception 'A comanda vinculada não está disponível.'; end if;
  if not exists(select 1 from public.oricse_animais where clinica_id=p_clinica and id=o.animal_id and tutor_id=o.tutor_id)
    then raise exception 'O vínculo do animal mudou. Revise o orçamento.'; end if;

  -- Same lock as clinical checkout: both allocate the next clinic number.
  perform pg_advisory_xact_lock(hashtextextended('oricse-atendimento:'||p_clinica::text,0));
  select coalesce(max(numero),0)+1 into sequencia from public.oricse_portal_comandas where clinica_id=p_clinica;
  nova:=gen_random_uuid();
  insert into public.oricse_portal_comandas
    (id,clinica_id,tutor_id,animal_id,numero,status,origem,aberta_em,itens,pagamentos,total,total_pago,saldo,visivel_tutor,orcamento_portal_id,finalizada_em)
  values (nova,p_clinica,o.tutor_id,o.animal_id,sequencia,case when o.total_centavos=0 then 'Finalizada' else 'Aberta' end,'Orçamento do Portal',now(),o.itens,'[]',
    o.total_centavos::numeric/100,0,o.total_centavos::numeric/100,true,o.id,case when o.total_centavos=0 then now() end);
  update public.oricse_portal_orcamentos set estado='convertido',convertido_em=now(),convertido_por=(select auth.uid()) where id=o.id;
  return nova;
end;
$$;

create or replace function public.oricse_portal_orcamentos_listar(p_clinica uuid,p_tutor uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare resultado jsonb;
begin
  if not (case when p_tutor is null then oricse_private.portal_operacao_equipe(p_clinica,'caixa.comandas')
    else oricse_private.portal_operacao_tutor(p_clinica,p_tutor) end) then
    raise exception 'Orçamentos indisponíveis.' using errcode='42501';
  end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.compartilhado_em desc),'[]'::jsonb) into resultado
  from (select o.id,o.estado,o.total_centavos,o.observacoes,o.itens,o.validade_em,o.compartilhado_em,o.aprovado_em,o.convertido_em,
      o.animal_id,a.nome as animal,t.nome as tutor, c.id as comanda_id,c.numero as comanda_numero,
      o.validade_em<(now() at time zone 'America/Sao_Paulo')::date as vencido
    from public.oricse_portal_orcamentos o
    join public.oricse_animais a on a.id=o.animal_id and a.clinica_id=o.clinica_id and a.tutor_id=o.tutor_id
    join public.tutores t on t.id=o.tutor_id and t.clinica_id=o.clinica_id
    left join public.oricse_portal_comandas c on c.orcamento_portal_id=o.id and c.clinica_id=o.clinica_id
    where o.clinica_id=p_clinica and (p_tutor is null or o.tutor_id=p_tutor)
    order by (p_tutor is null and o.estado='aprovado') desc,o.compartilhado_em desc,o.id
    limit 100) x;
  return resultado;
end;
$$;

revoke all on function public.oricse_portal_agenda_interagir(uuid,uuid,timestamptz,text,text,uuid),
  public.oricse_portal_agenda_respostas(uuid,uuid),public.oricse_portal_orcamento_compartilhar(uuid,uuid,uuid,uuid,integer,text,jsonb,integer),
  public.oricse_portal_orcamento_aprovar(uuid,uuid),public.oricse_portal_orcamento_converter(uuid,uuid),
  public.oricse_portal_orcamentos_listar(uuid,uuid) from public,anon,authenticated;
grant execute on function public.oricse_portal_agenda_interagir(uuid,uuid,timestamptz,text,text,uuid),
  public.oricse_portal_agenda_respostas(uuid,uuid),public.oricse_portal_orcamento_compartilhar(uuid,uuid,uuid,uuid,integer,text,jsonb,integer),
  public.oricse_portal_orcamento_aprovar(uuid,uuid),public.oricse_portal_orcamento_converter(uuid,uuid),
  public.oricse_portal_orcamentos_listar(uuid,uuid) to authenticated;
-- Preserve the approved snapshot and conversion link. Legacy table policies
-- cannot edit/delete the quote-backed comanda or attach another row to it.
create function oricse_private.proteger_comanda_orcamento()
returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='INSERT' then
    if new.orcamento_portal_id is not null and current_user not in ('postgres','service_role') then
      raise exception 'Abra a comanda pelo orçamento aprovado.' using errcode='42501';
    end if;
    return new;
  elsif tg_op='DELETE' then
    if old.orcamento_portal_id is not null and current_user not in ('postgres','service_role') then
      raise exception 'A comanda vinculada ao orçamento não pode ser removida aqui.' using errcode='42501';
    end if;
    return old;
  elsif (old.orcamento_portal_id is not null or new.orcamento_portal_id is not null)
      and current_user not in ('postgres','service_role') then
    raise exception 'Altere esta comanda pelo fluxo do orçamento.' using errcode='42501';
  end if;
  return new;
end;
$$;
revoke all on function oricse_private.proteger_comanda_orcamento() from public,anon,authenticated;
create trigger oricse_proteger_comanda_orcamento before insert or update or delete on public.oricse_portal_comandas
  for each row execute function oricse_private.proteger_comanda_orcamento();

-- Reuse the existing explicit reception/settlement path only when a staff
-- member later records an actual receipt. Approval/conversion never call it.
create or replace function public.oricse_receber_comanda_atendimento(
  p_comanda uuid,p_pagamento uuid,p_centavos integer,p_forma text
) returns void language plpgsql security definer set search_path='' as $$
declare c public.oricse_portal_comandas; restante numeric; autor text;
begin
  select * into c from public.oricse_portal_comandas where id=p_comanda and (atendimento_registro_id is not null or orcamento_portal_id is not null) for update;
  if not found or not coalesce(public.oricse_caixa_pode_operar(c.clinica_id),false) then raise exception 'Comanda indisponível para pagamento.' using errcode='42501'; end if;
  if exists(select 1 from public.oricse_caixa_lancamentos where clinica_id=c.clinica_id and origem_tipo='comanda_atendimento'
    and origem_id=p_pagamento and detalhes->>'comanda_id'=p_comanda::text) then return; end if;
  if c.status<>'Aberta' or p_pagamento is null or p_centavos is null or p_centavos<=0 or p_centavos>c.saldo*100
    or length(btrim(coalesce(p_forma,''))) not between 1 and 80 then raise exception 'Informe uma forma e um valor dentro do saldo da comanda.'; end if;
  restante:=greatest(0,c.saldo-p_centavos::numeric/100);
  select coalesce(nullif(username,''),email) into autor from public.app_users where user_id=(select auth.uid());
  insert into public.oricse_caixa_lancamentos(clinica_id,setor,origem_tipo,origem_id,tipo,status,descricao,valor_centavos,forma_pagamento,
    registrado_por,detalhes)
  values(c.clinica_id,case when c.orcamento_portal_id is not null then 'Venda Expressa' else 'Consultas' end,'comanda_atendimento',p_pagamento,'entrada','pago','Pagamento da comanda #'||c.numero,p_centavos,p_forma,
    (select auth.uid()),jsonb_build_object('comanda_id',c.id));
  update public.oricse_portal_comandas set total_pago=total_pago+p_centavos::numeric/100,saldo=restante,
    status=case when restante=0 then 'Finalizada' else 'Aberta' end,
    finalizada_em=case when restante=0 then now() end,pagamentos=pagamentos||jsonb_build_array(jsonb_build_object(
      'id',p_pagamento,'valor',p_centavos::numeric/100,'formaPagamento',p_forma,'data',now(),'registradoPor',autor)),updated_at=now()
  where id=c.id;
end;
$$;
revoke all on function public.oricse_receber_comanda_atendimento(uuid,uuid,integer,text) from public,anon,authenticated;
grant execute on function public.oricse_receber_comanda_atendimento(uuid,uuid,integer,text) to authenticated;

notify pgrst,'reload schema';
