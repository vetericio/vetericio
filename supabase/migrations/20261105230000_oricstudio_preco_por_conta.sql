-- OricStúdio: licença base inclui uma conta Instagram; adicionais são cobrados por conta.
-- Preços ficam nulos até a decisão comercial. Nenhum pagamento é iniciado aqui.
alter table public.oricstudio_produto
  add column if not exists preco_conta_adicional_centavos integer
  check(preco_conta_adicional_centavos is null or preco_conta_adicional_centavos >= 0);

comment on column public.oricstudio_produto.preco_centavos is
  'Mensalidade base do OricStúdio, incluindo uma conta profissional Instagram. NULL = preço indefinido.';
comment on column public.oricstudio_produto.preco_conta_adicional_centavos is
  'Valor mensal por conta Instagram adicional à primeira, em centavos. NULL = preço indefinido.';

alter table public.oricstudio_licencas
  add column if not exists quantidade_contas_contratadas integer not null default 1
  check(quantidade_contas_contratadas between 1 and 100);

comment on column public.oricstudio_licencas.quantidade_contas_contratadas is
  'Cota total de contas incluindo a primeira; só tem efeito quando licença está ativa.';

create or replace function public.oricstudio_validar_cota_licenca()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare n integer;
begin
  -- Não remover cotas já ocupadas sem desconectar contas antes.
  if tg_op='UPDATE' and new.quantidade_contas_contratadas < old.quantidade_contas_contratadas then
    select count(*) into n from public.oricstudio_meta_contas
      where clinica_id=new.clinica_id and status in ('ativa','reautenticar','incompleta');
    if n > new.quantidade_contas_contratadas then
      raise exception 'A clínica possui % contas vinculadas e só pode reduzir a cota após desconectar as excedentes.',n;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.oricstudio_validar_cota_licenca() from public,anon,authenticated;
drop trigger if exists oricstudio_cota_licenca_trigger on public.oricstudio_licencas;
create trigger oricstudio_cota_licenca_trigger
before update on public.oricstudio_licencas
for each row execute function public.oricstudio_validar_cota_licenca();

create or replace function public.oricstudio_validar_cota_conta()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare limite integer;
declare ocupadas integer;
begin
  if new.status not in ('ativa','reautenticar','incompleta') then return new; end if;
  if tg_op='UPDATE' and new.clinica_id=old.clinica_id and old.status in ('ativa','reautenticar','incompleta') then
    return new;
  end if;
  -- Serializar inclusões por clínica: impede duas autorizações paralelas de superar a cota.
  perform pg_advisory_xact_lock(hashtextextended(new.clinica_id::text, 943128));
  select l.quantidade_contas_contratadas into limite
  from public.oricstudio_licencas l
  where l.clinica_id=new.clinica_id and l.status='ativo'
    and (l.expira_em is null or l.expira_em>now());
  if limite is null then raise exception 'OricStúdio não possui licença ativa para esta clínica'; end if;
  select count(*) into ocupadas from public.oricstudio_meta_contas m
  where m.clinica_id=new.clinica_id and m.status in ('ativa','reautenticar','incompleta')
    and m.id is distinct from new.id;
  if ocupadas >= limite then
    raise exception 'Limite de % contas Instagram atingido. Contrate mais uma conta no OricStúdio.',limite;
  end if;
  return new;
end;
$$;
revoke all on function public.oricstudio_validar_cota_conta() from public,anon,authenticated;
drop trigger if exists oricstudio_cota_conta_trigger on public.oricstudio_meta_contas;
create trigger oricstudio_cota_conta_trigger
before insert or update of clinica_id,status on public.oricstudio_meta_contas
for each row execute function public.oricstudio_validar_cota_conta();

-- Calculadora de exibição: só retorna cotação com os dois preços definidos.
create or replace function public.oricstudio_preco_mensal(p_quantidade_contas integer)
returns integer language sql stable security invoker set search_path = ''
as $$
  select case
    when p_quantidade_contas between 1 and 100
     and p.preco_centavos is not null
     and p.preco_conta_adicional_centavos is not null
    then p.preco_centavos + (p_quantidade_contas-1)*p.preco_conta_adicional_centavos
    else null
  end
  from public.oricstudio_produto p where p.codigo='oricstudio';
$$;
revoke all on function public.oricstudio_preco_mensal(integer) from public,anon;
grant execute on function public.oricstudio_preco_mensal(integer) to authenticated;
