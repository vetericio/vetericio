-- ORICSE | Solicitacoes de demonstracao — isoladas de contratacoes e dados clinicos
create table if not exists public.oricse_demonstracao_pedidos (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  status text not null default 'novo'
    check (status in ('novo', 'em_contato', 'agendado', 'concluido', 'descartado')),
  nome text not null,
  negocio text not null,
  tipo_negocio text not null,
  endereco text not null,
  cidade text not null,
  uf text not null,
  telefone text not null,
  email text not null,
  possui_sistema boolean not null,
  sistema_atual text,
  interesses text[] not null default '{}',
  mensagem text,
  consentimento_lgpd_em timestamptz not null default now()
);
create index if not exists oricse_demonstracao_pedidos_created_idx
  on public.oricse_demonstracao_pedidos (created_at desc);
create index if not exists oricse_demonstracao_pedidos_email_idx
  on public.oricse_demonstracao_pedidos (lower(email), created_at desc);

alter table public.oricse_demonstracao_pedidos enable row level security;
revoke all on public.oricse_demonstracao_pedidos from public, anon, authenticated;
grant select, update on public.oricse_demonstracao_pedidos to authenticated;
grant all on public.oricse_demonstracao_pedidos to service_role;

create policy oricse_demonstracao_admin_leitura
  on public.oricse_demonstracao_pedidos for select to authenticated
  using ((select public.oricse_is_platform_admin()));
create policy oricse_demonstracao_admin_atualizacao
  on public.oricse_demonstracao_pedidos for update to authenticated
  using ((select public.oricse_is_platform_admin()))
  with check ((select public.oricse_is_platform_admin()));

-- Funcao publica deliberadamente limitada: somente cria pedidos validados.
-- Nenhum visitante pode consultar a tabela por essa funcao.
create or replace function public.oricse_enviar_pedido_demonstracao(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $func$
declare
  v_id uuid;
  v_nome text := btrim(coalesce(p->>'nome',''));
  v_negocio text := btrim(coalesce(p->>'negocio',''));
  v_tipo text := btrim(coalesce(p->>'tipo_negocio',''));
  v_endereco text := btrim(coalesce(p->>'endereco',''));
  v_cidade text := btrim(coalesce(p->>'cidade',''));
  v_uf text := upper(btrim(coalesce(p->>'uf','')));
  v_tel text := regexp_replace(coalesce(p->>'telefone',''), '[^0-9]', '', 'g');
  v_email text := lower(btrim(coalesce(p->>'email','')));
  v_possui boolean;
  v_interesses text[];
  v_msg text := btrim(coalesce(p->>'mensagem',''));
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    raise exception 'Solicitacao invalida.';
  end if;
  -- Campo oculto de robo: nao salvar nem confirmar pedidos automatizados.
  if coalesce(p->>'website','') <> '' then
    raise exception 'Solicitacao invalida.';
  end if;
  if p->>'consentimento' is distinct from 'true' then
    raise exception 'Autorize o contato para solicitar a demonstracao.';
  end if;
  if length(v_nome) not between 3 and 120 or length(v_negocio) not between 2 and 150 then
    raise exception 'Informe nome completo e nome do negocio.';
  end if;
  if v_tipo not in ('Clínica veterinária','Hospital veterinário','Consultório veterinário','Pet shop','Banho e tosa','Hotelzinho/creche','Outro') then
    raise exception 'Tipo de negocio invalido.';
  end if;
  if length(v_endereco) not between 5 and 240 or length(v_cidade) not between 2 and 100 or v_uf !~ '^[A-Z]{2}$' then
    raise exception 'Confira endereco, cidade e estado.';
  end if;
  if length(v_tel) not between 10 and 13 then
    raise exception 'Telefone invalido.';
  end if;
  if length(v_email) > 254 or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'E-mail invalido.';
  end if;
  if p->>'possui_sistema' not in ('true','false') then
    raise exception 'Informe se ja possui um sistema.';
  end if;
  v_possui := (p->>'possui_sistema')::boolean;
  if v_possui and length(btrim(coalesce(p->>'sistema_atual',''))) > 120 then
    raise exception 'Nome do sistema muito longo.';
  end if;
  if length(v_msg) > 2000 then raise exception 'Mensagem muito longa.'; end if;
  if jsonb_typeof(coalesce(p->'interesses', '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p->'interesses', '[]'::jsonb)) > 8 then
    raise exception 'Selecao de interesses invalida.';
  end if;
  select coalesce(array_agg(left(value, 70)), '{}'::text[])
    into v_interesses
    from jsonb_array_elements_text(coalesce(p->'interesses', '[]'::jsonb));
  -- Serializacao da verificacao evita corridas entre formularios simultaneos.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('oricse_demonstracao_global', 0));
  if (
    select count(*) from public.oricse_demonstracao_pedidos d
    where d.created_at > now() - interval '1 hour'
      and (lower(d.email) = v_email or d.telefone = v_tel)
  ) >= 3 then
    raise exception 'Ja recebemos suas solicitacoes recentes. Aguarde nosso contato.';
  end if;
  if (
    select count(*) from public.oricse_demonstracao_pedidos d
    where d.created_at > now() - interval '10 minutes'
  ) >= 40 then
    raise exception 'Muitas solicitacoes no momento. Tente novamente em alguns minutos.';
  end if;
  insert into public.oricse_demonstracao_pedidos
    (nome, negocio, tipo_negocio, endereco, cidade, uf, telefone, email,
     possui_sistema, sistema_atual, interesses, mensagem)
  values
    (v_nome, v_negocio, v_tipo, v_endereco, v_cidade, v_uf, v_tel, v_email,
     v_possui, case when v_possui then nullif(btrim(p->>'sistema_atual'),'') else null end,
     v_interesses, nullif(v_msg,''))
  returning id into v_id;
  return v_id;
end;
$func$;
revoke all on function public.oricse_enviar_pedido_demonstracao(jsonb) from public, anon, authenticated;
grant execute on function public.oricse_enviar_pedido_demonstracao(jsonb) to anon, authenticated;