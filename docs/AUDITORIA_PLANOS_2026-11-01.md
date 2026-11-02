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

## Caminhos de administração implementados

- **Admin Geral:** `/admin` → aba **Planos** → **Abrir gerenciador geral de planos** (`/admin-planos`).
  A tela principal permite editar os planos e aprovar/bloquear módulos e ações.
- **Administração da Clínica:** menu lateral **Configurações** → **Meu plano e funcionalidades** (`/plano-clinica`).
  Apenas visualização: plano contratado, limites e acessos efetivos do plano.
- **Administração da Clínica:** menu lateral **Configurações** → **Permissões da equipe** (`/permissoes-equipe`).
  RT/gestores podem ajustar permissões individuais, mas não ampliar os benefícios comerciais do plano.

## Proteções adicionais nesta etapa

- Escritas de tutores/animais, agendas, catálogos, Hotelzinho e remuneração verificam permissões do plano e do cargo na camada Drive; alterações individuais respeitam o plano.
- Escritas em tabelas globais de planos, exceções comerciais e permissões de cargo exigem Admin Geral.
- Alterações em permissões individuais exigem RT/gestor ativo; funcionário comum não pode elevar seus próprios privilégios diretamente pela API.
- A matriz e as permissões anteriores são preservadas; novas ações desconhecidas são negadas até aprovação.

## Verificações ainda necessárias antes de publicar

- Testes end-to-end autenticados como Admin Geral, RT, recepção, veterinário e tutor, em duas clínicas diferentes.
- Revisão das RPCs PostgreSQL legadas e das chamadas diretas a `supabaseBanco`; nem todas obedecem à matriz mantida no Drive.
- Completar catálogo de operações que ainda não constam de `oricse_permissoes`.
- Medição de latência do acesso ao Drive após inclusão das verificações de autorização de escrita.
- Validar o fluxo de publicar no Cloudflare; nenhuma implantação foi iniciada.

