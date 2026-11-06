-- OricStudio: isolamento de propriedade e limite de contas por licença.
-- Adiciona trava transacional para que conexões simultâneas não excedam a franquia.
begin;
create or replace function public.oricstudio_guardar_limite_contas()
returns trigger language plpgsql security invoker set search_path=''
as $$
declare limite integer;
declare total integer;
declare estado text;
declare expira timestamptz;
declare clinica_ativa boolean;
begin
  if tg_op='UPDATE' and new.clinica_id is distinct from old.clinica_id then
    raise exception 'Não é permitido transferir uma conta Instagram entre clínicas';
  end if;
  -- O ambiente institucional ORICSE não possui assinatura por clínica.
  if new.clinica_id is null then return new; end if;
  if new.status='desconectada' then return new; end if;
  -- Uma reconexão existente não consome outra conta; só a ativação de uma
  -- conta desconectada ou uma conexão inédita pode aumentar a franquia.
  if tg_op='UPDATE' and old.status<>'desconectada' then return new; end if;
  select l.quantidade_contas_contratadas,l.status,l.expira_em,
         (c.status='ativa' and c.excluido_em is null)
    into limite,estado,expira,clinica_ativa
  from public.oricstudio_licencas l join public.clinicas c on c.id=l.clinica_id
  where l.clinica_id=new.clinica_id for update of l;
  if not found or estado<>'ativo' or not clinica_ativa
     or (expira is not null and expira<=now()) then
    raise exception 'OricStudio indisponível: clínica ou licença inativa';
  end if;
  select count(*) into total from public.oricstudio_meta_contas a
    where a.clinica_id=new.clinica_id and a.status<>'desconectada'
      and a.id is distinct from new.id;
  if total>=greatest(limite,0) then
    raise exception 'Limite de contas do OricStudio atingido nesta clínica';
  end if;
  return new;
end $$;
revoke all on function public.oricstudio_guardar_limite_contas()
 from public,anon,authenticated;
drop trigger if exists oricstudio_guardar_limite_contas_trigger on public.oricstudio_meta_contas;
create trigger oricstudio_guardar_limite_contas_trigger
 before insert or update on public.oricstudio_meta_contas
 for each row execute function public.oricstudio_guardar_limite_contas();
commit;