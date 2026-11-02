# ORICSE — auditoria de planos e autorização (01/11/2026)

## Escopo executado

Implementação na branch `main` do repositório `vetericio/vetericio`:

- Matriz comparativa central em `src/routes/admin-planos.tsx`, com busca, filtros, ativação individual e por grupo, histórico e alterações não salvas.
- Catálogo formado a partir dos módulos de `oricse_funcionalidades` e ações de `oricse_permissoes`.
- Resolução dinâmica das permissões do plano na camada Drive (`src/lib/drive-rpc.ts`), preservando temporariamente as regras preexistentes.
- Ações futuras não aprovadas são negadas nessa camada; o bloqueio do módulo prevalece sobre a ação.
- Ajustes em `drive-db.functions.ts` para preservar IDs durante `upsert`.
- IDs estáveis para as linhas iniciais do Drive, evitando descartes pelo journal.
- Auditoria estática em `scripts/audit-planos.mjs`, executada na CI.

## Inventário inicial, não exaustivo

No banco consultado antes das alterações existiam:
- **3 planos**
- **20 funcionalidades de módulo**
- **33 permissões de usuário**
- **60 vínculos plano–funcionalidade** (20 por plano)

No repositório foram encontrados **539 arquivos**, incluindo **58 rotas TSX**, **104 componentes TSX** e **15 arquivos de funções de servidor**. Contar rotas/botões não demonstra cobertura de autorização; o script em CI identifica lacunas de mapeamento para revisão manual.

## Pendências críticas — NÃO DECLARAR CONCLUÍDO

1. **Endpoints e operações diretas.** O catálogo cobre as permissões já registradas, mas não todas as operações CRUD de todas as rotas; é necessário verificar e instrumentar cada função de servidor, RPC e ação direta, inclusive as que usam `supabaseBanco`.
2. **Convergência de fontes.** A interface administrativa usa o proxy/Drive para configurações operacionais; funções SQL legadas em PostgreSQL possuem políticas próprias. É necessário estabelecer uma única política de autorização efetiva e testar a sincronização, evitando decisões divergentes entre as camadas.
3. **Cobertura de navegação.** `PERMISSOES_ROTA` não representa todos os arquivos de rota. A proteção do menu não substitui controle de backend.
4. **Limites adicionais.** Somente os limites já suportados pelo sistema, como usuários, possuem validações existentes; limites de agendas e armazenamento ainda exigem modelo de dados e validação de servidor.
5. **Testes de integração.** São necessários testes reais autenticados por plano/cargo/usuário, inclusive tentativas de acessar endpoints diretamente e de consultar clínicas de terceiros.
6. **Publicação.** A implantação no Cloudflare é manual e não foi acionada durante esta auditoria.

## Regras de segurança

- Nunca fazer publicação de produção sem validação.
- Nunca apagar dados operacionais de clínicas para implantar a matriz.
- O Admin Geral pode administrar planos; as permissões individuais de funcionários não podem superar bloqueios do plano.
- A existência de um toggle na interface **não** é prova de que a operação está segura no servidor.

## Validação

Acompanhar `Actions → Validate` para os commits da branch `main`. O script `scripts/audit-planos.mjs` imprime o inventário e as rotas sem mapeamento explícito. Verificar as etapas de build, TypeScript, auditoria de UI e dry-run Cloudflare antes de implantar.
