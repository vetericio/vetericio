-- OricStudio ORICSE: reforço final dos limites entre clínica, conteúdo e mídia.
-- Aditiva e idempotente; preserva registros existentes.
-- Tokens e OAuth continuam privados, clientes nunca recebem service_role.
begin;

create or replace function public.oricstudio_integridade_envio()
returns trigger language plpgsql security invoker set search_path=''
as $$
declare item jsonb;
declare midia_id uuid;
declare tipo_midia text;
declare ids uuid[] := array[]::uuid[];
declare original_clinica uuid;
declare original_tipo text;
declare quantidade integer;
begin
  if tg_op='UPDATE' and (
     new.clinica_id is distinct from old.clinica_id
     or new.publicacao_id is distinct from old.publicacao_id
     or new.conta_id is distinct from old.conta_id
     or new.idempotencia is distinct from old.idempotencia
   ) then
    raise exception 'OricStudio: propriedade do envio não pode ser modificada';
  end if;

  if tg_op='UPDATE' and old.iniciada_publicacao_em is not null
     and (new.midias is distinct from old.midias
       or new.legenda is distinct from old.legenda
       or new.formato is distinct from old.formato) then
    raise exception 'OricStudio: conteúdo imutável após início da publicação';
  end if;

  if new.midias is null or jsonb_typeof(new.midias)<>'array'
    then raise exception 'OricStudio: lista de mídias inválida'; end if;
  quantidade:=jsonb_array_length(new.midias);
  if quantidade<1 or quantidade>10 then
    raise exception 'OricStudio: o envio precisa de 1 a 10 mídias';
  end if;
  if (new.formato='carrossel' and quantidade<2)
     or (new.formato<>'carrossel' and quantidade<>1) then
    raise exception 'OricStudio: número de mídias incompatível com o formato';
  end if;

  for item in select value from jsonb_array_elements(new.midias) loop
    if jsonb_typeof(item)<>'object'
      or coalesce(item->>'id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or (item->>'tipo') not in ('imagem','video') then
      raise exception 'OricStudio: referência de mídia inválida';
    end if;
    midia_id:=(item->>'id')::uuid;
    if midia_id=any(ids) then raise exception 'OricStudio: mídia duplicada'; end if;
    ids:=array_append(ids,midia_id);

    if new.clinica_id is null then
      select m.tipo into tipo_midia
      from public.oricstudio_sistema_midias m where m.id=midia_id;
    else
      select m.tipo into tipo_midia
      from public.oricstudio_midias m
      where m.id=midia_id and m.clinica_id=new.clinica_id;
    end if;
    if tipo_midia is null or tipo_midia is distinct from item->>'tipo' then
      raise exception 'OricStudio: mídia não pertence ao ambiente informado';
    end if;
    if new.formato='imagem' and tipo_midia<>'imagem' then
      raise exception 'OricStudio: imagem obrigatória';
    end if;
    if new.formato='reels' and tipo_midia<>'video' then
      raise exception 'OricStudio: vídeo obrigatório para Reels';
    end if;
  end loop;

  if new.clinica_id is null then
    select null::uuid,p.tipo into original_clinica,original_tipo
    from public.oricstudio_sistema_publicacoes p where p.id=new.publicacao_id;
  else
    select p.clinica_id,p.tipo into original_clinica,original_tipo
    from public.oricstudio_publicacoes p where p.id=new.publicacao_id
      and p.clinica_id=new.clinica_id;
  end if;
  if not found or original_clinica is distinct from new.clinica_id
    or original_tipo is distinct from new.formato then
    raise exception 'OricStudio: publicação não corresponde ao ambiente/formato';
  end if;
  return new;
end $$;

revoke all on function public.oricstudio_integridade_envio()
  from public,anon,authenticated;

drop trigger if exists oricstudio_integridade_envio_trigger
  on public.oricstudio_envios;
create trigger oricstudio_integridade_envio_trigger
before insert or update on public.oricstudio_envios
for each row execute function public.oricstudio_integridade_envio();

-- A conta conectada nunca migra silenciosamente para outra clínica,
-- nem por upsert privilegiado. Transferências exigem desconectar e novo OAuth.
create or replace function public.oricstudio_integridade_conta()
returns trigger language plpgsql security invoker set search_path=''
as $$
begin
  if new.clinica_id is distinct from old.clinica_id
    or new.instagram_user_id is distinct from old.instagram_user_id then
    raise exception 'OricStudio: não é permitido transferir conta entre clínicas';
  end if;
  return new;
end $$;
revoke all on function public.oricstudio_integridade_conta()
  from public,anon,authenticated;
drop trigger if exists oricstudio_integridade_conta_trigger
  on public.oricstudio_meta_contas;
create trigger oricstudio_integridade_conta_trigger
before update on public.oricstudio_meta_contas
for each row execute function public.oricstudio_integridade_conta();

-- A linha de mídia, inclusive seu caminho privado, não pode trocar de dono.
create or replace function public.oricstudio_integridade_midia()
returns trigger language plpgsql security invoker set search_path=''
as $$
begin
  if new.clinica_id is distinct from old.clinica_id
    or new.caminho_privado is distinct from old.caminho_privado then
    raise exception 'OricStudio: biblioteca privada não pode mudar de clínica';
  end if;
  return new;
end $$;
revoke all on function public.oricstudio_integridade_midia()
 from public,anon,authenticated;
drop trigger if exists oricstudio_integridade_midia_trigger
 on public.oricstudio_midias;
create trigger oricstudio_integridade_midia_trigger before update on public.oricstudio_midias
for each row execute function public.oricstudio_integridade_midia();

-- Impedir a exclusão de publicação que já alimentou a fila (rastreabilidade).
create or replace function public.oricstudio_impedir_exclusao_agendada()
returns trigger language plpgsql security invoker set search_path=''
as $$
begin
  if exists(select 1 from public.oricstudio_envios e
            where e.publicacao_id=old.id
              and (e.clinica_id is not distinct from old.clinica_id)) then
    raise exception 'OricStudio: não exclua publicação com histórico de envio';
  end if;
  return old;
end $$;
revoke all on function public.oricstudio_impedir_exclusao_agendada()
  from public,anon,authenticated;
drop trigger if exists oricstudio_nao_apagar_post_enviado
 on public.oricstudio_publicacoes;
create trigger oricstudio_nao_apagar_post_enviado before delete
on public.oricstudio_publicacoes for each row
execute function public.oricstudio_impedir_exclusao_agendada();

-- O ambiente interno possui tabela diferente (sem clinica_id).
create or replace function public.oricstudio_impedir_exclusao_sistema()
returns trigger language plpgsql security invoker set search_path=''
as $$
begin
  if exists(select 1 from public.oricstudio_envios e
    where e.publicacao_id=old.id and e.clinica_id is null) then
    raise exception 'OricStudio: publicação interna com histórico de envio';
  end if;
  return old;
end $$;
revoke all on function public.oricstudio_impedir_exclusao_sistema()
 from public,anon,authenticated;
drop trigger if exists oricstudio_nao_apagar_post_sistema
  on public.oricstudio_sistema_publicacoes;
create trigger oricstudio_nao_apagar_post_sistema before delete
on public.oricstudio_sistema_publicacoes for each row
execute function public.oricstudio_impedir_exclusao_sistema();

create index if not exists oricstudio_envios_clinica_status_idx
 on public.oricstudio_envios(clinica_id,status,planejado_para);
create index if not exists oricstudio_midia_clinica_id_idx
 on public.oricstudio_midias(clinica_id,id);
create index if not exists oricstudio_conta_clinica_id_idx
 on public.oricstudio_meta_contas(clinica_id,id);

-- Não relaxar grants: exclusivamente o backend autorizado cria/edita fila,
-- relatórios, automações, tokens e conexões.
do $$
declare t text;
begin
 foreach t in array array[
  'oricstudio_envios','oricstudio_envio_eventos','oricstudio_insights',
  'oricstudio_comentarios','oricstudio_alertas','oricstudio_regras_automacao',
  'oricstudio_relatorios','oricstudio_meta_contas','oricstudio_meta_tokens',
  'oricstudio_meta_oauth_states','oricstudio_meta_auditoria'
 ] loop
  execute format('revoke insert,update,delete,truncate on public.%I from anon,authenticated',t);
 end loop;
end $$;

commit;
