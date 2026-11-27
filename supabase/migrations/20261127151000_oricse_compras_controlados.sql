-- Livro auxiliar de compras declaradas pela clínica. Nenhum saldo, movimento de
-- estoque ou lançamento financeiro é gerado; o produto não é classificado no catálogo.
begin;

create table public.oricse_compras_controlados (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete restrict,
  requisicao_id uuid not null,
  requisicao_hash bytea not null check (octet_length(requisicao_hash) = 32),
  data_compra date not null check (data_compra between date '2000-01-01' and date '2099-12-31'),
  produto_id uuid not null,
  produto_nome text not null check (char_length(btrim(produto_nome)) between 1 and 120),
  quantidade numeric check (
    quantidade is null or (
      quantidade > 0 and quantidade <= 999999999999.999 and quantidade = round(quantidade, 3)
    )
  ),
  fornecedor text check (fornecedor is null or char_length(btrim(fornecedor)) between 1 and 180),
  nota_fiscal text check (nota_fiscal is null or char_length(btrim(nota_fiscal)) between 1 and 100),
  lote text check (lote is null or char_length(btrim(lote)) between 1 and 100),
  autor_id uuid not null,
  autor_nome text not null check (char_length(btrim(autor_nome)) between 1 and 180),
  status text not null default 'pendente' check (status in ('pendente', 'completo')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  finalizado_em timestamptz,
  finalizado_por uuid,
  constraint oricse_compras_produto_da_clinica foreign key (clinica_id, produto_id)
    references public.oricse_catalogo_itens(clinica_id, id) on delete restrict,
  constraint oricse_compras_requisicao_unica unique (clinica_id, autor_id, requisicao_id),
  constraint oricse_compras_finalizacao_valida check (
    (status = 'pendente' and finalizado_em is null and finalizado_por is null)
    or (status = 'completo' and finalizado_em is not null and finalizado_por is not null
      and quantidade is not null and fornecedor is not null and nota_fiscal is not null and lote is not null)
  )
);

comment on table public.oricse_compras_controlados is
  'Registro declaratório interno de compras informadas pela clínica, independente de catálogo, estoque e financeiro.';
create index oricse_compras_controlados_clinica_data
  on public.oricse_compras_controlados (clinica_id, data_compra desc, id);
create index oricse_compras_controlados_pendencias
  on public.oricse_compras_controlados (clinica_id, data_compra desc, id) where status = 'pendente';
create index oricse_compras_controlados_produto
  on public.oricse_compras_controlados (clinica_id, produto_id);

-- O helper retorna somente o acesso da própria sessão e não é exposto no Data API.
create function oricse_private.pode_ler_compras_controlados(p_clinica_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1 from public.clinicas c
      join public.clinica_usuarios v on v.clinica_id = c.id
      where c.id = p_clinica_id and c.slug = 'vetericio' and c.status = 'ativa'
        and c.excluido_em is null and v.user_id = (select auth.uid()) and v.ativo
    )
    and public.oricse_usuario_pode_permissao(p_clinica_id, 'estoque.catalogo.visualizar');
$$;
revoke all on function oricse_private.pode_ler_compras_controlados(uuid) from public, anon, authenticated;
grant execute on function oricse_private.pode_ler_compras_controlados(uuid) to authenticated;

alter table public.oricse_compras_controlados enable row level security;
revoke all on table public.oricse_compras_controlados from public, anon, authenticated, service_role;
grant select (id, clinica_id, data_compra, produto_id, produto_nome, quantidade, fornecedor,
  nota_fiscal, lote, autor_nome, status)
  on table public.oricse_compras_controlados to authenticated;
create policy oricse_compras_controlados_leitura
  on public.oricse_compras_controlados for select to authenticated
  using (oricse_private.pode_ler_compras_controlados(clinica_id));

-- Defesa adicional contra gravação acidental por rotinas privilegiadas.
create function oricse_private.proteger_compra_controlada()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = '22023', message = 'O registro da compra não pode ser excluído.';
  end if;
  if old.status = 'completo'
    or (old.clinica_id, old.id, old.requisicao_id, old.requisicao_hash, old.autor_id, old.autor_nome, old.criado_em)
      is distinct from
       (new.clinica_id, new.id, new.requisicao_id, new.requisicao_hash, new.autor_id, new.autor_nome, new.criado_em) then
    raise exception using errcode = '22023', message = 'O registro finalizado ou sua autoria não pode ser alterado.';
  end if;
  return new;
end;
$$;
revoke all on function oricse_private.proteger_compra_controlada() from public, anon, authenticated;
create trigger oricse_proteger_compras_controlados
  before update or delete on public.oricse_compras_controlados
  for each row execute function oricse_private.proteger_compra_controlada();

-- Este é o único caminho de escrita. A identidade, permissão, clínica e
-- os nomes são resolvidos no servidor; o aplicativo não pode forjar autoria.
create function public.oricse_salvar_compra_controlada(
  p_clinica_id uuid, p_id uuid, p_requisicao_id uuid, p_data_compra date, p_produto_id uuid,
  p_quantidade numeric, p_fornecedor text, p_nota_fiscal text, p_lote text, p_finalizar boolean
) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  ator uuid := auth.uid();
  compra public.oricse_compras_controlados%rowtype;
  nome_produto text;
  nome_autor text;
  fornecedor_normalizado text := nullif(regexp_replace(p_fornecedor, '^[[:space:]]+|[[:space:]]+$', '', 'g'), '');
  nota_normalizada text := nullif(regexp_replace(p_nota_fiscal, '^[[:space:]]+|[[:space:]]+$', '', 'g'), '');
  lote_normalizado text := nullif(regexp_replace(p_lote, '^[[:space:]]+|[[:space:]]+$', '', 'g'), '');
  hash_entrada bytea;
  estado_igual boolean;
  estado text := case when p_finalizar then 'completo' else 'pendente' end;
begin
  if ator is null
    or oricse_private.pode_ler_compras_controlados(p_clinica_id) is not true
    or public.oricse_usuario_pode_permissao(p_clinica_id, 'estoque.movimentar') is not true
    or not exists (
      select 1 from auth.users u where u.id = ator
        and lower(coalesce(u.email, '')) <> 'alvorada@vetericio.local'
        and coalesce(u.raw_app_meta_data ->> 'oricse_demo_clinica', '') <> 'alvorada'
    )
  then
    raise exception using errcode = '42501', message = 'Seu acesso não permite registrar compras nesta clínica.';
  end if;
  if p_data_compra is null or p_data_compra not between date '2000-01-01' and date '2099-12-31'
    or p_produto_id is null or p_finalizar is null or (p_id is null and p_requisicao_id is null)
    or (p_quantidade is not null and (p_quantidade <= 0 or p_quantidade > 999999999999.999 or p_quantidade <> round(p_quantidade, 3)))
    or char_length(fornecedor_normalizado) > 180 or char_length(nota_normalizada) > 100
    or char_length(lote_normalizado) > 100
  then
    raise exception using errcode = '22023', message = 'Revise a data, o produto e os dados da compra.';
  end if;
  if p_data_compra > (now() at time zone 'America/Sao_Paulo')::date then
    raise exception using errcode = '22023', message = 'A data da compra não pode estar no futuro.';
  end if;
  if p_finalizar and (
    p_quantidade is null or fornecedor_normalizado is null or nota_normalizada is null or lote_normalizado is null
  ) then
    raise exception using errcode = '22023', message = 'Informe quantidade, fornecedor, nota fiscal e lote para finalizar.';
  end if;

  if p_id is not null then
    select * into compra from public.oricse_compras_controlados
      where id = p_id and clinica_id = p_clinica_id for update;
    if not found then
      raise exception using errcode = 'P0002', message = 'Compra não encontrada nesta clínica.';
    end if;
  else
    hash_entrada := sha256(convert_to(jsonb_build_array(
      p_data_compra, p_produto_id, trim_scale(p_quantidade), fornecedor_normalizado,
      nota_normalizada, lote_normalizado, p_finalizar
    )::text, 'UTF8'));
    -- O lock torna a primeira gravação e as reentregas concorrentes atômicas.
    perform pg_advisory_xact_lock(hashtextextended(
      'oricse-compras-controlados:' || p_clinica_id::text || ':' || ator::text || ':' || p_requisicao_id::text, 0));
    select * into compra from public.oricse_compras_controlados
      where clinica_id = p_clinica_id and autor_id = ator and requisicao_id = p_requisicao_id for update;
    if found and compra.requisicao_hash <> hash_entrada then
      raise exception using errcode = '22023', message = 'A tentativa anterior já registrou a compra. Atualize a lista antes de editar.';
    end if;
  end if;

  estado_igual := (compra.data_compra, compra.produto_id, compra.quantidade, compra.fornecedor, compra.nota_fiscal, compra.lote, compra.status)
    is not distinct from
    (p_data_compra, p_produto_id, p_quantidade, fornecedor_normalizado, nota_normalizada, lote_normalizado, estado);
  if p_id is not null and compra.status = 'completo' and not estado_igual then
    raise exception using errcode = '22023', message = 'Uma compra finalizada não pode ser alterada.';
  end if;

  -- Reentregas de criação não sobrescrevem alterações posteriores ao primeiro registro.
  if compra.id is null or (p_id is not null and compra.status = 'pendente' and not estado_igual) then
    -- Um rascunho pode usar seu próprio produto se ele foi arquivado depois.
    select i.nome into nome_produto from public.oricse_catalogo_itens i
      where i.clinica_id = p_clinica_id and i.id = p_produto_id and i.tipo = 'produto'
        and (i.ativo or i.id = compra.produto_id)
      for share;
    if not found then
      raise exception using errcode = 'P0002', message = 'Selecione um produto ativo do catálogo desta clínica.';
    end if;

    if compra.id is null then
      select nullif(btrim(nome_completo), '') into nome_autor
        from public.oricse_pessoas where user_id = ator;
      if nome_autor is null then
        select nullif(btrim(username), '') into nome_autor
          from public.app_users where user_id = ator and position('@' in username) = 0;
      end if;
      insert into public.oricse_compras_controlados (
        clinica_id, requisicao_id, requisicao_hash, data_compra, produto_id, produto_nome, quantidade, fornecedor,
        nota_fiscal, lote, autor_id, autor_nome, status, finalizado_em, finalizado_por
      ) values (
        p_clinica_id, p_requisicao_id, hash_entrada, p_data_compra, p_produto_id, nome_produto, p_quantidade,
        fornecedor_normalizado, nota_normalizada, lote_normalizado, ator,
        left(coalesce(nome_autor, 'Usuário sem nome no perfil'), 180), estado,
        case when p_finalizar then now() end, case when p_finalizar then ator end
      ) returning * into compra;
    else
      update public.oricse_compras_controlados
        set data_compra = p_data_compra, produto_id = p_produto_id,
            produto_nome = case when compra.produto_id = p_produto_id then compra.produto_nome else nome_produto end,
            quantidade = p_quantidade, fornecedor = fornecedor_normalizado,
            nota_fiscal = nota_normalizada, lote = lote_normalizado, status = estado,
            atualizado_em = now(), finalizado_em = case when p_finalizar then now() end,
            finalizado_por = case when p_finalizar then ator end
        where id = compra.id and clinica_id = p_clinica_id
        returning * into compra;
    end if;
  end if;

  return jsonb_build_object(
    'id', compra.id, 'data_compra', compra.data_compra, 'produto_id', compra.produto_id,
    'produto_nome', compra.produto_nome, 'quantidade', compra.quantidade, 'fornecedor', compra.fornecedor,
    'nota_fiscal', compra.nota_fiscal, 'lote', compra.lote, 'autor_nome', compra.autor_nome, 'status', compra.status
  );
end;
$$;
revoke all on function public.oricse_salvar_compra_controlada(uuid, uuid, uuid, date, uuid, numeric, text, text, text, boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.oricse_salvar_compra_controlada(uuid, uuid, uuid, date, uuid, numeric, text, text, text, boolean)
  to authenticated;

commit;
