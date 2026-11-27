-- A serialização é por linha clínica + estado, não depende do Worker em uso.
-- Apenas o backend autenticado/autorizado chama estas operações.
create function public.oricse_alterar_estado_atomicamente(
  p_clinica uuid, p_autor uuid, p_alteracoes jsonb
) returns boolean language plpgsql security invoker set search_path = '' as $$
declare
  anterior jsonb;
  proximo jsonb;
  item jsonb;
  chave_item text;
begin
  insert into public.oricse_dados_modulos(clinica_id, chave, dados, atualizado_por, atualizado_em)
    values (p_clinica,'estado_sistema','{}'::jsonb,p_autor,now())
    on conflict (clinica_id,chave) do nothing;
  select dados into strict anterior from public.oricse_dados_modulos
    where clinica_id=p_clinica and chave='estado_sistema' for update;
  proximo := anterior;
  for item in select value from jsonb_array_elements(p_alteracoes) loop
    chave_item := item->>'chave';
    if (anterior->>chave_item) is distinct from (item->>'esperado') then
      raise exception 'Outros usuários alteraram dados. Atualize a tela e revise antes de salvar.' using errcode='40001';
    end if;
    if not (item ? 'valor') then continue; end if;
    if item->>'valor' is null then
      proximo := proximo - chave_item;
    else
      proximo := jsonb_set(proximo, array[chave_item], item->'valor', true);
    end if;
  end loop;
  if anterior is distinct from proximo then
    update public.oricse_dados_modulos set dados=proximo, atualizado_por=p_autor, atualizado_em=now()
      where clinica_id=p_clinica and chave='estado_sistema';
  end if;
  return true;
end;
$$;
revoke all on function public.oricse_alterar_estado_atomicamente(uuid,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.oricse_alterar_estado_atomicamente(uuid,uuid,jsonb) to service_role;

alter table public.oricse_painel_plantao_eventos add column administracao jsonb;

-- A ficha recebe a projeção do mesmo evento, se houver, no mesmo commit.
-- Datas clínicas informadas pelo executor são distintas do timestamp do evento.
create function public.oricse_registrar_execucao_plantao(
  p_clinica uuid, p_autor uuid, p_turno_esperado text, p_fichas_esperadas text, p_evento jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  anterior jsonb;
  lista jsonb;
  posicao integer;
  entrada public.oricse_painel_plantao_eventos%rowtype;
  item public.oricse_painel_plantao_eventos%rowtype;
begin
  select dados into strict anterior from public.oricse_dados_modulos
    where clinica_id=p_clinica and chave='estado_sistema' for update;
  entrada := jsonb_populate_record(null::public.oricse_painel_plantao_eventos,p_evento);
  if p_turno_esperado is distinct from (anterior->>'veterico-plantao-v1') then
    raise exception 'O plantão mudou. Atualize a tela antes de registrar.' using errcode='40001';
  end if;
  select * into item from public.oricse_painel_plantao_eventos
    where clinica_id=p_clinica and tipo=entrada.tipo and chave=entrada.chave
      and (entrada.tipo='dose' or turno_chave=entrada.turno_chave);
  if found then
    if item.estado is distinct from entrada.estado or item.texto is distinct from entrada.texto
      or item.administracao is distinct from entrada.administracao
      or item.registro_id is distinct from entrada.registro_id then
      raise exception 'Já existe outro lançamento para este registro. Atualize o painel.' using errcode='23505';
    end if;
    return jsonb_build_object('evento',to_jsonb(item)-'clinica_id'-'autor_id', 'inserido',false,'fichas',case when item.tipo='dose' or item.administracao is not null then anterior->>'veterico-registros-v1' end);
  end if;
  if p_fichas_esperadas is distinct from (anterior->>'veterico-registros-v1') then
    raise exception 'A ficha mudou. Atualize a tela antes de registrar.' using errcode='40001';
  end if;
  insert into public.oricse_painel_plantao_eventos (
    clinica_id,turno_chave,tipo,chave,registro_id,paciente,medicamento,agendado_em,estado,texto,
    autor_id,autor_nome,administracao
  ) values (
    p_clinica,entrada.turno_chave,entrada.tipo,entrada.chave,entrada.registro_id,entrada.paciente,
    entrada.medicamento,entrada.agendado_em,entrada.estado,entrada.texto,p_autor,entrada.autor_nome,
    entrada.administracao
  ) returning * into item;

  if item.tipo='dose' or item.administracao is not null then
    lista := coalesce((anterior->>'veterico-registros-v1')::jsonb,'[]'::jsonb);
    select (ordinalidade-1)::int into strict posicao
      from jsonb_array_elements(lista) with ordinality as ficha(dado,ordinalidade)
      where dado->>'id'=item.registro_id and (dado->>'obito') is null;
    lista := jsonb_set(lista, array[posicao::text,'execucoesMedicacao'],
      coalesce(lista#>array[posicao::text,'execucoesMedicacao'],'[]'::jsonb) ||
        jsonb_build_array(to_jsonb(item)-'clinica_id'),true);
    update public.oricse_dados_modulos
      set dados=jsonb_set(anterior,array['veterico-registros-v1'],to_jsonb(lista::text),true),
          atualizado_por=p_autor, atualizado_em=now()
      where clinica_id=p_clinica and chave='estado_sistema';
  end if;
  return jsonb_build_object('evento',to_jsonb(item)-'clinica_id'-'autor_id','inserido',true,'fichas',lista::text);
end;
$$;
revoke all on function public.oricse_registrar_execucao_plantao(uuid,uuid,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.oricse_registrar_execucao_plantao(uuid,uuid,text,text,jsonb) to service_role;

create table public.oricse_fechamentos_plantao (
  clinica_id uuid not null references public.clinicas(id),
  turno_chave text not null,
  autor_id uuid not null,
  encerrado_em timestamptz not null default now(),
  arquivo jsonb not null,
  primary key (clinica_id, turno_chave)
);
alter table public.oricse_fechamentos_plantao enable row level security;
revoke all on public.oricse_fechamentos_plantao from public, anon, authenticated, service_role;
grant select,insert on public.oricse_fechamentos_plantao to service_role;

create function public.oricse_encerrar_plantao_atomicamente(
  p_clinica uuid, p_autor uuid, p_turno text, p_leitura jsonb, p_arquivo jsonb
) returns boolean language plpgsql security invoker set search_path = '' as $$
declare
  atual jsonb;
  eventos jsonb;
  arquivo jsonb;
  anterior jsonb;
  evento_count integer;
  chave_leitura text;
begin
  select dados into strict atual from public.oricse_dados_modulos
    where clinica_id=p_clinica and chave='estado_sistema' for update;
  if exists (select 1 from public.oricse_fechamentos_plantao where clinica_id=p_clinica and turno_chave=p_turno)
    then return true; end if;
  for chave_leitura in select jsonb_object_keys(p_leitura) loop
    if (atual->>chave_leitura) is distinct from (p_leitura->>chave_leitura) then
      raise exception 'A internação mudou. Atualize a tela e revise antes de finalizar.' using errcode='40001';
    end if;
  end loop;
  select count(*), coalesce(
    jsonb_agg(to_jsonb(e)-'clinica_id'-'autor_id' order by registrado_em,tipo,chave),'[]'::jsonb
  ) into evento_count,eventos
    from public.oricse_painel_plantao_eventos e
    where e.clinica_id=p_clinica and e.turno_chave=p_turno;
  if evento_count > 5000 then
    raise exception 'O histórico deste turno excede 5.000 eventos. Nenhum dado foi alterado.';
  end if;
  arquivo := p_arquivo || jsonb_build_object('eventos',eventos, 'criadoEm',now());
  anterior := coalesce((atual->>'veterico-plantoes-v1')::jsonb,'[]'::jsonb);
  insert into public.oricse_fechamentos_plantao(clinica_id,turno_chave,autor_id,arquivo)
    values(p_clinica,p_turno,p_autor,arquivo);
  update public.oricse_dados_modulos set
    dados=jsonb_set(
      jsonb_set(atual, array['veterico-plantoes-v1'], to_jsonb((jsonb_build_array(arquivo)||anterior)::text), true),
      array['veterico-plantao-v1'], to_jsonb(jsonb_build_object('finalizadoEm',now(),'turnoChave',p_turno)::text), true
    ), atualizado_por=p_autor, atualizado_em=now()
    where clinica_id=p_clinica and chave='estado_sistema';
  return true;
end;
$$;
revoke all on function public.oricse_encerrar_plantao_atomicamente(uuid,uuid,text,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.oricse_encerrar_plantao_atomicamente(uuid,uuid,text,jsonb,jsonb) to service_role;
