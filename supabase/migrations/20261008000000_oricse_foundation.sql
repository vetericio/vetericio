create table if not exists public.app_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text,
  email text,
  role text not null default 'user',
  created_at timestamptz not null default now()
);

create unique index if not exists app_users_username_lower_idx
  on public.app_users (lower(username))
  where username is not null and btrim(username) <> '';

create table if not exists public.oricse_planos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nome text not null,
  publico_alvo text not null default '',
  preco text not null default '',
  preco_mensal text not null default '',
  preco_anual text not null default '',
  descricao text not null default '',
  itens jsonb not null default '[]'::jsonb,
  usuarios_inclusos integer not null default 1 check (usuarios_inclusos > 0),
  dominio_incluso boolean not null default false,
  ativo boolean not null default true,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.oricse_config (
  chave text primary key,
  valor jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.oricse_contratacoes (
  id uuid primary key default gen_random_uuid(),
  plano_codigo text not null,
  plano_nome text not null,
  ciclo text not null check (ciclo in ('mensal', 'anual', 'teste')),
  status text not null,
  clinica_nome text not null,
  razao_social text,
  cnpj text,
  documento_teste text,
  clinica_telefone text,
  clinica_email text,
  clinica_cep text,
  clinica_endereco text,
  clinica_numero text,
  clinica_complemento text,
  clinica_bairro text,
  clinica_cidade text,
  clinica_uf text,
  tipo_operacao text,
  slug_desejado text,
  dominio text,
  quantidade_usuarios integer not null default 1,
  perfis_inclusos integer not null default 1,
  perfis_extras integer not null default 0,
  adicional_perfis_mensal numeric(12,2) not null default 0,
  adicional_perfis_ciclo numeric(12,2) not null default 0,
  valor_base numeric(12,2) not null default 0,
  valor_total numeric(12,2) not null default 0,
  valor_exibido text,
  responsavel_nome text not null,
  responsavel_cpf text,
  responsavel_crmv text,
  responsavel_crmv_uf text,
  responsavel_email text not null,
  responsavel_telefone text,
  responsavel_cep text,
  responsavel_endereco text,
  responsavel_numero text,
  responsavel_complemento text,
  responsavel_bairro text,
  responsavel_cidade text,
  responsavel_uf text,
  observacoes text,
  aceitou_termos boolean not null default false,
  aceitou_privacidade boolean not null default false,
  promo_codigo text,
  promo_valor_original numeric(12,2),
  promo_desconto numeric(12,2),
  promo_valor_final numeric(12,2),
  promo_duracao text,
  pagamento_provedor text,
  pagamento_id text,
  pagamento_aprovado_em timestamptz,
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  dados jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists oricse_contratacoes_documento_teste_idx
  on public.oricse_contratacoes (documento_teste)
  where ciclo = 'teste' and documento_teste is not null;
create index if not exists oricse_contratacoes_status_created_idx
  on public.oricse_contratacoes (status, created_at desc);

create table if not exists public.oricse_codigos_promocionais (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  tipo_desconto text not null check (tipo_desconto in ('percentual', 'fixo')),
  valor numeric(12,2) not null check (valor >= 0),
  planos text[] not null default '{}',
  valido_de timestamptz,
  valido_ate timestamptz,
  limite_usos integer check (limite_usos is null or limite_usos > 0),
  limite_por_documento integer check (limite_por_documento is null or limite_por_documento > 0),
  ativo boolean not null default true,
  somente_primeira_assinatura boolean not null default false,
  duracao text not null default 'primeiro_mes'
    check (duracao in ('primeiro_mes', 'recorrente')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (tipo_desconto <> 'percentual' or valor <= 100),
  check (valido_ate is null or valido_de is null or valido_ate >= valido_de)
);

create table if not exists public.oricse_codigo_promocional_usos (
  id uuid primary key default gen_random_uuid(),
  codigo_id uuid not null references public.oricse_codigos_promocionais(id) on delete cascade,
  contratacao_id uuid references public.oricse_contratacoes(id) on delete set null,
  documento_normalizado text,
  created_at timestamptz not null default now()
);

create index if not exists oricse_codigo_promocional_usos_codigo_idx
  on public.oricse_codigo_promocional_usos (codigo_id, created_at desc);
create index if not exists oricse_codigo_promocional_usos_documento_idx
  on public.oricse_codigo_promocional_usos (codigo_id, documento_normalizado)
  where documento_normalizado is not null;

alter table public.app_users enable row level security;
alter table public.oricse_planos enable row level security;
alter table public.oricse_config enable row level security;
alter table public.oricse_contratacoes enable row level security;
alter table public.oricse_codigos_promocionais enable row level security;
alter table public.oricse_codigo_promocional_usos enable row level security;

create or replace function public.oricse_is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.app_users au
    where au.user_id = (select auth.uid())
      and au.role = 'admin'
  )
$$;

revoke all on function public.oricse_is_platform_admin() from public, anon;
grant execute on function public.oricse_is_platform_admin() to authenticated;

drop policy if exists app_users_select_self_or_admin on public.app_users;
create policy app_users_select_self_or_admin
  on public.app_users for select to authenticated
  using (user_id = (select auth.uid()) or public.oricse_is_platform_admin());

drop policy if exists oricse_config_public_site_read on public.oricse_config;
create policy oricse_config_public_site_read
  on public.oricse_config for select to anon, authenticated
  using (chave = 'site_publico' or public.oricse_is_platform_admin());

drop policy if exists oricse_config_admin_write on public.oricse_config;
create policy oricse_config_admin_write
  on public.oricse_config for all to authenticated
  using (public.oricse_is_platform_admin())
  with check (public.oricse_is_platform_admin());

drop policy if exists oricse_contratacoes_admin_read on public.oricse_contratacoes;
create policy oricse_contratacoes_admin_read
  on public.oricse_contratacoes for select to authenticated
  using (public.oricse_is_platform_admin());

drop policy if exists oricse_contratacoes_admin_update on public.oricse_contratacoes;
create policy oricse_contratacoes_admin_update
  on public.oricse_contratacoes for update to authenticated
  using (public.oricse_is_platform_admin())
  with check (public.oricse_is_platform_admin());

drop policy if exists oricse_codigos_promocionais_admin_all on public.oricse_codigos_promocionais;
create policy oricse_codigos_promocionais_admin_all
  on public.oricse_codigos_promocionais for all to authenticated
  using (public.oricse_is_platform_admin())
  with check (public.oricse_is_platform_admin());

drop policy if exists oricse_codigo_promocional_usos_admin_read on public.oricse_codigo_promocional_usos;
create policy oricse_codigo_promocional_usos_admin_read
  on public.oricse_codigo_promocional_usos for select to authenticated
  using (public.oricse_is_platform_admin());

grant select on public.app_users to authenticated;
grant select, insert, update, delete on public.oricse_planos to authenticated;
grant select on public.oricse_planos to anon;
grant select, insert, update, delete on public.oricse_config to anon, authenticated;
grant select, update on public.oricse_contratacoes to authenticated;
grant select, insert, update, delete on public.oricse_codigos_promocionais to authenticated;
grant select on public.oricse_codigo_promocional_usos to authenticated;

create or replace function public.oricse_numero_seguro(valor text)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
begin
  if coalesce(valor, '') !~ '^[0-9]+([.][0-9]+)?$' then
    return 0;
  end if;
  return least(valor::numeric, 9999999999.99);
exception when numeric_value_out_of_range then
  return 0;
end;
$$;

create or replace function public.oricse_iniciar_contratacao(p_dados jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  novo public.oricse_contratacoes;
  plano public.oricse_planos;
  valor_total numeric(12,2);
  numero_usuarios integer;
  perfis_inclusos integer;
  perfis_extras integer;
begin
  if jsonb_typeof(p_dados) is distinct from 'object'
     or p_dados->>'aceitou_termos' is distinct from 'true'
     or p_dados->>'aceitou_privacidade' is distinct from 'true' then
    raise exception 'Revise os dados e aceite os termos e a política de privacidade.'
      using errcode = '22023';
  end if;

  if coalesce(btrim(p_dados->>'clinica_nome'), '') = ''
     or coalesce(btrim(p_dados->>'responsavel_nome'), '') = ''
     or coalesce(btrim(p_dados->>'responsavel_email'), '') = '' then
    raise exception 'Informe o nome da clínica e os dados do responsável.'
      using errcode = '22023';
  end if;

  if p_dados->>'ciclo' is null or p_dados->>'ciclo' not in ('mensal', 'anual') then
    raise exception 'Ciclo de contratação inválido.'
      using errcode = '22023';
  end if;

  select * into plano
  from public.oricse_planos p
  where p.codigo = nullif(btrim(p_dados->>'plano_codigo'), '')
    and p.ativo;
  if not found then
    raise exception 'O plano selecionado não está disponível.'
      using errcode = '22023';
  end if;

  valor_total := public.oricse_numero_seguro(p_dados->>'valor_total');
  numero_usuarios := greatest(1, least(10000, public.oricse_numero_seguro(p_dados->>'quantidade_usuarios'))::integer);
  perfis_inclusos := greatest(1, least(10000, public.oricse_numero_seguro(p_dados->>'perfis_inclusos'))::integer);
  perfis_extras := greatest(0, least(10000, public.oricse_numero_seguro(p_dados->>'perfis_extras'))::integer);

  insert into public.oricse_contratacoes (
    plano_codigo, plano_nome, ciclo, status, clinica_nome, razao_social,
    cnpj, clinica_telefone, clinica_email, clinica_cep, clinica_endereco,
    clinica_numero, clinica_complemento, clinica_bairro, clinica_cidade,
    clinica_uf, tipo_operacao, slug_desejado, dominio, quantidade_usuarios,
    perfis_inclusos, perfis_extras, adicional_perfis_mensal,
    adicional_perfis_ciclo, valor_base, valor_total, valor_exibido,
    responsavel_nome, responsavel_cpf, responsavel_crmv, responsavel_crmv_uf,
    responsavel_email, responsavel_telefone, responsavel_cep,
    responsavel_endereco, responsavel_numero, responsavel_complemento,
    responsavel_bairro, responsavel_cidade, responsavel_uf, observacoes,
    aceitou_termos, aceitou_privacidade, promo_codigo, promo_valor_original,
    promo_desconto, promo_valor_final, promo_duracao, dados
  )
  values (
    plano.codigo,
    plano.nome,
    p_dados->>'ciclo', 'aguardando_pagamento',
    btrim(p_dados->>'clinica_nome'), nullif(btrim(p_dados->>'razao_social'), ''),
    nullif(regexp_replace(coalesce(p_dados->>'cnpj', ''), '\D', '', 'g'), ''),
    nullif(btrim(p_dados->>'clinica_telefone'), ''),
    nullif(btrim(p_dados->>'clinica_email'), ''),
    nullif(btrim(p_dados->>'clinica_cep'), ''),
    nullif(btrim(p_dados->>'clinica_endereco'), ''),
    nullif(btrim(p_dados->>'clinica_numero'), ''),
    nullif(btrim(p_dados->>'clinica_complemento'), ''),
    nullif(btrim(p_dados->>'clinica_bairro'), ''),
    nullif(btrim(p_dados->>'clinica_cidade'), ''),
    nullif(btrim(p_dados->>'clinica_uf'), ''),
    nullif(btrim(p_dados->>'tipo_operacao'), ''),
    nullif(btrim(p_dados->>'slug_desejado'), ''),
    nullif(btrim(p_dados->>'dominio'), ''),
    numero_usuarios,
    perfis_inclusos,
    perfis_extras,
    public.oricse_numero_seguro(p_dados->>'adicional_perfis_mensal'),
    public.oricse_numero_seguro(p_dados->>'adicional_perfis_ciclo'),
    public.oricse_numero_seguro(p_dados->>'valor_base'),
    valor_total,
    'R$ ' || replace(to_char(valor_total, 'FM999999999990.00'), '.', ','),
    btrim(p_dados->>'responsavel_nome'),
    nullif(regexp_replace(coalesce(p_dados->>'responsavel_cpf', ''), '\D', '', 'g'), ''),
    nullif(btrim(p_dados->>'responsavel_crmv'), ''),
    nullif(btrim(p_dados->>'responsavel_crmv_uf'), ''),
    lower(btrim(p_dados->>'responsavel_email')),
    nullif(btrim(p_dados->>'responsavel_telefone'), ''),
    nullif(btrim(p_dados->>'responsavel_cep'), ''),
    nullif(btrim(p_dados->>'responsavel_endereco'), ''),
    nullif(btrim(p_dados->>'responsavel_numero'), ''),
    nullif(btrim(p_dados->>'responsavel_complemento'), ''),
    nullif(btrim(p_dados->>'responsavel_bairro'), ''),
    nullif(btrim(p_dados->>'responsavel_cidade'), ''),
    nullif(btrim(p_dados->>'responsavel_uf'), ''),
    nullif(btrim(p_dados->>'observacoes'), ''),
    true, true,
    nullif(btrim(p_dados->>'promo_codigo'), ''),
    nullif(public.oricse_numero_seguro(p_dados->>'promo_valor_original'), 0),
    nullif(public.oricse_numero_seguro(p_dados->>'promo_desconto'), 0),
    nullif(public.oricse_numero_seguro(p_dados->>'promo_valor_final'), 0),
    nullif(btrim(p_dados->>'promo_duracao'), ''),
    p_dados
  )
  returning * into novo;

  return jsonb_build_object(
    'id', novo.id,
    'status', novo.status,
    'valor_exibido', novo.valor_exibido,
    'created_at', novo.created_at
  );
end;
$$;

create or replace function public.oricse_iniciar_teste_gratis(p_dados jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  novo public.oricse_contratacoes;
  documento text;
begin
  if jsonb_typeof(p_dados) is distinct from 'object'
     or p_dados->>'aceitou_termos' is distinct from 'true'
     or p_dados->>'aceitou_privacidade' is distinct from 'true' then
    raise exception 'Revise os dados e aceite os termos e a política de privacidade.'
      using errcode = '22023';
  end if;

  documento := regexp_replace(
    coalesce(nullif(p_dados->>'cnpj', ''), p_dados->>'responsavel_cpf', ''),
    '\D', '', 'g'
  );
  if length(documento) not in (11, 14) then
    raise exception 'Informe um CPF ou CNPJ válido para solicitar o teste.'
      using errcode = '22023';
  end if;
  if coalesce(btrim(p_dados->>'clinica_nome'), '') = ''
     or coalesce(btrim(p_dados->>'responsavel_nome'), '') = ''
     or coalesce(btrim(p_dados->>'responsavel_email'), '') = '' then
    raise exception 'Informe o nome da clínica e os dados do responsável.'
      using errcode = '22023';
  end if;

  insert into public.oricse_contratacoes (
    plano_codigo, plano_nome, ciclo, status, clinica_nome, cnpj,
    documento_teste, clinica_telefone, clinica_email, clinica_cep,
    clinica_endereco, clinica_numero, clinica_complemento, clinica_bairro,
    clinica_cidade, clinica_uf, tipo_operacao, slug_desejado, dominio,
    responsavel_nome, responsavel_cpf, responsavel_crmv, responsavel_crmv_uf,
    responsavel_email, responsavel_telefone, responsavel_cep,
    responsavel_endereco, responsavel_numero, responsavel_complemento,
    responsavel_bairro, responsavel_cidade, responsavel_uf, observacoes,
    aceitou_termos, aceitou_privacidade, dados
  )
  values (
    'teste-gratis', 'Teste grátis', 'teste', 'teste_aguardando_ativacao',
    btrim(p_dados->>'clinica_nome'),
    nullif(regexp_replace(coalesce(p_dados->>'cnpj', ''), '\D', '', 'g'), ''),
    documento,
    nullif(btrim(p_dados->>'clinica_telefone'), ''),
    nullif(btrim(p_dados->>'clinica_email'), ''),
    nullif(btrim(p_dados->>'clinica_cep'), ''),
    nullif(btrim(p_dados->>'clinica_endereco'), ''),
    nullif(btrim(p_dados->>'clinica_numero'), ''),
    nullif(btrim(p_dados->>'clinica_complemento'), ''),
    nullif(btrim(p_dados->>'clinica_bairro'), ''),
    nullif(btrim(p_dados->>'clinica_cidade'), ''),
    nullif(btrim(p_dados->>'clinica_uf'), ''),
    nullif(btrim(p_dados->>'tipo_operacao'), ''),
    nullif(btrim(p_dados->>'slug_desejado'), ''),
    nullif(btrim(p_dados->>'dominio'), ''),
    btrim(p_dados->>'responsavel_nome'),
    nullif(regexp_replace(coalesce(p_dados->>'responsavel_cpf', ''), '\D', '', 'g'), ''),
    nullif(btrim(p_dados->>'responsavel_crmv'), ''),
    nullif(btrim(p_dados->>'responsavel_crmv_uf'), ''),
    lower(btrim(p_dados->>'responsavel_email')),
    nullif(btrim(p_dados->>'responsavel_telefone'), ''),
    nullif(btrim(p_dados->>'responsavel_cep'), ''),
    nullif(btrim(p_dados->>'responsavel_endereco'), ''),
    nullif(btrim(p_dados->>'responsavel_numero'), ''),
    nullif(btrim(p_dados->>'responsavel_complemento'), ''),
    nullif(btrim(p_dados->>'responsavel_bairro'), ''),
    nullif(btrim(p_dados->>'responsavel_cidade'), ''),
    nullif(btrim(p_dados->>'responsavel_uf'), ''),
    nullif(btrim(p_dados->>'observacoes'), ''),
    true, true, p_dados
  )
  returning * into novo;

  return jsonb_build_object(
    'id', novo.id,
    'status', novo.status,
    'created_at', novo.created_at
  );
exception
  when unique_violation then
    raise exception 'Este CPF/CNPJ já foi usado para solicitar um teste gratuito.'
      using errcode = '23505';
end;
$$;

create or replace function public.oricse_validar_codigo_promocional(
  p_codigo text,
  p_plano_codigo text,
  p_documento text,
  p_valor_base numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  promo public.oricse_codigos_promocionais;
  documento text := regexp_replace(coalesce(p_documento, ''), '\D', '', 'g');
  usos_total bigint;
  usos_documento bigint;
  valor_base numeric(12,2) := greatest(0, coalesce(p_valor_base, 0));
  desconto numeric(12,2);
begin
  select * into promo
  from public.oricse_codigos_promocionais p
  where p.codigo = upper(regexp_replace(trim(coalesce(p_codigo, '')), '\s+', '-', 'g'))
    and p.ativo;

  if not found then
    return jsonb_build_object('valido', false, 'mensagem', 'Código promocional inválido ou inativo.');
  end if;
  if promo.valido_de is not null and promo.valido_de > now()
     or promo.valido_ate is not null and promo.valido_ate < now() then
    return jsonb_build_object('valido', false, 'mensagem', 'Este código promocional está fora do período de validade.');
  end if;
  if cardinality(promo.planos) > 0 and not (p_plano_codigo = any(promo.planos)) then
    return jsonb_build_object('valido', false, 'mensagem', 'Este código não é válido para o plano selecionado.');
  end if;

  select count(*) into usos_total
  from public.oricse_codigo_promocional_usos u
  where u.codigo_id = promo.id;
  if promo.limite_usos is not null and usos_total >= promo.limite_usos then
    return jsonb_build_object('valido', false, 'mensagem', 'Este código promocional atingiu o limite de usos.');
  end if;

  if documento <> '' then
    select count(*) into usos_documento
    from public.oricse_codigo_promocional_usos u
    where u.codigo_id = promo.id and u.documento_normalizado = documento;
    if promo.limite_por_documento is not null and usos_documento >= promo.limite_por_documento then
      return jsonb_build_object('valido', false, 'mensagem', 'Este documento já atingiu o limite de uso do código.');
    end if;
  end if;

  if promo.somente_primeira_assinatura and exists (
    select 1
    from public.oricse_contratacoes c
    where (
      documento <> ''
      and documento in (
        regexp_replace(coalesce(c.cnpj, ''), '\D', '', 'g'),
        regexp_replace(coalesce(c.responsavel_cpf, ''), '\D', '', 'g')
      )
    )
      and c.status not in ('cancelada', 'recusada')
  ) then
    return jsonb_build_object('valido', false, 'mensagem', 'Este código é válido somente para a primeira assinatura.');
  end if;

  desconto := case
    when promo.tipo_desconto = 'percentual' then round(valor_base * promo.valor / 100, 2)
    else least(valor_base, promo.valor)
  end;

  return jsonb_build_object(
    'valido', true,
    'codigo', promo.codigo,
    'valor_original', valor_base,
    'desconto_aplicado', desconto,
    'valor_final', greatest(0, valor_base - desconto),
    'duracao', promo.duracao
  );
end;
$$;

revoke all on function public.oricse_iniciar_contratacao(jsonb) from public;
revoke all on function public.oricse_iniciar_teste_gratis(jsonb) from public;
revoke all on function public.oricse_validar_codigo_promocional(text, text, text, numeric) from public;
grant execute on function public.oricse_iniciar_contratacao(jsonb) to anon, authenticated;
grant execute on function public.oricse_iniciar_teste_gratis(jsonb) to anon, authenticated;
grant execute on function public.oricse_validar_codigo_promocional(text, text, text, numeric) to anon, authenticated;

insert into public.oricse_planos (
  codigo, nome, publico_alvo, preco, preco_mensal, preco_anual, descricao,
  itens, usuarios_inclusos, dominio_incluso, ativo, ordem
)
values
  (
    'essencial', 'Essencial', 'Veterinários que atendem em domicílio',
    'R$ 49,90', 'R$ 49,90', 'R$ 499,00',
    'Bom para veterinários que atendem em domicílio',
    '["Cadastro de animais e tutores", "Anamnese e prontuários", "Receituário e PDFs clínicos"]'::jsonb,
    1, false, true, 1
  ),
  (
    'plus-clinica', 'Plus (Clínica)', 'Pet shops e clínicas',
    'R$ 99,90', 'R$ 99,90', 'R$ 999,00',
    'Bom para petshops e clínicas',
    '["Logo da sua clínica", "3 usuários inclusos", "Consultório e recepção", "Financeiro e caixa", "Serviços e estoque"]'::jsonb,
    3, false, true, 2
  ),
  (
    'master-equipe', 'Master (Equipe)', 'Equipes e clínicas',
    'R$ 199,90', 'R$ 199,90', 'R$ 1.999,00',
    'Para equipes e clínicas que precisam de um sistema sob medida',
    '["Tudo que o sistema oferece", "Personalização: ajustamos o sistema à sua necessidade", "www.suaclinica.com.br", "5 usuários inclusos"]'::jsonb,
    5, true, true, 3
  )
on conflict (codigo) do nothing;

insert into public.oricse_config (chave, valor)
values (
  'site_publico',
  '{"marca":"Oricse","titulo_planos":"Escolha o plano ideal para sua clínica","subtitulo_planos":"Organize atendimento, internação, prontuários, financeiro e estoque em um só sistema.","cta_plano":"Escolher plano","contato":"","logo_url":""}'::jsonb
)
on conflict (chave) do nothing;
