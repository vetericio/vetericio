insert into public.oricse_permissoes(codigo,nome,grupo,descricao,funcionalidade_codigo,ordem,ativo)
values(
  'portal_tutor.gerenciar',
  'Gerenciar portal do tutor',
  'Portal do tutor',
  'Ativar acessos, emitir convites e administrar o portal dos tutores da clínica.',
  'portal_tutor.acesso',
  89,
  true
)
on conflict (codigo) do update set
  nome=excluded.nome,
  grupo=excluded.grupo,
  descricao=excluded.descricao,
  funcionalidade_codigo=excluded.funcionalidade_codigo,
  ordem=excluded.ordem,
  ativo=true;

insert into public.oricse_permissoes_papel(papel,permissao_codigo,permitido)
select papel,'portal_tutor.gerenciar',papel in ('responsavel','admin_clinica','rt','recepcao')
from unnest(array['responsavel','admin_clinica','usuario','rt','veterinario','auxiliar_estagiario','recepcao']) as p(papel)
on conflict (papel,permissao_codigo) do update set permitido=excluded.permitido;
