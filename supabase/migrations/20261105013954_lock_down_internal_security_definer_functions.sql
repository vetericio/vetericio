-- Fecha a execução anônima de funções internas SECURITY DEFINER.
-- Funções públicas de portal, contratação e cupom permanecem expostas por necessidade do fluxo público.
do $$
declare
  assinatura text;
  funcoes_autenticadas text[] := array[
    'public.oricse_animal_cadastro_tela(uuid,uuid,uuid)',
    'public.oricse_animal_historico(uuid,text,text,text,date,numeric)',
    'public.oricse_animal_salvar_tela(uuid,uuid,uuid,jsonb)',
    'public.oricse_clinica_ativa_definir(uuid)',
    'public.oricse_clinica_ativa_obter()',
    'public.oricse_configurar_pagamento_catalogo(uuid,text,integer,boolean,text,integer)',
    'public.oricse_configurar_taxa_pagamento(uuid,text,numeric,integer,numeric)',
    'public.oricse_fila_operar(uuid,text,uuid,uuid,uuid,text,timestamp with time zone)',
    'public.oricse_fila_tela(uuid)',
    'public.oricse_listar_cobrancas_integradas()',
    'public.oricse_listar_pagamentos_catalogo()',
    'public.oricse_listar_precos_portal()',
    'public.oricse_listar_taxas_pagamento()',
    'public.oricse_portal_agendas()',
    'public.oricse_portal_config_gerenciar(uuid,text,text,text,text,boolean,boolean)',
    'public.oricse_portal_painel(uuid,jsonb,jsonb,uuid,boolean)',
    'public.oricse_portal_promocao_publicar(uuid,uuid,boolean)',
    'public.oricse_resolver_clinica_cadastro_animal(uuid,uuid)',
    'public.oricse_salvar_cobranca_integrada(uuid,text,integer,boolean,text,integer)',
    'public.oricse_salvar_preco_portal(uuid,text,text,integer,text)',
    'public.oricse_tutor_salvar_tela(uuid,jsonb,uuid)',
    'public.oricse_tutores_tela(uuid)'
  ];
  funcoes_internas text[] := array[
    'public.oricse_criar_agendamento_online(uuid,text,timestamp with time zone)',
    'public.oricse_criar_assinatura_contratacao()',
    'public.oricse_enqueue_drive_backup()'
  ];
begin
  foreach assinatura in array funcoes_autenticadas loop
    if to_regprocedure(assinatura) is not null then
      execute format('revoke execute on function %s from anon, public', assinatura);
      execute format('grant execute on function %s to authenticated', assinatura);
    end if;
  end loop;
  foreach assinatura in array funcoes_internas loop
    if to_regprocedure(assinatura) is not null then
      execute format('revoke execute on function %s from anon, authenticated, public', assinatura);
    end if;
  end loop;
end $$;
