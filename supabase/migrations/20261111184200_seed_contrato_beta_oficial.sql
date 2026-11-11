insert into public.oricse_contrato_modelos (titulo, descricao, conteudo, template_pdf_url, criado_por)
select
  'Contrato de adesão ao Programa ORICSE Beta',
  'Modelo oficial preenchível com a diagramação do PDF enviado.',
  'PARCEIRO BETA: {{razao_social_nome}}, CPF/CNPJ nº {{cpf_cnpj}}, endereço {{endereco_parceiro}}, e-mail {{email}}, telefone/WhatsApp {{telefone_whatsapp}}, neste ato representado por {{representante_legal}}, CPF nº {{cpf_representante}}, data de nascimento {{data_nascimento}}, endereço {{endereco_representante}}.\n\nBelo Horizonte/MG, {{data_contrato}}\n\n{{representante_legal}}\nCPF {{cpf_representante}}',
  '/contratos/contrato-oricse-beta.pdf',
  (select id from auth.users where email = 'vetericio@gmail.com' limit 1)
where not exists (
  select 1 from public.oricse_contrato_modelos
  where titulo = 'Contrato de adesão ao Programa ORICSE Beta'
);
