# ORICSE — Auditoria de testes e conferências (1º de novembro de 2026)

## Escopo

Auditoria **somente leitura**, sem uso de contas autenticadas de teste e sem alteração de registros clínicos ou financeiros. Fontes: GitHub Actions, código e arquivos no repositório, catálogo e políticas no Supabase, verificadores nativos de segurança/desempenho, SQL de integridade e teste de fumaça de navegação no Cloudflare.

## Resultados aprovados

1. **GitHub CI**: última validação consultada `41372791155`, commit `09b81a3837`, **sucesso**. Validações anteriores também passaram. A CI inclui TypeScript, build, auditoria de UI, testes de autorização e dry-run de Cloudflare. CI aprovada **não é** teste funcional de todas as operações.
2. **Cloudflare**: implantação manual confirmada como bem-sucedida em `41372085230`, mas usou uma revisão anterior às alterações mais recentes. Não há confirmação de deploy do HEAD atual.
3. **Site publicado**: homepage, planos (Essencial, Plus, Master), login e navegação pública passaram em teste de navegador sem autenticação. Rotas `/admin-planos`, `/plano-clinica`, `/permissoes-equipe`, `/recepcao`, `/hotelzinho` e `/comandas` não exibiram conteúdo protegido a visitantes não autenticados. **Isso não testa API, autorizações de cargo nem operação dos módulos.**
4. **Supabase RLS**: 73/73 tabelas públicas possuem RLS habilitado. Isso não equivale a revisão completa de cada política.
5. **Consistência SQL (6 verificações)**: nenhuma das consultas encontrou animal com tutor de outra clínica/ausente, agendamento vinculado à agenda de outra clínica, agendamento com fim anterior ao início, estadia com animal inválido, estadia com período inválido ou registro de cuidado sem estadia válida.
6. **Amostra de dados**: 2 clínicas, 52 tutores, 82 animais, 1 agenda, 0 agendamentos na tabela `oricse_agendamentos_online`, 2 estadias e 2 registros de cuidado. Sem registros de agendamento, não foi possível testar um agendamento real.
7. **Suíte de plano/cargo**: 13 testes unitários disponíveis e aprovados na CI, cobrindo negativa por módulo/cargo, separação entre clínicas e ações novas não aprovadas. Não simulam fluxos reais autenticados.

## Achados e riscos

### P0 — Devem ser revisados antes de considerar o sistema liberado para produção

- **RPCs privilegiadas expostas**: o advisor do Supabase detectou 31 funções `SECURITY DEFINER` executáveis pelo papel `anon` e 71 pelo `authenticated`. Algumas têm verificações internas de `auth.uid()`; várias são deliberadamente públicas (portal, contratação). A presença no advisor é **sinal de revisão**, não prova de exploração. É necessário classificar as 31, manter endpoints públicos intencionais e revogar `EXECUTE` de chamadas internas que não deveriam ser expostas.
  Guia: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable
- **Gravação direta da tabela de módulos**: a política RLS atual de `oricse_dados_modulos` permite `SELECT`/`UPDATE` a qualquer vínculo ativo com a clínica (sem distinguir o cargo), enquanto a camada de armazenamento no Worker implementa controle granular por plano/cargo. Confirmar se o cliente pode usar o endpoint PostgREST diretamente e, se isso contorna o controle do plano, restringir INSERT/UPDATE/DELETE à via de servidor autorizada, sem prejudicar a persistência.
- **Duas fontes de regras**: a matriz SQL existente contém 3 planos, 20 funcionalidades, 33 permissões, 60 associações plano–funcionalidade e **0 ações `acao.*`**. A central de planos no Drive possui modelo granular diferente. Deve existir uma política convergente que cubra RPC SQL, Worker e UI; nenhuma suíte comprovou essa consistência.
- **Testes por conta e por clínica**: não realizados por não haver sessão autenticada de teste disponível. Necessários cenários Admin Geral, RT, veterinário, recepção, tutor e duas clínicas isoladas.

### P1 — Funcionalidade e desempenho

- 59 rotas declaradas no inventário CI; 11 não estão em `PERMISSOES_ROTA` (incluindo rotas de admin, aliases, OAuth e páginas públicas). Verificar **proteções próprias** antes de classificar cada uma como falha.
- Verificação RLS: 16 tabelas sem políticas, principalmente tabelas sem grants diretos; avaliar tabelas com acesso concedido individualmente. `sync_salas` tem RLS, não tem policy e possui grants; sem policy isso normalmente resulta em negação, a ser testada.
- O advisor reportou 52 FKs sem índices de suporte, 19 ocorrências de avaliação repetida de funções auth em políticas, 28 políticas permissivas múltiplas e 1 índice duplicado. Corrigir com base em planos de execução, sem criar/excluir índices indiscriminadamente.
- Proteção contra senhas vazadas consta como alerta de configuração Auth.
- Os valores e a integridade do fluxo de reservas/agendas e os dados efetivos no Google Drive não foram verificáveis em teste end-to-end.
- Devem ser realizados testes de criação, edição, impressão, listagem, persistência após relogin, troca de clínica, check-in/out, financeiro, receita e permissões por cargo; testes com dados sintéticos em clínica de testes.

## Teste do site

Execução de navegação somente-leitura:
https://agent.tinyfish.ai/runs/95246130-a4ca-40eb-b6ae-47da0aa5910b

Último workflow bem-sucedido auditado:
https://github.com/vetericio/vetericio/actions/runs/41372791155

Último deploy confirmado:
https://github.com/vetericio/vetericio/actions/runs/41372085230

## Conclusão

**Aprovado**: compilação e testes automáticos da CI, navegação pública, barreiras visuais sem login e as seis consultas de integridade.  
**Pendente**: autorização real em todos os caminhos SQL/Drive, correção dos riscos apontados pelos advisors, testes autenticados, testes end-to-end e publicação/validação da versão mais recente.

A auditoria não modificou dados, configurações de acesso, preços, permissões ou pacientes. **Não declarar o sistema integralmente testado nem liberado para produção** até as verificações pendentes.
