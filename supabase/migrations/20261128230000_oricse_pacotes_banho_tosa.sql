-- Pacotes pré-pagos por paciente/serviço. Um agendamento ocupa uma sessão
-- futura; o consumo ocorre uma única vez quando o atendimento fica pronto.
create table public.oricse_banho_tosa_pacotes (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete restrict,
  tutor_id uuid not null,
  animal_id uuid not null,
  servico_id uuid not null,
  nome text not null check (length(btrim(nome)) between 1 and 120),
  servico_nome text not null,
  sessoes smallint not null check (sessoes between 1 and 100),
  validade date not null,
  vendido_em timestamptz not null default now(),
  vendido_por uuid not null references auth.users(id) on delete restrict,
  requisicao_id uuid not null,
  caixa_id uuid not null references public.oricse_caixa_lancamentos(id) on delete restrict,
  unique (clinica_id,id),
  unique (clinica_id,vendido_por,requisicao_id),
  foreign key (clinica_id,tutor_id) references public.tutores(clinica_id,id),
  foreign key (clinica_id,animal_id) references public.oricse_animais(clinica_id,id),
  foreign key (clinica_id,servico_id) references public.oricse_banho_tosa_servicos(clinica_id,id)
);
create index oricse_banho_pacotes_animal on public.oricse_banho_tosa_pacotes(clinica_id,animal_id,vendido_em desc);
alter table public.oricse_banho_tosa_pacotes enable row level security;
revoke all on public.oricse_banho_tosa_pacotes from public, anon, authenticated;

alter table public.oricse_banho_tosa_agendamentos
  add column pacote_id uuid,
  add column valor_sem_pacote_centavos integer check (valor_sem_pacote_centavos >= 0),
  add constraint oricse_banho_agendamento_pacote_fk
    foreign key(clinica_id,pacote_id) references public.oricse_banho_tosa_pacotes(clinica_id,id) on delete restrict;
create index oricse_banho_agendamentos_pacote on public.oricse_banho_tosa_agendamentos(clinica_id,pacote_id)
  where pacote_id is not null;

create table public.oricse_banho_tosa_consumos (
  agendamento_id uuid primary key references public.oricse_banho_tosa_agendamentos(id) on delete restrict,
  clinica_id uuid not null,
  pacote_id uuid not null,
  consumido_em timestamptz not null default now(),
  foreign key(clinica_id,pacote_id) references public.oricse_banho_tosa_pacotes(clinica_id,id) on delete restrict
);
create index oricse_banho_consumos_pacote on public.oricse_banho_tosa_consumos(clinica_id,pacote_id,consumido_em desc);
alter table public.oricse_banho_tosa_consumos enable row level security;
revoke all on public.oricse_banho_tosa_consumos from public,anon,authenticated;

-- Apenas funções proprietárias chamam estes auxiliares. O status financeiro
-- bloqueia uso futuro sem apagar o histórico; não executa devoluções.
create function public.oricse_banho_pacote_recebido(p_clinica uuid,p_caixa uuid)
returns boolean language sql set search_path='' stable as $$
  select exists(select 1 from public.oricse_caixa_lancamentos l
    where l.clinica_id=p_clinica and l.id=p_caixa and l.tipo='entrada' and l.status='pago')
    and not exists(select 1 from public.oricse_caixa_estornos e
    where e.clinica_id=p_clinica and e.lancamento_id=p_caixa and e.status='confirmado');
$$;
revoke all on function public.oricse_banho_pacote_recebido(uuid,uuid) from public,anon,authenticated;

create function public.oricse_banho_vender_pacote(
 p_clinica uuid,p_animal uuid,p_servico uuid,p_nome text,p_sessoes integer,
 p_validade date,p_valor_centavos integer,p_forma text,p_requisicao uuid
) returns uuid language plpgsql security definer set search_path='' as $$
declare
 v_usuario uuid := (select auth.uid());
 v_p public.oricse_banho_tosa_pacotes;
 v_l public.oricse_caixa_lancamentos;
 v_tutor uuid;
 v_servico_nome text;
 v_caixa uuid;
 v_id uuid := gen_random_uuid();
 v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
 if v_usuario is null
   or not exists(select 1 from public.clinicas c where c.id=p_clinica and c.status='ativa' and c.slug <> 'alvorada')
   or not (coalesce(public.oricse_usuario_pode_permissao(p_clinica,'hotelzinho.operar'),false)
       or coalesce(public.oricse_usuario_pode_permissao(p_clinica,'recepcao.agenda'),false))
   or not (coalesce(public.oricse_usuario_pode_permissao(p_clinica,'caixa.comandas'),false)
       or coalesce(public.oricse_usuario_pode_permissao(p_clinica,'caixa.financeiro.gerenciar'),false))
 then raise exception 'Seu perfil não pode registrar venda de pacote.' using errcode='42501'; end if;
 if p_requisicao is null or nullif(btrim(p_nome),'') is null or length(btrim(p_nome))>120
   or p_sessoes is null or p_sessoes not between 1 and 100
   or p_validade is null or p_validade > v_hoje+730
   or p_valor_centavos is null or p_valor_centavos not between 1 and 100000000
   or p_forma is null or p_forma not in ('Pix','Dinheiro','Débito','Crédito','Transferência')
 then raise exception 'Confira os dados do pacote e do recebimento.'; end if;

 perform pg_advisory_xact_lock(hashtextextended(p_clinica::text||v_usuario::text||p_requisicao::text,0));
 select * into v_p from public.oricse_banho_tosa_pacotes p
   where p.clinica_id=p_clinica and p.vendido_por=v_usuario and p.requisicao_id=p_requisicao;
 if found then
   select * into v_l from public.oricse_caixa_lancamentos l where l.clinica_id=p_clinica and l.id=v_p.caixa_id;
   if v_p.animal_id=p_animal and v_p.servico_id=p_servico and v_p.nome=btrim(p_nome)
     and v_p.sessoes=p_sessoes and v_p.validade=p_validade and v_l.valor_centavos=p_valor_centavos
     and v_l.forma_pagamento=p_forma
   then return v_p.id; end if;
   raise exception 'Uma venda já foi registrada nesta tentativa. Confira o histórico antes de lançar outra.';
 end if;
 if p_validade<v_hoje then raise exception 'A validade não pode ser anterior à data da venda.'; end if;
 select a.tutor_id into v_tutor from public.oricse_animais a
   where a.clinica_id=p_clinica and a.id=p_animal for share;
 select s.nome into v_servico_nome from public.oricse_banho_tosa_servicos s
   where s.clinica_id=p_clinica and s.id=p_servico and s.ativo for share;
 if v_tutor is null or v_servico_nome is null then raise exception 'Selecione um pet e um serviço ativo desta clínica.'; end if;

 insert into public.oricse_caixa_lancamentos(clinica_id,setor,origem_tipo,origem_id,tipo,status,
   descricao,valor_centavos,forma_pagamento,registrado_por)
 values(p_clinica,'Banho e tosa','banho_tosa_pacote',v_id,'entrada','pago',
   'Pacote de banho e tosa · '||btrim(p_nome),p_valor_centavos,p_forma,v_usuario)
 returning id into v_caixa;
 insert into public.oricse_banho_tosa_pacotes(id,clinica_id,tutor_id,animal_id,servico_id,nome,servico_nome,
   sessoes,validade,vendido_por,requisicao_id,caixa_id)
 values(v_id,p_clinica,v_tutor,p_animal,p_servico,btrim(p_nome),v_servico_nome,p_sessoes,p_validade,
   v_usuario,p_requisicao,v_caixa);
 return v_id;
end $$;
revoke all on function public.oricse_banho_vender_pacote(uuid,uuid,uuid,text,integer,date,integer,text,uuid) from public,anon;
grant execute on function public.oricse_banho_vender_pacote(uuid,uuid,uuid,text,integer,date,integer,text,uuid) to authenticated;

create function public.oricse_banho_proteger_pacote_agenda()
returns trigger language plpgsql security definer set search_path='' as $$
declare
 v_p public.oricse_banho_tosa_pacotes;
 v_data date := (new.inicio at time zone 'America/Sao_Paulo')::date;
 v_usadas integer;
 v_reservadas integer;
 v_ja_consumido boolean := false;
begin
 if tg_op='UPDATE' and old.pacote_id is not null then
   if old.pacote_id is distinct from new.pacote_id or old.clinica_id<>new.clinica_id
     or old.animal_id<>new.animal_id or old.tutor_id<>new.tutor_id
     or old.servico_id is distinct from new.servico_id
     or old.valor_sem_pacote_centavos is distinct from new.valor_sem_pacote_centavos
     or new.valor_centavos<>0
   then raise exception 'O vínculo e o valor de atendimento com pacote não podem ser alterados.'; end if;

   if old.status='cancelado' and new.status<>old.status
     then raise exception 'Faça um novo agendamento para remarcar um atendimento cancelado.'; end if;
   v_ja_consumido := exists(select 1 from public.oricse_banho_tosa_consumos u where u.agendamento_id=old.id);
   if v_ja_consumido and new.status not in ('pronto','entregue')
     then raise exception 'Uma sessão já utilizada não pode ser cancelada ou reaberta aqui.'; end if;
   if new.inicio=old.inicio and (new.status=old.status or new.status='cancelado' or v_ja_consumido)
     then return new; end if;
 end if;

 if new.pacote_id is null then
   new.valor_sem_pacote_centavos := null;
   return new;
 end if;
 if not exists(select 1 from public.clinicas c where c.id=new.clinica_id and c.status='ativa' and c.slug <> 'alvorada')
   then raise exception 'Pacotes não estão disponíveis para esta clínica.'; end if;
 -- Trava compartilhada entre reservas concorrentes para o mesmo pacote.
 select * into v_p from public.oricse_banho_tosa_pacotes p
   where p.clinica_id=new.clinica_id and p.id=new.pacote_id for update;
 if not found or v_p.animal_id<>new.animal_id or v_p.tutor_id<>new.tutor_id or v_p.servico_id is distinct from new.servico_id
   or not exists(select 1 from public.oricse_animais a
                 where a.clinica_id=new.clinica_id and a.id=new.animal_id and a.tutor_id=new.tutor_id)
   then raise exception 'O pacote deve pertencer ao pet, tutor e serviço da mesma clínica.'; end if;
 if v_data < (v_p.vendido_em at time zone 'America/Sao_Paulo')::date or v_data>v_p.validade
   then raise exception 'O horário deve estar dentro da validade do pacote.'; end if;

 if not v_ja_consumido then
   if not public.oricse_banho_pacote_recebido(v_p.clinica_id,v_p.caixa_id)
     then raise exception 'O pacote está suspenso. Confira o recebimento com o financeiro.'; end if;
   if (tg_op='INSERT' or old.pacote_id is null or new.inicio<>old.inicio)
     and v_p.validade < (now() at time zone 'America/Sao_Paulo')::date
     then raise exception 'Pacote vencido; não é possível reservar novas sessões.'; end if;
   select count(*) into v_usadas from public.oricse_banho_tosa_consumos u
     where u.clinica_id=v_p.clinica_id and u.pacote_id=v_p.id;
   select count(*) into v_reservadas from public.oricse_banho_tosa_agendamentos a
     where a.clinica_id=v_p.clinica_id and a.pacote_id=v_p.id and a.id<>new.id
       and a.status in ('agendado','recebido','em_execucao');
   if v_usadas+v_reservadas>=v_p.sessoes then raise exception 'Todas as sessões deste pacote já foram usadas ou reservadas.'; end if;
 end if;

 if tg_op='INSERT' or old.pacote_id is null then
   if new.status not in ('agendado','recebido','em_execucao')
     then raise exception 'Somente agendamentos em aberto podem receber um pacote.'; end if;
   if exists(select 1 from public.oricse_caixa_lancamentos l
     where l.clinica_id=new.clinica_id and l.agendamento_banho_tosa_id=new.id and l.tipo='entrada' and l.status='pago')
     then raise exception 'Este atendimento já tem recebimento. Confira com o financeiro antes de usar um pacote.'; end if;
   new.valor_sem_pacote_centavos := case when tg_op='INSERT' then new.valor_centavos else old.valor_centavos end;
   new.valor_centavos := 0; -- A cobrança do serviço foi registrada na venda. Extras continuam separados.
 end if;
 return new;
end $$;
revoke all on function public.oricse_banho_proteger_pacote_agenda() from public,anon,authenticated;
create trigger oricse_banho_pacote_guard
before insert or update on public.oricse_banho_tosa_agendamentos
for each row execute function public.oricse_banho_proteger_pacote_agenda();

create function public.oricse_banho_consumir_pacote_agenda()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.pacote_id is not null and new.status in ('pronto','entregue') then
   insert into public.oricse_banho_tosa_consumos(agendamento_id,clinica_id,pacote_id)
   values(new.id,new.clinica_id,new.pacote_id) on conflict (agendamento_id) do nothing;
 end if;
 return new;
end $$;
revoke all on function public.oricse_banho_consumir_pacote_agenda() from public,anon,authenticated;
create trigger oricse_banho_pacote_consumir after insert or update of status on public.oricse_banho_tosa_agendamentos
for each row execute function public.oricse_banho_consumir_pacote_agenda();

-- API única para saldo e histórico; a posse do pet no Portal e o escopo da
-- clínica são conferidos no banco. Não devolve meios de pagamento ou dados do tutor.
create function public.oricse_banho_listar_pacotes(p_clinica uuid,p_animal uuid,p_portal boolean)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_tutor uuid;
begin
 if (select auth.uid()) is null or not exists(select 1 from public.clinicas c
   where c.id=p_clinica and c.status='ativa' and c.slug<>'alvorada')
 then return '[]'::jsonb; end if;
 if p_portal is true then
   if not coalesce(public.oricse_portal_pode_acessar_clinica(p_clinica),false) then return '[]'::jsonb; end if;
   select t.tutor_id into v_tutor from public.oricse_portal_tutores t
     join public.oricse_animais a on a.clinica_id=t.clinica_id and a.tutor_id=t.tutor_id
     where t.clinica_id=p_clinica and t.auth_user_id=(select auth.uid()) and t.ativo and a.id=p_animal;
   if v_tutor is null then return '[]'::jsonb; end if;
 elsif not (coalesce(public.oricse_usuario_pode_permissao(p_clinica,'hotelzinho.visualizar'),false)
      or coalesce(public.oricse_usuario_pode_permissao(p_clinica,'hotelzinho.operar'),false)
      or coalesce(public.oricse_usuario_pode_permissao(p_clinica,'recepcao.agenda'),false))
 then raise exception 'Seu perfil não pode consultar pacotes.' using errcode='42501'; end if;

 return coalesce((
   select jsonb_agg(jsonb_build_object(
     'id',p.id,'nome',p.nome,'servicoId',p.servico_id,'servicoNome',p.servico_nome,
     'validade',p.validade,'vendidoEm',p.vendido_em,'total',p.sessoes,
     'usadas',u.usadas,'reservadas',a.reservadas,
     'saldo',greatest(0,p.sessoes-u.usadas),
     'disponiveis',case when st.status='ativo' then greatest(0,p.sessoes-u.usadas-a.reservadas) else 0 end,
     'status',st.status,'historico',u.eventos
   ) order by p.vendido_em desc,p.id)
   from (select * from public.oricse_banho_tosa_pacotes x
     where x.clinica_id=p_clinica and x.animal_id=p_animal and (v_tutor is null or x.tutor_id=v_tutor)
     order by x.vendido_em desc,x.id limit 100) p
   cross join lateral (select count(*) as usadas,
     coalesce(jsonb_agg(jsonb_build_object('consumidoEm',x.consumido_em) order by x.consumido_em desc),'[]'::jsonb) as eventos
     from public.oricse_banho_tosa_consumos x where x.clinica_id=p.clinica_id and x.pacote_id=p.id) u
   cross join lateral (select count(*) as reservadas from public.oricse_banho_tosa_agendamentos x
     where x.clinica_id=p.clinica_id and x.pacote_id=p.id and x.status in ('agendado','recebido','em_execucao')) a
   cross join lateral (select case
     when not public.oricse_banho_pacote_recebido(p.clinica_id,p.caixa_id) then 'suspenso'
     when p.sessoes<=u.usadas then 'esgotado'
     when p.validade<(now() at time zone 'America/Sao_Paulo')::date then 'vencido'
     else 'ativo' end as status) st
 ), '[]'::jsonb);
end $$;
revoke all on function public.oricse_banho_listar_pacotes(uuid,uuid,boolean) from public,anon;
grant execute on function public.oricse_banho_listar_pacotes(uuid,uuid,boolean) to authenticated;
