-- OricStúdio etapa 4/5: propostas comerciais segregadas por clínica.
-- Não cria pagamentos nem ativa licenças: o status de cobrança depende de verificação posterior do Mercado Pago.

create table if not exists public.oricstudio_solicitacoes (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  solicitado_por uuid not null references auth.users(id),
  quantidade_contas integer not null check (quantidade_contas between 1 and 100),
  preco_base_centavos integer not null check (preco_base_centavos >= 0),
  preco_adicional_centavos integer not null check (preco_adicional_centavos >= 0),
  valor_mensal_centavos integer generated always as
    (preco_base_centavos + (quantidade_contas - 1) * preco_adicional_centavos) stored,
  status text not null default 'aguardando_checkout'
    check (status in ('aguardando_checkout','pagamento_pendente','pago','cancelado','expirado')),
  provedor text,
  referencia_pagamento text,
  pagamento_confirmado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists oricstudio_solicitacoes_clinica_idx
  on public.oricstudio_solicitacoes(clinica_id, criado_em desc);
create unique index if not exists oricstudio_solicitacao_unica_aberta
  on public.oricstudio_solicitacoes(clinica_id)
  where status in ('aguardando_checkout','pagamento_pendente');

alter table public.oricstudio_solicitacoes enable row level security;
revoke all on public.oricstudio_solicitacoes from anon,authenticated;
grant select on public.oricstudio_solicitacoes to authenticated;

create policy oricstudio_solicitacoes_admin_ou_clinica
on public.oricstudio_solicitacoes for select to authenticated
using (
  public.oricstudio_eh_admin() or
  exists (
    select 1 from public.clinica_usuarios cu
    where cu.user_id=(select auth.uid()) and cu.clinica_id=oricstudio_solicitacoes.clinica_id
      and cu.ativo=true and cu.papel in ('responsavel','admin_clinica','rt')
  )
);

create or replace function public.oricstudio_solicitar_contratacao(p_quantidade integer)
returns public.oricstudio_solicitacoes
language plpgsql security definer set search_path = ''
as $$
declare
  v_clinica uuid;
  v_usuario uuid;
  v_preco_base integer;
  v_preco_adicional integer;
  v_venda_ativa boolean;
  v_novo public.oricstudio_solicitacoes;
begin
  v_usuario := auth.uid();
  if v_usuario is null then raise exception 'Faça login para contratar'; end if;
  if p_quantidade is null or p_quantidade not between 1 and 100 then
    raise exception 'Quantidade de contas inválida';
  end if;
  v_clinica := public.oricse_clinica_ativa_obter();
  if v_clinica is null then raise exception 'Selecione uma clínica'; end if;
  if not exists(
    select 1 from public.clinica_usuarios cu
    where cu.user_id=v_usuario and cu.clinica_id=v_clinica
      and cu.ativo=true and cu.papel in ('responsavel','admin_clinica','rt')
  ) and not public.oricstudio_eh_admin() then
    raise exception 'Somente o responsável ou administrador da clínica pode solicitar a contratação';
  end if;
  if not exists(select 1 from public.clinicas c where c.id=v_clinica and c.status='ativa') then
    raise exception 'A clínica precisa estar ativa';
  end if;
  select preco_centavos,preco_conta_adicional_centavos,comercializacao_ativa
    into v_preco_base,v_preco_adicional,v_venda_ativa
    from public.oricstudio_produto where codigo='oricstudio';
  if not coalesce(v_venda_ativa,false) or v_preco_base is null or v_preco_adicional is null then
    raise exception 'A contratação do OricStúdio ainda não está disponível';
  end if;
  -- A seleção de clínica é a fonte de verdade e o preço vem exclusivamente da tabela administrativa.
  perform pg_advisory_xact_lock(hashtextextended(v_clinica::text,726913));
  if exists(
    select 1 from public.oricstudio_solicitacoes s
    where s.clinica_id=v_clinica and s.status in ('aguardando_checkout','pagamento_pendente')
  ) then
    raise exception 'Já existe uma contratação em andamento para esta clínica';
  end if;
  insert into public.oricstudio_solicitacoes (
    clinica_id,solicitado_por,quantidade_contas,preco_base_centavos,preco_adicional_centavos
  ) values (v_clinica,v_usuario,p_quantidade,v_preco_base,v_preco_adicional)
  returning * into v_novo;
  return v_novo;
end;
$$;
revoke all on function public.oricstudio_solicitar_contratacao(integer) from public,anon;
grant execute on function public.oricstudio_solicitar_contratacao(integer) to authenticated;

comment on table public.oricstudio_solicitacoes is
  'Propostas de contratação OricStúdio com preços congelados. Nunca representa pagamento aprovado.';

create or replace function public.oricstudio_catalogo_comercial()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'preco_base_centavos',p.preco_centavos,
    'preco_adicional_centavos',p.preco_conta_adicional_centavos,
    'comercializacao_ativa',p.comercializacao_ativa
  )
  from public.oricstudio_produto p
  where p.codigo='oricstudio'
    and auth.uid() is not null
    and exists(
      select 1 from public.clinicas c
      where c.id=public.oricse_clinica_ativa_obter()
        and (
          public.oricstudio_eh_admin() or
          exists(select 1 from public.clinica_usuarios cu
                 where cu.clinica_id=c.id and cu.user_id=(select auth.uid()) and cu.ativo=true)
        )
    );
$$;
revoke all on function public.oricstudio_catalogo_comercial() from public,anon;
grant execute on function public.oricstudio_catalogo_comercial() to authenticated;
