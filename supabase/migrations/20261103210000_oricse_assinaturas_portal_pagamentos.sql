-- Assinaturas, ciclos de cobrança e pagamentos no Portal do Tutor.
-- A data âncora é sempre preservada para meses sem 29, 30 ou 31.

alter table public.oricse_planos
  add column if not exists preco_trimestral text not null default '',
  add column if not exists preco_semestral text not null default '',
  add column if not exists preco_bienal text not null default '';

update public.oricse_planos
set
  preco_trimestral = case codigo
    when 'essencial' then 'R$ 149,70'
    when 'plus-clinica' then 'R$ 299,70'
    when 'master-equipe' then 'R$ 599,70'
    else preco_trimestral end,
  preco_semestral = case codigo
    when 'essencial' then 'R$ 299,40'
    when 'plus-clinica' then 'R$ 599,40'
    when 'master-equipe' then 'R$ 1.199,40'
    else preco_semestral end,
  preco_bienal = case codigo
    when 'essencial' then 'R$ 1.197,60'
    when 'plus-clinica' then 'R$ 2.397,60'
    when 'master-equipe' then 'R$ 4.797,60'
    else preco_bienal end
where codigo in ('essencial','plus-clinica','master-equipe');

alter table public.oricse_contratacoes
  add column if not exists modo_renovacao text not null default 'manual',
  add column if not exists mp_assinatura_id text,
  add column if not exists mp_assinatura_status text,
  add column if not exists renovacao_automatica boolean not null default false,
  add column if not exists clinica_criada_id uuid references public.clinicas(id) on delete set null;

alter table public.oricse_contratacoes
  drop constraint if exists oricse_contratacoes_ciclo_check;

alter table public.oricse_contratacoes
  add constraint oricse_contratacoes_ciclo_check
  check (ciclo = any (array['mensal','trimestral','semestral','anual','bienal','teste']));

alter table public.oricse_agendamentos_online
  add column if not exists pagamento_expira_em timestamptz,
  add column if not exists pagamento_id uuid,
  add column if not exists pagamento_valor_centavos integer;

create table if not exists public.oricse_assinaturas (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null unique references public.clinicas(id) on delete cascade,
  contratacao_id uuid not null unique references public.oricse_contratacoes(id) on delete cascade,
  plano_codigo text not null,
  ciclo text not null check (ciclo = any (array['mensal','trimestral','semestral','anual','bienal'])),
  modo_renovacao text not null check (modo_renovacao = any (array['automatica_cartao','manual'])),
  status text not null default 'ativa' check (status = any (array['ativa','cancelada','suspensa'])),
  inicio_em date not null,
  proximo_vencimento_em date not null,
  dia_ancora smallint not null check (dia_ancora between 1 and 31),
  ciclos_cobrados integer not null default 1 check (ciclos_cobrados > 0),
  ultimo_pagamento_id text,
  ultimo_pagamento_em timestamptz,
  mp_assinatura_id text,
  mp_assinatura_status text,
  bloqueado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists oricse_assinaturas_vencimento_idx
  on public.oricse_assinaturas (proximo_vencimento_em, status);

create unique index if not exists oricse_pagamentos_mp_payment_id_unico
  on public.oricse_pagamentos (mp_payment_id)
  where mp_payment_id is not null;

create or replace function public.oricse_valor_brl(p_valor text)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select greatest(
    0,
    coalesce(
      nullif(
        replace(
          replace(regexp_replace(coalesce(p_valor,''), '[^0-9,.-]', '', 'g'), '.', ''),
          ',', '.'
        ),
        ''
      )::numeric,
      0
    )
  );
$$;

create or replace function public.oricse_meses_ciclo(p_ciclo text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_ciclo
    when 'mensal' then 1
    when 'trimestral' then 3
    when 'semestral' then 6
    when 'bienal' then 24
    else 0
  end;
$$;

create or replace function public.oricse_vencimento_assinatura(
  p_inicio date,
  p_dia_ancora integer,
  p_ciclo text,
  p_ciclos integer
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

  v_meses := public.oricse_meses_ciclo(p_ciclo) * p_ciclos;
  if v_meses <= 0 then
    raise exception 'Ciclo inválido' using errcode='22023';
  end if;

  v_mes := (date_trunc('month', p_inicio)::date + make_interval(months => v_meses))::date;
  v_ultimo_dia := (v_mes + interval '1 month - 1 day')::date;

  -- Sem dia correspondente (29/30/31): vence no primeiro dia depois daquele mês.
  if p_dia_ancora > extract(day from v_ultimo_dia)::integer then
    return (v_mes + interval '1 month')::date;
  end if;

  return (v_mes + (p_dia_ancora - 1))::date;
end;
$$;

create or replace function public.oricse_assinatura_status_clinica(p_clinica_id uuid)
returns table (
  situacao text,
  ciclo text,
  modo_renovacao text,
  proximo_vencimento_em date,
  dias_atraso integer,
  titulo text,
  mensagem text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  a public.oricse_assinaturas;
  v_hoje date := timezone('America/Sao_Paulo', now())::date;
begin
  select * into a
  from public.oricse_assinaturas
  where clinica_id=p_clinica_id
  order by created_at desc
  limit 1;

  -- Clínicas anteriores a esta implantação permanecem no estado financeiro atual.
  if not found then
    return query select
      case when exists(select 1 from public.clinicas c where c.id=p_clinica_id and c.status_financeiro='atrasado')
        then 'bloqueada' else 'ativa' end,
      null::text, null::text, null::date, 0,
      case when exists(select 1 from public.clinicas c where c.id=p_clinica_id and c.status_financeiro='atrasado')
        then 'Acesso temporariamente bloqueado' else 'Acesso em dia' end,
      case when exists(select 1 from public.clinicas c where c.id=p_clinica_id and c.status_financeiro='atrasado')
        then 'Regularize a assinatura para retomar o sistema administrativo.' else 'Assinatura em dia.' end;
    return;
  end if;

  if a.status <> 'ativa' then
    return query select 'bloqueada'::text,a.ciclo,a.modo_renovacao,a.proximo_vencimento_em,
      greatest(0,v_hoje-a.proximo_vencimento_em),
      'Acesso temporariamente bloqueado'::text,
      'Regularize a assinatura para retomar o sistema administrativo.'::text;
    return;
  end if;

  if v_hoje <= a.proximo_vencimento_em then
    return query select 'ativa'::text,a.ciclo,a.modo_renovacao,a.proximo_vencimento_em,0,
      'Assinatura em dia'::text,
      ('Seu acesso administrativo está ativo até ' || to_char(a.proximo_vencimento_em,'DD/MM/YYYY') || '.')::text;
    return;
  end if;

  if v_hoje <= a.proximo_vencimento_em + 2 then
    return query select 'aviso'::text,a.ciclo,a.modo_renovacao,a.proximo_vencimento_em,
      v_hoje-a.proximo_vencimento_em,
      'Sua assinatura venceu'::text,
      ('Regularize até ' || to_char(a.proximo_vencimento_em + 2,'DD/MM/YYYY') || ' para evitar o bloqueio do sistema administrativo. O Portal do Tutor continua disponível.')::text;
    return;
  end if;

  return query select 'bloqueada'::text,a.ciclo,a.modo_renovacao,a.proximo_vencimento_em,
    v_hoje-a.proximo_vencimento_em,
    'Acesso administrativo bloqueado'::text,
    'O Portal do Tutor continua disponível. Regularize a assinatura para voltar a usar o sistema administrativo.'::text;
end;
$$;

create or replace function public.oricse_acesso_administrativo_liberado(p_clinica_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select s.situacao in ('ativa','aviso') from public.oricse_assinatura_status_clinica(p_clinica_id) s),
    false
  );
$$;

create or replace function public.oricse_meu_status_assinatura()
returns table (
  situacao text,
  ciclo text,
  modo_renovacao text,
  proximo_vencimento_em date,
  dias_atraso integer,
  titulo text,
  mensagem text
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.*
  from public.clinica_usuarios cu
  cross join lateral public.oricse_assinatura_status_clinica(cu.clinica_id) s
  where cu.user_id=(select auth.uid()) and cu.ativo=true
  order by cu.created_at,cu.clinica_id
  limit 1;
$$;

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

  if not found then
    return jsonb_build_object('vinculada',false);
  end if;
  if a.ultimo_pagamento_id = p_pagamento_id then
    return jsonb_build_object('vinculada',true,'duplicado',true,'proximo_vencimento_em',a.proximo_vencimento_em);
  end if;

  v_ciclos := a.ciclos_cobrados + 1;
  v_vencimento := public.oricse_vencimento_assinatura(a.inicio_em,a.dia_ancora,a.ciclo,v_ciclos);

  update public.oricse_assinaturas
  set ciclos_cobrados=v_ciclos,
      ultimo_pagamento_id=p_pagamento_id,
      ultimo_pagamento_em=coalesce(p_pago_em,now()),
      proximo_vencimento_em=v_vencimento,
      status='ativa',
      bloqueado_em=null,
      updated_at=now()
  where id=a.id;

  update public.clinicas
  set ultimo_pagamento_em=coalesce(p_pago_em,now()),
      proximo_pagamento_em=(v_vencimento::timestamp at time zone 'America/Sao_Paulo'),
      acesso_ate=((v_vencimento + 1)::timestamp at time zone 'America/Sao_Paulo'),
      status_financeiro='em_dia',
      updated_at=now()
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
  v_vencimento := public.oricse_vencimento_assinatura(v_inicio,extract(day from v_inicio)::integer,new.ciclo,1);

  insert into public.oricse_assinaturas (
    clinica_id,contratacao_id,plano_codigo,ciclo,modo_renovacao,status,
    inicio_em,proximo_vencimento_em,dia_ancora,ciclos_cobrados,
    ultimo_pagamento_id,ultimo_pagamento_em,mp_assinatura_id,mp_assinatura_status
  ) values (
    new.clinica_criada_id,new.id,new.plano_codigo,new.ciclo,v_modo,'ativa',
    v_inicio,v_vencimento,extract(day from v_inicio)::integer,1,
    new.pagamento_id,new.pagamento_aprovado_em,new.mp_assinatura_id,new.mp_assinatura_status
  )
  on conflict (contratacao_id) do nothing;

  update public.clinicas
  set ultimo_pagamento_em=new.pagamento_aprovado_em,
      proximo_pagamento_em=(v_vencimento::timestamp at time zone 'America/Sao_Paulo'),
      acesso_ate=((v_vencimento + 1)::timestamp at time zone 'America/Sao_Paulo'),
      status_financeiro='em_dia',
      updated_at=now()
  where id=new.clinica_criada_id;

  return new;
end;
$$;

drop trigger if exists oricse_contratacao_cria_assinatura on public.oricse_contratacoes;
create trigger oricse_contratacao_cria_assinatura
after insert or update of clinica_criada_id,pagamento_aprovado_em,pagamento_id,mp_assinatura_id,mp_assinatura_status
on public.oricse_contratacoes
for each row execute function public.oricse_criar_assinatura_contratacao();

create or replace function public.oricse_iniciar_contratacao(p_dados jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  novo public.oricse_contratacoes;
  plano public.oricse_planos;
  v_ciclo text := lower(coalesce(p_dados->>'ciclo',''));
  v_modo text := coalesce(p_dados->>'modo_renovacao','manual');
  v_meses integer;
  v_base numeric(12,2);
  v_total_bruto numeric(12,2);
  v_total numeric(12,2);
  v_usuarios integer;
  v_inclusos integer;
  v_extras integer;
  v_extra_mensal numeric(12,2) := 14.90;
  v_promo jsonb;
  v_documento text;
begin
  if jsonb_typeof(p_dados) is distinct from 'object'
    or p_dados->>'aceitou_termos' is distinct from 'true'
    or p_dados->>'aceitou_privacidade' is distinct from 'true' then
    raise exception 'Revise os dados e aceite os termos e a política de privacidade.' using errcode='22023';
  end if;
  if coalesce(btrim(p_dados->>'clinica_nome'),'')='' or coalesce(btrim(p_dados->>'responsavel_nome'),'')=''
    or coalesce(btrim(p_dados->>'responsavel_email'),'')='' then
    raise exception 'Informe o nome da clínica e os dados do responsável.' using errcode='22023';
  end if;
  if v_ciclo not in ('mensal','trimestral','semestral','anual','bienal') then
    raise exception 'Ciclo de contratação inválido.' using errcode='22023';
  end if;
  if v_modo not in ('automatica_cartao','manual') then
    raise exception 'Forma de renovação inválida.' using errcode='22023';
  end if;

  select * into plano from public.oricse_planos
  where codigo=nullif(btrim(p_dados->>'plano_codigo'),'') and ativo;
  if not found then raise exception 'O plano selecionado não está disponível.' using errcode='22023'; end if;

  v_meses := case v_ciclo when 'mensal' then 1 when 'trimestral' then 3 when 'semestral' then 6 when 'anual' then 12 else 24 end;
  v_base := public.oricse_valor_brl(
    case v_ciclo
      when 'mensal' then plano.preco_mensal
      when 'trimestral' then plano.preco_trimestral
      when 'semestral' then plano.preco_semestral
      when 'anual' then plano.preco_anual
      else plano.preco_bienal
    end
  );
  if v_base <= 0 then raise exception 'O preço deste período ainda não foi configurado.' using errcode='22023'; end if;

  v_usuarios := greatest(1,least(10000,coalesce(nullif(p_dados->>'quantidade_usuarios','')::integer,1)));
  v_inclusos := greatest(1,coalesce(plano.usuarios_inclusos,1));
  v_extras := greatest(0,v_usuarios-v_inclusos);
  v_total_bruto := round(v_base + v_extras*v_extra_mensal*v_meses,2);
  v_total := v_total_bruto;
  v_documento := regexp_replace(coalesce(nullif(p_dados->>'cnpj',''),p_dados->>'responsavel_cpf',''),'\D','','g');

  if coalesce(btrim(p_dados->>'promo_codigo'),'') <> '' then
    v_promo := public.oricse_validar_codigo_promocional(p_dados->>'promo_codigo',plano.codigo,v_documento,v_total_bruto);
    if coalesce((v_promo->>'valido')::boolean,false) is not true then
      raise exception '%',coalesce(v_promo->>'mensagem','Código promocional inválido.') using errcode='22023';
    end if;
    v_total := (v_promo->>'valor_final')::numeric;
  end if;

  insert into public.oricse_contratacoes (
    plano_codigo,plano_nome,ciclo,status,clinica_nome,razao_social,cnpj,clinica_telefone,clinica_email,
    clinica_cep,clinica_endereco,clinica_numero,clinica_complemento,clinica_bairro,clinica_cidade,clinica_uf,
    tipo_operacao,slug_desejado,dominio,quantidade_usuarios,perfis_inclusos,perfis_extras,
    adicional_perfis_mensal,adicional_perfis_ciclo,valor_base,valor_total,valor_exibido,
    responsavel_nome,responsavel_cpf,responsavel_crmv,responsavel_crmv_uf,responsavel_email,responsavel_telefone,
    responsavel_cep,responsavel_endereco,responsavel_numero,responsavel_complemento,responsavel_bairro,
    responsavel_cidade,responsavel_uf,observacoes,aceitou_termos,aceitou_privacidade,
    promo_codigo,promo_valor_original,promo_desconto,promo_valor_final,promo_duracao,
    modo_renovacao,renovacao_automatica,dados
  ) values (
    plano.codigo,plano.nome,v_ciclo,'aguardando_pagamento',btrim(p_dados->>'clinica_nome'),
    nullif(btrim(p_dados->>'razao_social'),''),nullif(regexp_replace(coalesce(p_dados->>'cnpj',''),'\D','','g'),''),
    nullif(btrim(p_dados->>'clinica_telefone'),''),nullif(btrim(p_dados->>'clinica_email'),''),nullif(btrim(p_dados->>'clinica_cep'),''),
    nullif(btrim(p_dados->>'clinica_endereco'),''),nullif(btrim(p_dados->>'clinica_numero'),''),nullif(btrim(p_dados->>'clinica_complemento'),''),
    nullif(btrim(p_dados->>'clinica_bairro'),''),nullif(btrim(p_dados->>'clinica_cidade'),''),nullif(btrim(p_dados->>'clinica_uf'),''),
    nullif(btrim(p_dados->>'tipo_operacao'),''),nullif(btrim(p_dados->>'slug_desejado'),''),nullif(btrim(p_dados->>'dominio'),''),
    v_usuarios,v_inclusos,v_extras,v_extras*v_extra_mensal,v_extras*v_extra_mensal*v_meses,
    v_base,v_total,'R$ '||replace(to_char(v_total,'FM999999999990.00'),'.',','),
    btrim(p_dados->>'responsavel_nome'),nullif(regexp_replace(coalesce(p_dados->>'responsavel_cpf',''),'\D','','g'),''),
    nullif(btrim(p_dados->>'responsavel_crmv'),''),nullif(btrim(p_dados->>'responsavel_crmv_uf'),''),
    lower(btrim(p_dados->>'responsavel_email')),nullif(btrim(p_dados->>'responsavel_telefone'),''),
    nullif(btrim(p_dados->>'responsavel_cep'),''),nullif(btrim(p_dados->>'responsavel_endereco'),''),
    nullif(btrim(p_dados->>'responsavel_numero'),''),nullif(btrim(p_dados->>'responsavel_complemento'),''),
    nullif(btrim(p_dados->>'responsavel_bairro'),''),nullif(btrim(p_dados->>'responsavel_cidade'),''),
    nullif(btrim(p_dados->>'responsavel_uf'),''),nullif(btrim(p_dados->>'observacoes'),''),true,true,
    nullif(btrim(p_dados->>'promo_codigo'),''),
    case when v_promo is null then null else (v_promo->>'valor_original')::numeric end,
    case when v_promo is null then null else (v_promo->>'desconto_aplicado')::numeric end,
    case when v_promo is null then null else (v_promo->>'valor_final')::numeric end,
    case when v_promo is null then null else nullif(v_promo->>'duracao','') end,
    v_modo,v_modo='automatica_cartao',p_dados
  ) returning * into novo;

  if v_promo is not null then
    insert into public.oricse_codigo_promocional_usos(codigo_id,contratacao_id,documento_normalizado)
    select p.id,novo.id,nullif(v_documento,'')
    from public.oricse_codigos_promocionais p
    where p.codigo=upper(regexp_replace(trim(p_dados->>'promo_codigo'),'\s+','-','g'));
  end if;

  return jsonb_build_object('id',novo.id,'status',novo.status,'valor_exibido',novo.valor_exibido,'created_at',novo.created_at);
end;
$$;

create or replace function public.oricse_plano_permite(p_clinica_id uuid,p_codigo text)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select (select auth.uid()) is not null
    and (
      public.oricse_is_platform_admin()
      or (
        public.oricse_usuario_na_clinica(p_clinica_id)
        and public.oricse_acesso_administrativo_liberado(p_clinica_id)
        and public.oricse_clinica_tem_funcionalidade(p_clinica_id,p_codigo)
      )
    );
$$;

create or replace function public.oricse_usuario_pode_permissao(p_clinica_id uuid,p_codigo text)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select public.oricse_is_platform_admin()
    or (
      public.oricse_acesso_administrativo_liberado(p_clinica_id)
      and exists (
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
            (select pu.permitido from public.oricse_permissoes_usuario pu
             where pu.clinica_id=p_clinica_id and pu.user_id=(select auth.uid())
               and pu.permissao_codigo=p_codigo),
            (select pp.permitido from public.oricse_permissoes_papel pp
             where pp.papel=cu.papel and pp.permissao_codigo=p_codigo),
            false
          )
      )
    );
$$;

drop function if exists public.oricse_portal_agendas();

create function public.oricse_portal_agendas()
returns table(
  id uuid,nome text,responsavel text,inicio time,fim time,dias_semana integer[],
  intervalo_min integer,modalidade text,antecedencia_horas integer,timezone text,tipo text,cor text,
  pagamento_modo_valor text,pagamento_valor numeric,pagamento_descricao text
)
language sql
stable
security definer
set search_path=''
as $$
  with ident as (select * from public.oricse_portal_identidade_atual())
  select a.id,a.nome,a.responsavel,a.inicio,a.fim,a.dias_semana,a.intervalo_min,a.modalidade,
    a.antecedencia_horas,a.timezone,a.tipo,a.cor,a.pagamento_modo_valor,a.pagamento_valor,a.pagamento_descricao
  from public.oricse_agendas_online a,ident i
  where a.clinica_id=i.clinica_id and a.portal_ativo=true
    and public.oricse_clinica_tem_funcionalidade(i.clinica_id,'portal_tutor.agendamento_online')
  order by a.nome;
$$;

create or replace function public.oricse_portal_reservar_pagamento_agenda(
  p_agenda_id uuid,p_animal_id uuid,p_inicio timestamptz,p_observacoes text default null
)
returns table(agendamento_id uuid,valor_centavos integer,descricao text)
language plpgsql
security definer
set search_path=''
as $$
declare
  a public.oricse_agendas_online;
  i record;
  an public.oricse_animais;
  v_local timestamp;
  v_fim timestamptz;
  v_id uuid;
  v_minutos integer;
  v_valor integer;
begin
  select * into i from public.oricse_portal_identidade_atual();
  if i.clinica_id is null then raise exception 'Acesso de tutor inválido.' using errcode='42501'; end if;
  select * into a from public.oricse_agendas_online
    where id=p_agenda_id and clinica_id=i.clinica_id and portal_ativo=true for share;
  if not found or a.modalidade <> 'pagamento' then raise exception 'Esta agenda não exige pagamento online.' using errcode='22023'; end if;
  if not public.oricse_clinica_tem_funcionalidade(i.clinica_id,'portal_tutor.agendamento_online') then
    raise exception 'Agendamento online indisponível no plano atual.' using errcode='42501';
  end if;
  if coalesce(a.pagamento_valor,0) <= 0 then raise exception 'A clínica ainda não configurou o valor deste agendamento.' using errcode='22023'; end if;
  select * into an from public.oricse_animais
    where id=p_animal_id and clinica_id=i.clinica_id and tutor_id=i.tutor_id;
  if not found then raise exception 'Animal não pertence a este tutor.' using errcode='42501'; end if;
  v_local:=p_inicio at time zone a.timezone;
  if extract(dow from v_local)::integer <> all(a.dias_semana)
    or v_local::time<a.inicio
    or (v_local::time+make_interval(mins=>a.intervalo_min))>a.fim then
    raise exception 'Horário fora da agenda.' using errcode='22023';
  end if;
  v_minutos:=extract(epoch from (v_local::time-a.inicio))/60;
  if mod(v_minutos,a.intervalo_min)<>0 or p_inicio<now()+make_interval(hours=>a.antecedencia_horas) then
    raise exception 'Horário indisponível.' using errcode='22023';
  end if;
  v_fim:=p_inicio+make_interval(mins=>a.intervalo_min);
  v_valor:=round(a.pagamento_valor*100)::integer;
  insert into public.oricse_agendamentos_online(
    clinica_id,agenda_id,tutor_auth_id,tutor_id,animal_id,animal_referencia,inicio,fim,estado,tipo,
    observacoes,origem,dados,pagamento_expira_em,pagamento_valor_centavos
  ) values (
    i.clinica_id,a.id,(select auth.uid()),i.tutor_id,an.id,an.nome,p_inicio,v_fim,'aguardando_pagamento',
    a.tipo,left(coalesce(p_observacoes,''),1000),'portal_tutor',
    jsonb_build_object('status_clinico','Agendado','pagamento','Pendente','pagamento_origem','portal_tutor'),
    now()+interval '20 minutes',v_valor
  ) returning id into v_id;

  agendamento_id:=v_id;
  valor_centavos:=v_valor;
  descricao:=coalesce(nullif(a.pagamento_descricao,''),'Agendamento: '||a.nome);
  return next;
exception when exclusion_violation then
  raise exception 'Este horário acabou de ser ocupado. Escolha outro.' using errcode='23P01';
end;
$$;

create or replace function public.oricse_confirmar_pagamento_portal(
  p_pagamento_id uuid,p_mp_payment_id text,p_forma text,p_liquido_centavos integer default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  p public.oricse_pagamentos;
  a public.oricse_agendamentos_online;
  c public.oricse_portal_comandas;
  v_liquido integer;
  v_total_pago numeric;
  v_saldo numeric;
begin
  select * into p from public.oricse_pagamentos where id=p_pagamento_id for update;
  if not found then raise exception 'Pagamento não encontrado' using errcode='P0002'; end if;
  if p.status='aprovado' then return jsonb_build_object('ok',true,'duplicado',true); end if;

  v_liquido:=greatest(0,coalesce(p_liquido_centavos,p.bruto_centavos));

  update public.oricse_pagamentos
  set status='aprovado',mp_payment_id=p_mp_payment_id,
      recebido_clinica_centavos=v_liquido,updated_at=now()
  where id=p.id;

  if p.tipo='agenda_portal' then
    select * into a from public.oricse_agendamentos_online where id=p.origem_id for update;
    if found then
      update public.oricse_agendamentos_online
      set estado='confirmado',pagamento_confirmado_em=now(),pagamento_id=p.id,pagamento_expira_em=null,
          dados=coalesce(dados,'{}'::jsonb)||jsonb_build_object('pagamento','Pago','pagamento_portal_id',p.id)
      where id=a.id;
    end if;
  elsif p.tipo='comanda_portal' then
    select * into c from public.oricse_portal_comandas where id=p.origem_id for update;
    if found then
      v_total_pago:=least(c.total,coalesce(c.total_pago,0)+(p.bruto_centavos::numeric/100));
      v_saldo:=greatest(0,c.total-v_total_pago);
      update public.oricse_portal_comandas
      set total_pago=v_total_pago,saldo=v_saldo,
          status=case when v_saldo<=0 then 'Finalizada' else c.status end,
          pagamentos=coalesce(c.pagamentos,'[]'::jsonb)||jsonb_build_array(
            jsonb_build_object('id',p.id,'valor',p.bruto_centavos::numeric/100,'formaPagamento',coalesce(p_forma,'Online'),'data',now())
          ),
          updated_at=now()
      where id=c.id;
    end if;
  end if;

  insert into public.oricse_caixa_lancamentos(
    clinica_id,setor,origem_tipo,origem_id,tipo,status,descricao,valor_centavos,forma_pagamento,registrado_em
  ) values (
    p.clinica_id,'Portal do Tutor','pagamento_portal',p.id,'entrada','confirmado',
    case when p.tipo='agenda_portal' then 'Agendamento pago no Portal do Tutor'
      else 'Comanda paga no Portal do Tutor' end,
    v_liquido,coalesce(p_forma,'online'),now()
  )
  on conflict do nothing;

  return jsonb_build_object('ok',true,'liquido_centavos',v_liquido);
end;
$$;

revoke all on function public.oricse_registrar_pagamento_assinatura(uuid,text,timestamptz) from public,anon,authenticated;
revoke all on function public.oricse_confirmar_pagamento_portal(uuid,text,text,integer) from public,anon,authenticated;
grant execute on function public.oricse_meu_status_assinatura() to authenticated;
grant execute on function public.oricse_portal_reservar_pagamento_agenda(uuid,uuid,timestamptz,text) to authenticated;
