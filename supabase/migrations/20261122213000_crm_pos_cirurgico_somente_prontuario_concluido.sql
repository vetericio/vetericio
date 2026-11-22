-- PREPARED ONLY. DO NOT APPLY WITHOUT VERIFIED FULL BACKUP + PUBLICATION APPROVAL.
-- Old routine generated post-surgery reminders from agenda entries, even unperformed.
-- New CRM generates post-surgical follow-ups only from completed opt-in clinical records.
-- No historical events are deleted or modified.
begin;

CREATE OR REPLACE FUNCTION public.oricse_crm_processar_clinica_interno(p_clinica_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_cfg public.oricse_crm_config%rowtype;
  v_src public.oricse_crm_fontes%rowtype;
  v_today date := timezone('America/Sao_Paulo',now())::date;
  v_tutor jsonb;
  v_animal jsonb;
  v_registro jsonb;
  v_agenda jsonb;
  v_evento jsonb;
  v_data date;
  v_send date;
  v_nasc date;
  v_ultimo date;
  v_text text;
  v_tipo text;
  v_servico text;
  v_animal_nome text;
  v_tutor_id text;
  v_animal_id text;
  v_ano integer;
  v_count integer := 0;
  v_added integer := 0;
begin
  select * into v_cfg from public.oricse_crm_config where clinica_id=p_clinica_id;
  if not found or not v_cfg.ativo then return 0; end if;
  if not public.oricse_plano_permite(p_clinica_id,'crm.inteligente') then return 0; end if;
  select * into v_src from public.oricse_crm_fontes where clinica_id=p_clinica_id;
  if not found then
    perform public.oricse_crm_preparar_fila_interno(p_clinica_id);
    return 0;
  end if;

  if v_cfg.gerar_aniversarios then
    for v_tutor in select value from jsonb_array_elements(coalesce(v_src.tutores,'[]'::jsonb)) loop
      if coalesce(v_tutor->>'autorizaLembretes','true')='false' then continue; end if;
      v_nasc := public.oricse_crm_parse_date(v_tutor->>'nascimento');
      if v_nasc is null then continue; end if;
      v_ano := extract(year from v_today)::int;
      v_data := public.oricse_crm_data_aniversario(v_nasc,v_ano);
      if v_data < v_today then v_data := public.oricse_crm_data_aniversario(v_nasc,v_ano+1); end if;
      if v_data between v_today and v_today+45 then
        v_added := public.oricse_crm_criar_evento_interno(p_clinica_id,'aniversario',v_tutor,'',v_data,'','aniversário',v_data,
          'aniversario:'||coalesce(v_tutor->>'id','sem-id')||':'||extract(year from v_data)::int,
          jsonb_build_object('fonte','tutor','nascimento',v_tutor->>'nascimento'));
        v_count := v_count + v_added;
      end if;
    end loop;
  end if;

  if v_cfg.gerar_reforcos then
    for v_registro in select value from jsonb_array_elements(coalesce(v_src.prontuario,'[]'::jsonb)) loop
      v_text := lower(concat_ws(' ',v_registro->>'tipo',v_registro->>'subtipo',v_registro->>'titulo',v_registro->>'detalhe'));
      if v_text !~ '(vacina|v10|v8|antirr|giard|gripe|verm)' then continue; end if;
      v_data := coalesce(
        public.oricse_crm_parse_date(v_registro->>'proximaDose'),
        public.oricse_crm_parse_date(v_registro->>'proximoReforco'),
        public.oricse_crm_parse_date(v_registro->>'validadeFim'),
        public.oricse_crm_parse_date(v_registro->'dados'->>'proximaDose'),
        public.oricse_crm_parse_date(v_registro->'dados'->>'proximoReforco'),
        public.oricse_crm_parse_date(v_registro->'dados'->>'validadeFim'),
        public.oricse_crm_parse_date(v_registro->'dados'->>'proxima_dose'),
        public.oricse_crm_parse_date(v_registro->'dados'->>'proximo_reforco'),
        public.oricse_crm_parse_date(v_registro->'dados'->>'validade_fim')
      );
      if v_data is null or v_data < v_today-14 or v_data > v_today+60 then continue; end if;
      v_animal_id := v_registro->>'animalId';
      select value into v_animal from jsonb_array_elements(coalesce(v_src.animais,'[]'::jsonb)) where value->>'id'=v_animal_id limit 1;
      if v_animal is null then continue; end if;
      v_tutor_id := v_animal->>'tutorId';
      select value into v_tutor from jsonb_array_elements(coalesce(v_src.tutores,'[]'::jsonb)) where value->>'id'=v_tutor_id limit 1;
      if v_tutor is null or coalesce(v_tutor->>'autorizaLembretes','true')='false' then continue; end if;
      v_servico := coalesce(nullif(v_registro->>'titulo',''),nullif(v_registro->>'subtipo',''),case when v_text ~ 'verm' then 'vermifugação' else 'reforço de vacina' end);
      v_added := public.oricse_crm_criar_evento_interno(p_clinica_id,'vacina',v_tutor,coalesce(v_animal->>'nome','seu pet'),v_data,'',v_servico,v_data,
        'vacina:'||coalesce(v_registro->>'id','sem-id')||':'||v_data::text,
        jsonb_build_object('fonte','prontuario','registro_id',v_registro->>'id'));
      v_count := v_count + v_added;
      v_animal := null; v_tutor := null;
    end loop;
  end if;

  if v_cfg.gerar_agendamentos then
    for v_agenda in select value from jsonb_array_elements(coalesce(v_src.agendas,'[]'::jsonb)) loop
      for v_evento in select value from jsonb_array_elements(coalesce(v_agenda->'eventos','[]'::jsonb)) loop
        v_data := public.oricse_crm_parse_date(v_evento->>'data');
        if v_data is null then continue; end if;
        v_tutor_id := v_evento->>'tutorId';
        if coalesce(v_tutor_id,'')<>'' then
          select value into v_tutor from jsonb_array_elements(coalesce(v_src.tutores,'[]'::jsonb)) where value->>'id'=v_tutor_id limit 1;
        else
          select value into v_tutor from jsonb_array_elements(coalesce(v_src.tutores,'[]'::jsonb)) where lower(value->>'nome')=lower(v_evento->>'tutor') limit 1;
        end if;
        if v_tutor is null or coalesce(v_tutor->>'autorizaLembretes','true')='false' then v_tutor:=null; continue; end if;
        v_animal_id := v_evento->>'animalId';
        if coalesce(v_animal_id,'')<>'' then
          select value into v_animal from jsonb_array_elements(coalesce(v_src.animais,'[]'::jsonb)) where value->>'id'=v_animal_id limit 1;
        else v_animal:=null; end if;
        v_animal_nome := coalesce(nullif(v_animal->>'nome',''),nullif(v_evento->>'paciente',''),'seu pet');
        v_servico := coalesce(nullif(v_evento->>'tipo',''),'consulta');

        if v_cfg.gerar_agendamentos and v_data between v_today and v_today+90 then
          v_tipo := case when v_servico ~* 'retorno' then 'retorno' else 'lembrete_consulta' end;
          v_send := v_data - greatest(0,v_cfg.dias_antecedencia_agenda);
          v_added := public.oricse_crm_criar_evento_interno(p_clinica_id,v_tipo,v_tutor,v_animal_nome,v_data,coalesce(v_evento->>'hora',''),v_servico,v_send,
            v_tipo||':'||coalesce(v_evento->>'id','sem-id')||':'||v_data::text||':'||coalesce(v_evento->>'hora',''),
            jsonb_build_object('fonte','agenda','evento_id',v_evento->>'id','data_consulta',v_data::text));
          v_count := v_count + v_added;
        end if;


        v_tutor:=null; v_animal:=null;
      end loop;
    end loop;
  end if;

  if v_cfg.gerar_inativos then
    for v_tutor in select value from jsonb_array_elements(coalesce(v_src.tutores,'[]'::jsonb)) loop
      if coalesce(v_tutor->>'autorizaMarketing','false')<>'true' then continue; end if;
      v_ultimo := public.oricse_crm_parse_date(v_tutor->>'criadoEm');
      for v_agenda in select value from jsonb_array_elements(coalesce(v_src.agendas,'[]'::jsonb)) loop
        for v_evento in select value from jsonb_array_elements(coalesce(v_agenda->'eventos','[]'::jsonb)) loop
          if v_evento->>'tutorId'=v_tutor->>'id' then
            v_data := public.oricse_crm_parse_date(v_evento->>'data');
            if v_data is not null and v_data<=v_today and (v_ultimo is null or v_data>v_ultimo) then v_ultimo:=v_data; end if;
          end if;
        end loop;
      end loop;
      if v_ultimo is null or (v_today-v_ultimo) < v_cfg.dias_inatividade then continue; end if;
      select value into v_animal from jsonb_array_elements(coalesce(v_src.animais,'[]'::jsonb)) where value->>'tutorId'=v_tutor->>'id' limit 1;
      v_added := public.oricse_crm_criar_evento_interno(p_clinica_id,'inativo',v_tutor,coalesce(v_animal->>'nome','seu pet'),v_today,'','acompanhamento',v_today,
        'inativo:'||coalesce(v_tutor->>'id','sem-id')||':'||to_char(v_today,'YYYY-MM'),
        jsonb_build_object('fonte','inatividade','ultima_interacao',v_ultimo::text));
      v_count := v_count + v_added;
      v_animal:=null;
    end loop;
  end if;

  perform public.oricse_crm_preparar_fila_interno(p_clinica_id);
  return v_count;
end;
$function$
;

commit;
