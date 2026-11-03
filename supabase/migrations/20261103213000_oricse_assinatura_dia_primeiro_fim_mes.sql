-- Regra comercial simplificada para contratos iniciados no fim do mês:
-- dias 29, 30 e 31 passam a cobrar permanentemente no dia 1.

alter table public.oricse_assinaturas
  add column if not exists dia_primeiro_permanente boolean not null default false;

create or replace function public.oricse_vencimento_assinatura_v2(
  p_inicio date,
  p_dia_ancora integer,
  p_ciclo text,
  p_ciclos integer,
  p_dia_primeiro_permanente boolean default false
)
returns date
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_meses integer;
  v_mes date;
  v_ultimo_dia date;
begin
  if p_inicio is null or p_dia_ancora not between 1 and 31 or p_ciclos < 1 then
    raise exception 'Dados de vencimento inválidos' using errcode='22023';
  end if;

  if p_ciclo = 'anual' then
    return p_inicio + (365 * p_ciclos);
  end if;

  v_meses := public.oricse_meses_ciclo(p_ciclo);
  if v_meses <= 0 then raise exception 'Ciclo inválido' using errcode='22023'; end if;

  if p_dia_primeiro_permanente then
    -- Primeiro ciclo completo termina no dia 1 após o período contratado.
    -- Ex.: 29/30/31 de agosto, mensal => 1º de outubro; depois, sempre dia 1.
    return (date_trunc('month', p_inicio)::date + make_interval(months => (v_meses * p_ciclos) + 1))::date;
  end if;

  v_mes := (date_trunc('month', p_inicio)::date + make_interval(months => v_meses * p_ciclos))::date;
  v_ultimo_dia := (v_mes + interval '1 month - 1 day')::date;
  if p_dia_ancora > extract(day from v_ultimo_dia)::integer then
    return (v_mes + interval '1 month')::date;
  end if;
  return (v_mes + (p_dia_ancora - 1))::date;
end;
$$;

update public.oricse_assinaturas
set dia_primeiro_permanente=true,
    dia_ancora=1,
    proximo_vencimento_em=public.oricse_vencimento_assinatura_v2(inicio_em,1,ciclo,ciclos_cobrados,true),
    updated_at=now()
where ciclo <> 'anual'
  and extract(day from inicio_em)::integer in (29,30,31);

create or replace function public.oricse_registrar_pagamento_assinatura(
  p_contratacao_id uuid,
  p_pagamento_id text,
  p_pago_em timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.oricse_assinaturas;
  v_ciclos integer;
  v_vencimento date;
begin
  select * into a from public.oricse_assinaturas
  where contratacao_id=p_contratacao_id
  for update;

  if not found then return jsonb_build_object('vinculada',false); end if;
  if a.ultimo_pagamento_id = p_pagamento_id then
    return jsonb_build_object('vinculada',true,'duplicado',true,'proximo_vencimento_em',a.proximo_vencimento_em);
  end if;

  v_ciclos := a.ciclos_cobrados + 1;
  v_vencimento := public.oricse_vencimento_assinatura_v2(
    a.inicio_em,a.dia_ancora,a.ciclo,v_ciclos,a.dia_primeiro_permanente
  );

  update public.oricse_assinaturas
  set ciclos_cobrados=v_ciclos,ultimo_pagamento_id=p_pagamento_id,
      ultimo_pagamento_em=coalesce(p_pago_em,now()),proximo_vencimento_em=v_vencimento,
      status='ativa',bloqueado_em=null,updated_at=now()
  where id=a.id;

  update public.clinicas
  set ultimo_pagamento_em=coalesce(p_pago_em,now()),
      proximo_pagamento_em=(v_vencimento::timestamp at time zone 'America/Sao_Paulo'),
      acesso_ate=((v_vencimento + 1)::timestamp at time zone 'America/Sao_Paulo'),
      status_financeiro='em_dia',updated_at=now()
  where id=a.clinica_id;

  return jsonb_build_object('vinculada',true,'proximo_vencimento_em',v_vencimento);
end;
$$;

create or replace function public.oricse_criar_assinatura_contratacao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inicio date;
  v_vencimento date;
  v_modo text;
  v_primeiro boolean;
  v_ancora integer;
begin
  if new.clinica_criada_id is null
    or new.pagamento_aprovado_em is null
    or new.pagamento_id is null
    or new.ciclo not in ('mensal','trimestral','semestral','anual','bienal') then
    return new;
  end if;

  v_inicio := timezone('America/Sao_Paulo',new.pagamento_aprovado_em)::date;
  v_modo := case when new.renovacao_automatica or new.modo_renovacao='automatica_cartao'
    then 'automatica_cartao' else 'manual' end;
  v_primeiro := new.ciclo <> 'anual' and extract(day from v_inicio)::integer in (29,30,31);
  v_ancora := case when v_primeiro then 1 else extract(day from v_inicio)::integer end;
  v_vencimento := public.oricse_vencimento_assinatura_v2(v_inicio,v_ancora,new.ciclo,1,v_primeiro);

  insert into public.oricse_assinaturas (
    clinica_id,contratacao_id,plano_codigo,ciclo,modo_renovacao,status,
    inicio_em,proximo_vencimento_em,dia_ancora,dia_primeiro_permanente,ciclos_cobrados,
    ultimo_pagamento_id,ultimo_pagamento_em,mp_assinatura_id,mp_assinatura_status
  ) values (
    new.clinica_criada_id,new.id,new.plano_codigo,new.ciclo,v_modo,'ativa',
    v_inicio,v_vencimento,v_ancora,v_primeiro,1,
    new.pagamento_id,new.pagamento_aprovado_em,new.mp_assinatura_id,new.mp_assinatura_status
  )
  on conflict (contratacao_id) do nothing;

  update public.clinicas
  set ultimo_pagamento_em=new.pagamento_aprovado_em,
      proximo_pagamento_em=(v_vencimento::timestamp at time zone 'America/Sao_Paulo'),
      acesso_ate=((v_vencimento + 1)::timestamp at time zone 'America/Sao_Paulo'),
      status_financeiro='em_dia',updated_at=now()
  where id=new.clinica_criada_id;

  return new;
end;
$$;