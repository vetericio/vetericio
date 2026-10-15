-- Oricse Módulo 2: finalizar autorização por permissão no backend.

create or replace function public.oricse_pode_gerenciar_pagamentos(p_clinica uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.oricse_usuario_pode_permissao(p_clinica, 'equipe.pagamentos.gerenciar');
$$;

create or replace function public.oricse_pode_visualizar_pagamentos(p_clinica uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.oricse_usuario_pode_permissao(p_clinica, 'equipe.pagamentos.visualizar')
      or public.oricse_usuario_pode_permissao(p_clinica, 'equipe.pagamentos.gerenciar');
$$;

create or replace function public.oricse_pode_excluir_tutor(p_clinica_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.oricse_usuario_pode_permissao(p_clinica_id, 'recepcao.cadastros.excluir');
$$;

create or replace function public.oricse_pode_editar_configuracoes_clinica(p_clinica_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.oricse_usuario_pode_permissao(p_clinica_id, 'administracao.configuracoes');
$$;

create or replace function public.oricse_registrar_atividade(p_clinica uuid, p_acao text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_config public.oricse_jornada_config%rowtype;
  v_reg public.oricse_jornada_registros%rowtype;
  v_agora timestamptz := now();
  v_data date := (now() at time zone 'America/Sao_Paulo')::date;
  v_id uuid;
begin
  if (select auth.uid()) is null
     or not public.oricse_usuario_pode_permissao(p_clinica, 'atividade.ponto') then
    raise exception 'Sem permissão para registrar atividade nesta clínica' using errcode='42501';
  end if;

  select * into v_config
  from public.oricse_jornada_config
  where clinica_id=p_clinica and funcionario_id=(select auth.uid());
  if not found then raise exception 'Modalidade e valor ainda não configurados pelo responsável'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_clinica::text||(select auth.uid())::text,0));
  select * into v_reg
  from public.oricse_jornada_registros
  where clinica_id=p_clinica and funcionario_id=(select auth.uid()) and estado in ('ativa','pausada')
  for update;

  if p_acao='checkin' and v_config.modalidade='diaria' then
    insert into public.oricse_jornada_registros(clinica_id,funcionario_id,modalidade,data,valor_unitario,estado,finalizado_em)
    values(p_clinica,(select auth.uid()),'diaria',v_data,v_config.valor_unitario,'diaria',v_agora) returning id into v_id;
  elsif p_acao='iniciar' and v_config.modalidade='hora' and v_reg.id is null then
    insert into public.oricse_jornada_registros(clinica_id,funcionario_id,modalidade,data,valor_unitario,estado,ultimo_inicio_em)
    values(p_clinica,(select auth.uid()),'hora',v_data,v_config.valor_unitario,'ativa',v_agora) returning id into v_id;
  elsif p_acao='pausar' and v_reg.estado='ativa' then
    update public.oricse_jornada_registros
    set estado='pausada',segundos_trabalhados=segundos_trabalhados+greatest(0,floor(extract(epoch from(v_agora-ultimo_inicio_em)))::integer),ultimo_inicio_em=null
    where id=v_reg.id returning id into v_id;
  elsif p_acao='retomar' and v_reg.estado='pausada' then
    update public.oricse_jornada_registros set estado='ativa',ultimo_inicio_em=v_agora where id=v_reg.id returning id into v_id;
  elsif p_acao='finalizar' and v_reg.id is not null then
    update public.oricse_jornada_registros
    set estado='finalizada',finalizado_em=v_agora,
        segundos_trabalhados=segundos_trabalhados+case when v_reg.estado='ativa' then greatest(0,floor(extract(epoch from(v_agora-v_reg.ultimo_inicio_em)))::integer) else 0 end,
        ultimo_inicio_em=null
    where id=v_reg.id returning id into v_id;
  else
    raise exception 'Ação incompatível com a modalidade ou estado da atividade';
  end if;
  return v_id;
end;
$$;

create or replace function public.oricse_configurar_site_clinica(p_slug text, p_dominio text default null)
returns table (clinica_slug text, clinica_dominio text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  minha_clinica uuid;
  slug_normalizado text := lower(trim(both '/' from coalesce(p_slug, '')));
  dominio_normalizado text := nullif(lower(trim(coalesce(p_dominio, ''))), '');
begin
  select cu.clinica_id into minha_clinica
  from public.clinica_usuarios cu
  where cu.user_id=(select auth.uid()) and cu.ativo=true
  order by cu.created_at,cu.clinica_id limit 1;

  if minha_clinica is null or not public.oricse_usuario_pode_permissao(minha_clinica,'administracao.site') then
    raise exception 'Sem permissão para configurar o site da clínica.' using errcode='42501';
  end if;

  if slug_normalizado !~ '^[a-z0-9]+([a-z0-9-]{0,61}[a-z0-9])?$' then
    raise exception 'O link público deve conter apenas letras, números e hífens.' using errcode='22023';
  end if;

  if dominio_normalizado is not null then
    dominio_normalizado := regexp_replace(dominio_normalizado, '^https?://', '');
    dominio_normalizado := split_part(dominio_normalizado, '/', 1);
    if dominio_normalizado !~ '^[a-z0-9]([a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$' or dominio_normalizado ~ '\.\.' then
      raise exception 'Informe apenas o domínio, por exemplo clinica.com.br.' using errcode='22023';
    end if;
    if exists (
      select 1 from public.clinicas c
      where c.id<>minha_clinica
        and lower(regexp_replace(coalesce(c.dominio,''),'^www\.',''))=lower(regexp_replace(dominio_normalizado,'^www\.',''))
    ) then
      raise exception 'Este domínio já está vinculado a outra clínica.' using errcode='23505';
    end if;
  end if;

  if exists (select 1 from public.clinicas c where c.id<>minha_clinica and lower(coalesce(c.slug,''))=slug_normalizado) then
    raise exception 'Este link público já está em uso.' using errcode='23505';
  end if;

  update public.clinicas
  set slug=slug_normalizado,dominio=dominio_normalizado,updated_at=now()
  where id=minha_clinica;
  return query select slug_normalizado,dominio_normalizado;
end;
$$;

create or replace function public.set_my_clinic_agenda_settings(p_interval_minutes integer, p_durations jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  minha_clinica uuid;
  tipo text;
  duracao integer;
begin
  if p_interval_minutes is null or p_interval_minutes not between 5 and 720 or jsonb_typeof(p_durations) is distinct from 'object' then
    raise exception 'Configuração de agenda inválida.' using errcode='22023';
  end if;
  for tipo,duracao in select key,value::text::integer from jsonb_each(p_durations) loop
    if tipo not in ('Consulta','Retorno','Cirurgia','Banho e Tosa','Vacina','Procedimento') or duracao not between 5 and 720 then
      raise exception 'Informe durações entre 5 e 720 minutos para os tipos de atendimento válidos.' using errcode='22023';
    end if;
  end loop;
  if exists (
    select 1 from unnest(array['Consulta','Retorno','Cirurgia','Banho e Tosa','Vacina','Procedimento']) esperado(tipo)
    where not (p_durations ? esperado.tipo)
  ) then
    raise exception 'Informe a duração de todos os tipos de atendimento.' using errcode='22023';
  end if;

  select cu.clinica_id into minha_clinica
  from public.clinica_usuarios cu
  where cu.user_id=(select auth.uid()) and cu.ativo=true
  order by cu.created_at,cu.clinica_id limit 1;
  if minha_clinica is null or not (
    public.oricse_usuario_pode_permissao(minha_clinica,'recepcao.agenda')
    or public.oricse_usuario_pode_permissao(minha_clinica,'administracao.configuracoes')
  ) then
    raise exception 'Sem permissão para alterar as configurações da agenda.' using errcode='42501';
  end if;

  update public.clinicas
  set duracao_padrao_atendimento_min=p_interval_minutes,duracoes_atendimento_min=p_durations,updated_at=now()
  where id=minha_clinica;
end;
$$;

create or replace function public.oricse_movimentar_estoque(p_clinica_id uuid,p_item_id uuid,p_delta numeric)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  atual numeric;
  novo numeric;
begin
  if p_delta is null or p_delta=0 then
    raise exception 'A quantidade da movimentação deve ser diferente de zero.' using errcode='22023';
  end if;
  if not public.oricse_usuario_pode_permissao(p_clinica_id,'estoque.movimentar') then
    raise exception 'Sem permissão para movimentar estoque.' using errcode='42501';
  end if;

  select coalesce(i.estoque_atual,0) into atual
  from public.oricse_catalogo_itens i
  where i.id=p_item_id and i.clinica_id=p_clinica_id and i.tipo='produto' and i.ativo=true
  for update;
  if not found then raise exception 'Produto não encontrado nesta clínica.' using errcode='22023'; end if;
  novo := round((atual+p_delta)::numeric,3);
  if novo<0 then raise exception 'Saída maior que o estoque disponível.' using errcode='22023'; end if;

  update public.oricse_catalogo_itens set estoque_atual=novo,updated_at=now()
  where id=p_item_id and clinica_id=p_clinica_id;
  return novo;
end;
$$;

drop policy if exists jornada_config_leitura on public.oricse_jornada_config;
create policy jornada_config_leitura on public.oricse_jornada_config
for select to authenticated
using (
  public.oricse_pode_visualizar_pagamentos(clinica_id)
  or (funcionario_id=(select auth.uid()) and exists (
    select 1 from public.clinica_usuarios cu
    where cu.clinica_id=oricse_jornada_config.clinica_id and cu.user_id=(select auth.uid()) and cu.ativo
  ))
);

drop policy if exists jornada_config_rt_insert on public.oricse_jornada_config;
create policy jornada_config_rt_insert on public.oricse_jornada_config
for insert to authenticated
with check (
  public.oricse_pode_gerenciar_pagamentos(clinica_id)
  and exists (select 1 from public.clinica_usuarios cu where cu.clinica_id=oricse_jornada_config.clinica_id and cu.user_id=oricse_jornada_config.funcionario_id and cu.ativo)
);

drop policy if exists jornada_config_rt_update on public.oricse_jornada_config;
create policy jornada_config_rt_update on public.oricse_jornada_config
for update to authenticated
using (public.oricse_pode_gerenciar_pagamentos(clinica_id))
with check (public.oricse_pode_gerenciar_pagamentos(clinica_id));

drop policy if exists jornada_registros_leitura on public.oricse_jornada_registros;
create policy jornada_registros_leitura on public.oricse_jornada_registros
for select to authenticated
using (
  public.oricse_pode_visualizar_pagamentos(clinica_id)
  or (funcionario_id=(select auth.uid()) and exists (
    select 1 from public.clinica_usuarios cu
    where cu.clinica_id=oricse_jornada_registros.clinica_id and cu.user_id=(select auth.uid()) and cu.ativo
  ))
);

drop policy if exists rt_admin_select_pagamentos on public.oricse_pagamento_lancamentos;
create policy rt_admin_select_pagamentos on public.oricse_pagamento_lancamentos
for select to authenticated using (public.oricse_pode_visualizar_pagamentos(clinica_id));

drop policy if exists rt_admin_insert_pagamentos on public.oricse_pagamento_lancamentos;
create policy rt_admin_insert_pagamentos on public.oricse_pagamento_lancamentos
for insert to authenticated
with check (
  public.oricse_pode_gerenciar_pagamentos(clinica_id)
  and criado_por=(select auth.uid())
  and exists (select 1 from public.clinica_usuarios cu where cu.clinica_id=oricse_pagamento_lancamentos.clinica_id and cu.user_id=oricse_pagamento_lancamentos.funcionario_id and cu.ativo=true)
  and (catalogo_item_id is null or exists (select 1 from public.oricse_catalogo_itens i where i.id=oricse_pagamento_lancamentos.catalogo_item_id and i.clinica_id=oricse_pagamento_lancamentos.clinica_id))
);

drop policy if exists rt_admin_delete_pagamentos on public.oricse_pagamento_lancamentos;
create policy rt_admin_delete_pagamentos on public.oricse_pagamento_lancamentos
for delete to authenticated using (public.oricse_pode_gerenciar_pagamentos(clinica_id));

revoke all on function public.oricse_pode_visualizar_pagamentos(uuid) from public,anon;
grant execute on function public.oricse_pode_visualizar_pagamentos(uuid) to authenticated;
revoke all on function public.oricse_movimentar_estoque(uuid,uuid,numeric) from public,anon;
grant execute on function public.oricse_movimentar_estoque(uuid,uuid,numeric) to authenticated;
revoke all on function public.oricse_pode_gerenciar_pagamentos(uuid) from public,anon;
grant execute on function public.oricse_pode_gerenciar_pagamentos(uuid) to authenticated;
revoke all on function public.oricse_registrar_atividade(uuid,text) from public,anon;
grant execute on function public.oricse_registrar_atividade(uuid,text) to authenticated;
revoke all on function public.oricse_configurar_site_clinica(text,text) from public,anon;
grant execute on function public.oricse_configurar_site_clinica(text,text) to authenticated;
revoke all on function public.set_my_clinic_agenda_settings(integer,jsonb) from public,anon;
grant execute on function public.set_my_clinic_agenda_settings(integer,jsonb) to authenticated;
