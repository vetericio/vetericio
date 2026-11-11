-- Solicitações públicas de demonstração (gravadas apenas via função validada; leitura só para admin da plataforma)
create table if not exists public.oricse_solicitacoes_demonstracao (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  status text not null default 'novo' check (status in ('novo','em_contato','agendado','concluido','descartado')),
  nome text not null,
  negocio text not null,
  tipo_negocio text not null,
  cep text, logradouro text, numero text, complemento text, bairro text,
  cidade text not null, uf text not null,
  telefone text not null,
  email text not null,
  possui_sistema boolean not null,
  sistema_atual text,
  interesses text[] not null default '{}',
  mensagem text,
  consentimento_lgpd boolean not null,
  consentimento_em timestamptz not null default now()
);
revoke all on public.oricse_solicitacoes_demonstracao from public, anon, authenticated;
grant select, update on public.oricse_solicitacoes_demonstracao to authenticated;
grant all on public.oricse_solicitacoes_demonstracao to service_role;
alter table public.oricse_solicitacoes_demonstracao enable row level security;
drop policy if exists oricse_demo_admin_select on public.oricse_solicitacoes_demonstracao;
create policy oricse_demo_admin_select on public.oricse_solicitacoes_demonstracao
  for select to authenticated using (public.oricse_is_platform_admin());
drop policy if exists oricse_demo_admin_update on public.oricse_solicitacoes_demonstracao;
create policy oricse_demo_admin_update on public.oricse_solicitacoes_demonstracao
  for update to authenticated using (public.oricse_is_platform_admin()) with check (public.oricse_is_platform_admin());
create index if not exists oricse_demo_created_idx on public.oricse_solicitacoes_demonstracao (created_at desc);
create index if not exists oricse_demo_email_idx on public.oricse_solicitacoes_demonstracao (lower(email), created_at desc);

create or replace function public.oricse_solicitar_demonstracao(p jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_email text := lower(trim(coalesce(p->>'email','')));
  v_tel text := regexp_replace(coalesce(p->>'telefone',''), '\D', '', 'g');
  v_tipos text[] := array['Clínica veterinária','Hospital veterinário','Consultório veterinário','Pet shop','Banho e tosa','Hotelzinho/creche','Outro'];
  v_possui boolean := (p->>'possui_sistema')::boolean;
begin
  if coalesce(p->>'site','') <> '' then raise exception 'Solicitação inválida.'; end if;
  if p->>'consentimento' is distinct from 'true' then raise exception 'É necessário autorizar o contato.'; end if;
  if length(trim(coalesce(p->>'nome',''))) not between 3 and 120 then raise exception 'Informe o nome completo.'; end if;
  if length(trim(coalesce(p->>'negocio',''))) not between 2 and 150 then raise exception 'Informe o nome do negócio.'; end if;
  if not (coalesce(p->>'tipo_negocio','') = any(v_tipos)) then raise exception 'Tipo de negócio inválido.'; end if;
  if length(trim(coalesce(p->>'cidade',''))) not between 2 and 100 then raise exception 'Informe a cidade.'; end if;
  if coalesce(p->>'uf','') !~ '^[A-Za-z]{2}$' then raise exception 'UF inválida.'; end if;
  if length(v_tel) not between 10 and 13 then raise exception 'Telefone inválido.'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 255 then raise exception 'E-mail inválido.'; end if;
  if v_possui is null then raise exception 'Informe se já possui sistema.'; end if;
  if length(coalesce(p->>'mensagem','')) > 2000 then raise exception 'Mensagem muito longa.'; end if;
  if jsonb_typeof(coalesce(p->'interesses','[]'::jsonb)) <> 'array' then raise exception 'Seleção de interesses inválida.'; end if;
  if jsonb_array_length(coalesce(p->'interesses','[]'::jsonb)) > 8 then raise exception 'Selecione no máximo oito interesses.'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('oricse_demonstracao_global', 0));
  if (select count(*) from public.oricse_solicitacoes_demonstracao where (lower(email) = v_email or regexp_replace(telefone,'\D','','g') = v_tel) and created_at > now() - interval '1 hour') >= 3 then
    raise exception 'Recebemos suas solicitações recentes. Aguarde nosso contato.';
  end if;
  if (select count(*) from public.oricse_solicitacoes_demonstracao where created_at > now() - interval '10 minutes') >= 40 then
    raise exception 'Muitas solicitações no momento. Tente novamente em alguns minutos.';
  end if;
  insert into public.oricse_solicitacoes_demonstracao (nome, negocio, tipo_negocio, cep, logradouro, numero, complemento, bairro, cidade, uf, telefone, email, possui_sistema, sistema_atual, interesses, mensagem, consentimento_lgpd)
  values (trim(p->>'nome'), trim(p->>'negocio'), p->>'tipo_negocio', left(nullif(trim(p->>'cep'),''),9), left(nullif(trim(p->>'logradouro'),''),200), left(nullif(trim(p->>'numero'),''),20), left(nullif(trim(p->>'complemento'),''),100), left(nullif(trim(p->>'bairro'),''),100), trim(p->>'cidade'), upper(p->>'uf'), v_tel, v_email, v_possui,
    case when v_possui then left(nullif(trim(p->>'sistema_atual'),''),120) end,
    coalesce(array(select left(x,60) from jsonb_array_elements_text(coalesce(p->'interesses','[]'::jsonb)) x limit 8), '{}'),
    left(nullif(trim(p->>'mensagem'),''),2000), true)
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.oricse_solicitar_demonstracao(jsonb) from public;
grant execute on function public.oricse_solicitar_demonstracao(jsonb) to anon, authenticated;
