-- Dados institucionais mínimos para orçamentos, sem liberar leitura direta de contratações.
create or replace function public.oricse_orcamento_dados_clinica(p_clinica_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clinica public.clinicas%rowtype;
  v_contrato public.oricse_contratacoes%rowtype;
begin
  if (select auth.uid()) is null or p_clinica_id is null then
    raise exception 'Faça login para consultar os dados da clínica.' using errcode='42501';
  end if;
  if not (public.oricse_is_platform_admin()
      or public.oricse_usuario_pode_permissao(p_clinica_id,'caixa.comandas')
      or public.oricse_usuario_pode_permissao(p_clinica_id,'caixa.financeiro.gerenciar')) then
    raise exception 'Sem permissão para criar orçamentos desta clínica.' using errcode='42501';
  end if;
  select * into v_clinica from public.clinicas
    where id=p_clinica_id and status='ativa' and excluido_em is null;
  if not found then raise exception 'Clínica não encontrada ou inativa.' using errcode='42501'; end if;
  select * into v_contrato from public.oricse_contratacoes
    where clinica_criada_id=p_clinica_id order by created_at desc limit 1;
  return pg_catalog.jsonb_build_object(
    'nome', v_clinica.nome,
    'razao_social', v_contrato.razao_social,
    'cnpj', v_contrato.cnpj,
    'telefone', v_contrato.clinica_telefone,
    'email', v_contrato.clinica_email,
    'endereco', v_contrato.clinica_endereco,
    'numero', v_contrato.clinica_numero,
    'complemento', v_contrato.clinica_complemento,
    'bairro', v_contrato.clinica_bairro,
    'cidade', v_contrato.clinica_cidade,
    'uf', v_contrato.clinica_uf,
    'cep', v_contrato.clinica_cep,
    'logo_url', v_clinica.logo_url
  );
end;
$$;
revoke all on function public.oricse_orcamento_dados_clinica(uuid) from public,anon,authenticated;
grant execute on function public.oricse_orcamento_dados_clinica(uuid) to authenticated;
