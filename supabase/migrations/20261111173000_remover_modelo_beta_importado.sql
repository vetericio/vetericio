-- Reverte a importação automática do documento enviado.
-- A estrutura do módulo Contratos permanece disponível sem um modelo pré-carregado.
delete from public.oricse_contrato_modelos
where id = '41e31fa6-4d8a-4435-8a78-19e95d26ec32'
  and titulo = 'Contrato de adesão ao Programa ORICSE Beta';
