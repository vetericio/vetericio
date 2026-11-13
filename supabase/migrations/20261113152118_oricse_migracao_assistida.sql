create table if not exists public.oricse_migracao_vinculos (
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  origem text not null,
  tipo text not null check (tipo in ('tutores','animais','prontuarios','vacinas','anexos')),
  id_origem text not null,
  destino_id uuid not null,
  importado_por uuid references auth.users(id) on delete set null,
  importado_em timestamptz not null default now(),
  primary key (clinica_id, origem, tipo, id_origem)
);
alter table public.oricse_migracao_vinculos enable row level security;
revoke all on public.oricse_migracao_vinculos from public,anon,authenticated;

create index if not exists oricse_migracao_destino_idx
  on public.oricse_migracao_vinculos(clinica_id,tipo,destino_id);
create or replace function public.oricse_definir_autoria_preventiva()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := auth.uid();
  v_perfil record;
begin
  if tg_op = 'UPDATE' then
    new.veterinario_nome := old.veterinario_nome;
    new.veterinario_crmv := old.veterinario_crmv;
    new.veterinario_uf := old.veterinario_uf;
    return new;
  end if;

  -- Rotinas internas sem sessão (ex.: carga de demonstração) não atribuem autoria.
  if v_usuario is null then
    return new;
  end if;

  -- A referência é gravada pelo RPC de migração na mesma transação que a vacina.
  -- A tabela de vínculos é privada e a autoria original é preservada.
  if tg_table_name='oricse_portal_vacinas' and exists (
    select 1 from public.oricse_migracao_vinculos v where v.clinica_id=new.clinica_id
      and v.tipo='vacinas' and v.destino_id=new.id and v.importado_por=v_usuario
  ) then return new; end if;

  select nullif(btrim(p.nome_completo), '') as nome,
         nullif(btrim(p.crmv), '') as crmv,
         upper(btrim(p.crmv_uf)) as uf
    into v_perfil
    from public.oricse_pessoas p
    where p.user_id = v_usuario;

  if not found or v_perfil.nome is null or v_perfil.crmv is null
    or v_perfil.crmv !~ '[0-9]' or v_perfil.uf is null
    or v_perfil.uf !~ '^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$' then
    raise exception using errcode = '22023', message = 'Complete nome, CRMV e UF no cadastro profissional do seu perfil.';
  end if;

  new.veterinario_nome := v_perfil.nome;
  new.veterinario_crmv := v_perfil.crmv;
  new.veterinario_uf := v_perfil.uf;
  return new;
end;
$$;

create or replace function public.oricse_migrar_registros(
  p_clinica uuid, p_origem text, p_tipo text, p_registros jsonb, p_importar boolean default false
) returns jsonb language plpgsql security definer set search_path='' as $$
<<migracao>>
declare
  d jsonb; resultados jsonb := '[]'; id_externo text; nome text; documento text; telefone text;
  vinculo uuid; tutor uuid; animal uuid; destino uuid; candidatos uuid[]; chip text;
  data_registro date; reforco date; hora time; detalhe text; aviso text; estado text; motivo text;
  origem_normalizada text := lower(btrim(coalesce(p_origem,'')));
begin
  if (select auth.uid()) is null or p_clinica is distinct from public.oricse_clinica_ativa_obter()
    or not coalesce(public.oricse_usuario_pode_permissao(p_clinica,'administracao.configuracoes'),false)
    or not exists(select 1 from public.clinicas where id=p_clinica and status='ativa' and excluido_em is null) then
    raise exception 'Migração indisponível para este perfil ou clínica.' using errcode='42501';
  end if;
  if p_tipo is null or p_tipo not in ('tutores','animais','prontuarios','vacinas','anexos')
    or length(origem_normalizada) not between 1 and 80 or jsonb_typeof(p_registros) is distinct from 'array'
    or jsonb_array_length(p_registros) not between 1 and 100 or octet_length(p_registros::text)>2000000 then
    raise exception 'Arquivo ou lote de migração inválido.' using errcode='22023';
  end if;
  if p_importar then
    perform pg_advisory_xact_lock(hashtextextended('oricse-migracao:' || p_clinica::text,0));
  end if;

  for d in select value from jsonb_array_elements(p_registros) loop
    id_externo := btrim(coalesce(d->>'id_origem',''));
    nome := btrim(coalesce(d->>'nome',''));
    chip := btrim(coalesce(d->>'microchip',''));
    aviso := null; tutor := null; animal := null; destino := null;
    begin
      if length(id_externo) not between 1 and 200 then
        raise exception 'Informe um identificador de origem de até 200 caracteres.';
      end if;
      select v.destino_id into vinculo from public.oricse_migracao_vinculos v
      where v.clinica_id=p_clinica and v.origem=origem_normalizada and v.tipo=p_tipo and v.id_origem=id_externo;
      if vinculo is not null then
        if (p_tipo='tutores' and not exists(select 1 from public.tutores where id=vinculo and clinica_id=p_clinica))
          or (p_tipo='animais' and not exists(select 1 from public.oricse_animais where id=vinculo and clinica_id=p_clinica))
          or (p_tipo='prontuarios' and not exists(select 1 from public.oricse_animal_registros_extra where id=vinculo and clinica_id=p_clinica))
          or (p_tipo='vacinas' and not exists(select 1 from public.oricse_portal_vacinas where id=vinculo and clinica_id=p_clinica))
          or (p_tipo='anexos' and not exists(select 1 from public.oricse_portal_documentos where id=vinculo and clinica_id=p_clinica and drive_arquivo_id is not null)) then
          raise exception 'Registro importado anteriormente está ausente. Confira o vínculo com a equipe.';
        end if;
        resultados := resultados || jsonb_build_array(jsonb_build_object(
          'status','existente','motivo','Já importado.','registroId',vinculo));
        continue;
      end if;

      if p_tipo='tutores' then
        documento := regexp_replace(coalesce(d->>'cpf_cnpj',''),'[^0-9]','','g');
        telefone := regexp_replace(coalesce(d->>'telefone',''),'[^0-9]','','g');
        if documento<>'' and length(documento) not in (11,14) then raise exception 'CPF ou CNPJ inválido.'; end if;
        if length(nome) not between 2 and 160 then raise exception 'Informe o nome do tutor.'; end if;
        select array_agg(t.id) into candidatos from public.tutores t
        where t.clinica_id=p_clinica and (
          (documento<>'' and t.cpf_digitos=documento) or
          (documento='' and length(migracao.telefone)>=8 and lower(t.nome)=lower(migracao.nome)
           and regexp_replace(coalesce(t.telefone,''),'[^0-9]','','g')=migracao.telefone)
        );
        if cardinality(candidatos)>1 then raise exception 'Mais de um tutor corresponde ao cadastro.'; end if;
        destino := candidatos[1];
        if destino is null then
          if length(telefone) not between 8 and 15 then raise exception 'Informe um telefone válido para criar o tutor.'; end if;
          if p_importar then
            destino := public.oricse_tutor_salvar_tela(p_clinica,jsonb_build_object(
              'nome',nome,'telefone',telefone,'cpfCnpj',documento,'email',left(coalesce(d->>'email',''),180),
              'tipoPessoa',case when length(documento)=14 then 'Pessoa jurídica' else 'Pessoa física' end,
              'autorizaMarketing',false,'autorizaWhatsapp',false,'autorizaEmail',false,'autorizaLembretes',false
            ),null);
          end if;
        else
          aviso := 'Vínculo pronto para registrar.';
        end if;
      elsif p_tipo='animais' then
        documento := regexp_replace(coalesce(d->>'tutor_cpf_cnpj',''),'[^0-9]','','g');
        if coalesce(d->>'tutor_id_origem','')<>'' then
          select t.id into tutor from public.oricse_migracao_vinculos v
          join public.tutores t on t.id=v.destino_id and t.clinica_id=p_clinica
          where v.clinica_id=p_clinica and v.origem=origem_normalizada and v.tipo='tutores' and v.id_origem=d->>'tutor_id_origem';
        elsif length(documento) in (11,14) then
          select array_agg(id) into candidatos from public.tutores where clinica_id=p_clinica and cpf_digitos=documento;
          if cardinality(candidatos)=1 then tutor:=candidatos[1]; end if;
        end if;
        if tutor is null then raise exception 'Tutor sem vínculo único. Confira a etapa Tutores.'; end if;
        if nome='' or length(nome)>150 or btrim(coalesce(d->>'especie',''))='' then raise exception 'Informe nome e espécie.'; end if;
        if chip<>'' then
          select array_agg(id) into candidatos from public.oricse_animais
          where clinica_id=p_clinica and dados->>'microchip'=chip;
          if cardinality(candidatos)>1 then raise exception 'Microchip associado a mais de um animal.'; end if;
          destino := candidatos[1];
          if destino is not null and not exists(select 1 from public.oricse_animais where id=destino and tutor_id=tutor) then
            raise exception 'Microchip vinculado a outro tutor.';
          end if;
        end if;
        if destino is null and exists(select 1 from public.oricse_animais where clinica_id=p_clinica and tutor_id=tutor and lower(oricse_animais.nome)=lower(migracao.nome)
          and (chip='' or coalesce(dados->>'microchip','')='')) then
          raise exception 'Animal com o mesmo nome já cadastrado para este tutor. Confira o microchip antes de vincular.';
        end if;
        data_registro := nullif(d->>'nascimento','')::date;
        if data_registro>current_date then raise exception 'Nascimento no futuro.'; end if;
        if destino is not null then aviso := 'Vínculo pronto para registrar.';
        elsif p_importar then
          destino := public.oricse_animal_salvar_tela(p_clinica,tutor,null,
            jsonb_build_object('nome',nome,'especie',d->>'especie','raca',d->>'raca','sexo',d->>'sexo',
              'nascimento',data_registro,'microchip',chip,'status','Ativo','temperamentos','[]'::jsonb));
        end if;
      else
        if coalesce(d->>'animal_id_origem','')<>'' then
          select a.id into animal from public.oricse_migracao_vinculos v
          join public.oricse_animais a on a.id=v.destino_id and a.clinica_id=p_clinica
          where v.clinica_id=p_clinica and v.origem=origem_normalizada and v.tipo='animais' and v.id_origem=d->>'animal_id_origem';
        elsif chip<>'' then
          select array_agg(id) into candidatos from public.oricse_animais
          where clinica_id=p_clinica and dados->>'microchip'=chip;
          if cardinality(candidatos)=1 then animal:=candidatos[1]; end if;
        end if;
        if animal is null then raise exception 'Animal sem vínculo único. Confira a etapa Animais.'; end if;
        if p_tipo='prontuarios' then
          data_registro := nullif(d->>'data','')::date;
          detalhe := btrim(coalesce(d->>'detalhe',''));
          if data_registro is null or data_registro>current_date or detalhe='' then raise exception 'Informe a data original e o texto do prontuário.'; end if;
          if p_importar then
            insert into public.oricse_animal_registros_extra(clinica_id,animal_id,tipo,titulo,detalhe,data)
            values(p_clinica,animal,'Registros clínicos',left(coalesce(nullif(d->>'titulo',''),'Prontuário importado'),200),
              concat_ws(E'\n\n',detalhe,nullif(concat_ws(' · ',nullif(d->>'veterinario',''),nullif(d->>'crmv','')),'')),data_registro)
            returning id into destino;
          end if;
        elsif p_tipo='vacinas' then
          data_registro := nullif(d->>'aplicada_em','')::date;
          reforco := nullif(d->>'reforco_em','')::date;
          hora := nullif(d->>'hora_aplicacao','')::time;
          if nome='' or data_registro is null or data_registro>current_date or reforco<data_registro then
            raise exception 'Informe a vacina e confira as datas de aplicação e reforço.';
          end if;
          if p_importar then
            destino := gen_random_uuid();
            insert into public.oricse_migracao_vinculos(clinica_id,origem,tipo,id_origem,destino_id,importado_por)
            values(p_clinica,origem_normalizada,p_tipo,id_externo,destino,(select auth.uid()));
            insert into public.oricse_portal_vacinas(id,clinica_id,animal_id,nome,aplicada_em,reforco_em,lote,fabricante,
              fabricacao,validade,dose,alvo_vacinacao,hora_aplicacao,local_aplicacao,veterinario_nome,veterinario_crmv,veterinario_uf,observacoes,visivel_tutor)
            values(destino,p_clinica,animal,left(nome,200),data_registro,reforco,nullif(d->>'lote',''),nullif(d->>'fabricante',''),
              nullif(d->>'fabricacao',''),nullif(d->>'validade',''),nullif(d->>'dose',''),nullif(d->>'alvo_vacinacao',''),hora,
              nullif(d->>'local_aplicacao',''),nullif(d->>'veterinario',''),nullif(d->>'crmv',''),nullif(d->>'uf',''),nullif(d->>'observacoes',''),false)
            returning id into destino;
          end if;
        else
          data_registro := nullif(d->>'data','')::date;
          if coalesce(d->>'arquivo','') !~* '^.+[.]pdf$' or length(d->>'arquivo')>220 then raise exception 'Informe o nome exato de um PDF.'; end if;
          destino := md5(jsonb_build_array(p_clinica,origem_normalizada,p_tipo,id_externo)::text)::uuid;
          if p_importar then
            if not exists(select 1 from public.drive_arquivos f where f.id=destino and f.clinica_id=p_clinica
              and f.entidade_id=animal::text and f.entidade_tipo='animal' and f.categoria='documentos'
              and f.mime_type='application/pdf' and f.nome=d->>'arquivo') then
              raise exception 'PDF ainda não vinculado ao animal.';
            end if;
            insert into public.oricse_portal_documentos(id,clinica_id,animal_id,drive_arquivo_id,titulo,tipo,data_documento,observacoes,visivel_tutor)
            values(destino,p_clinica,animal,destino,left(coalesce(nullif(d->>'titulo',''),d->>'arquivo'),220),
              'Documento importado',data_registro,nullif(d->>'observacoes',''),false);
          end if;
        end if;
      end if;

      if p_importar and p_tipo<>'vacinas' then
        insert into public.oricse_migracao_vinculos(clinica_id,origem,tipo,id_origem,destino_id,importado_por)
        values(p_clinica,origem_normalizada,p_tipo,id_externo,destino,(select auth.uid()));
      end if;
      estado := case when p_importar then 'importado' when aviso is not null then 'existente' else 'novo' end;
      motivo := case when p_importar and aviso is not null then 'Vinculado ao cadastro existente.'
        when p_importar then 'Importado.' else coalesce(aviso,'Pronto para importar.') end;
      resultados := resultados || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
        'status',estado,'motivo',motivo,'animalId',animal,'registroId',destino)));
    exception
      when data_exception then
        resultados := resultados || jsonb_build_array(jsonb_build_object('status','pendente','motivo','Data, horário ou campo inválido. Confira os valores.'));
      when integrity_constraint_violation then
        resultados := resultados || jsonb_build_array(jsonb_build_object('status','pendente','motivo','Conflito ao gravar o registro. Confira o vínculo e os campos.'));
      when raise_exception then
        resultados := resultados || jsonb_build_array(jsonb_build_object('status','pendente','motivo',sqlerrm));
    end;
  end loop;
  return resultados;
end;
$$;
revoke all on function public.oricse_migrar_registros(uuid,text,text,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.oricse_migrar_registros(uuid,text,text,jsonb,boolean) to authenticated;
