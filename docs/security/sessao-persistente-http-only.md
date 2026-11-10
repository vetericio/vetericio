# Sessão persistente segura no ORICSE

## Decisão confirmada

A sessão deve sobreviver ao recarregamento da página. Tokens de autenticação não devem ser gravados em `localStorage`, `sessionStorage` ou Google Drive. A implementação deve usar cookie `HttpOnly` e manter o armazenamento da sessão isolado por requisição.

## Estado encontrado no código

- `src/integrations/supabase/client.ts` mantém dois clientes Supabase em singletons de módulo e configura `persistSession: true`.
- `src/integrations/supabase/previewAuthStorage.ts` (main) grava a sessão em `localStorage` e também duplica o valor em um cookie acessível a JavaScript em `*.oricse.com.br`. O cookie atual não é `HttpOnly`.
- A alteração temporária para um `Map` em memória remove a persistência no refresh e usa estado de módulo compartilhado no caminho SSR; não é uma solução para login persistente nem para isolamento por requisição.
- A aplicação chama diretamente `supabase.auth.signInWithPassword`, `getSession`, `signOut` e APIs Supabase em vários módulos. Um adapter de cookies isolado não muda esses contratos com segurança.
- O Worker atual tem um Durable Object dedicado ao coordenamento de gravações no Drive. Não há serviço de sessão durável configurado. Esse objeto de escrita não deve ser reaproveitado para autenticação.

## Arquitetura recomendada

1. Introduzir um Backend-for-Frontend de autenticação no Worker, com endpoints de login, restauração/renovação e logout. O cliente não envia refresh tokens a armazenamento do navegador.
2. No login, validar credenciais no Supabase Auth do lado do servidor; criar um identificador de sessão aleatório e opaco (ao menos 256 bits); armazenar a sessão e o refresh token no armazenamento server-side. Persistir refresh tokens criptografados com uma chave gerenciada como segredo do Worker.
3. Enviar somente o identificador opaco em cookie `Secure; HttpOnly; SameSite=Lax; Path=/`. Usar `Domain=.oricse.com.br` apenas nos hosts ORICSE que precisam compartilhar login; usar cookie host-only em domínios próprios de clínicas. Definir expiração absoluta e inatividade, rotacionar identificador após autenticação/renovação e invalidar no logout.
4. Usar um Durable Object de autenticação separado do `ORICSE_WRITE_COORDINATOR`. Serializar atualização do refresh token para que duas abas não consumam simultaneamente o mesmo token rotativo. Guardar apenas os campos mínimos, aplicar expiração e apagar sessão no logout.
5. Renovar sessão no servidor e devolver ao browser apenas identidade e access token de curta duração em memória, ou mover as chamadas autenticadas para o BFF. Nunca devolver o refresh token ao JavaScript.
6. Criar cliente Supabase por requisição no servidor e validar o usuário no servidor antes de operações. Não guardar sessão, usuário ou cookie em singleton compartilhado por módulo.

### Decisão técnica que precede o código

Hoje a aplicação usa o cliente Supabase diretamente no browser, e a API `supabase-js` espera receber/guardar o objeto de sessão, que contém refresh token. Para cumprir `HttpOnly` de verdade, será necessário escolher e validar uma destas estratégias antes de adaptar esses muitos chamadores:

- migrar operações autenticadas para endpoints BFF e manter credenciais de refresh somente no servidor; ou
- manter chamadas de dados do browser usando somente access token de curta duração em memória, com login, refresh e logout processados por endpoints próprios, garantindo que nenhum caminho do Supabase JS devolva ou regrave o refresh token no estado do cliente.

Não implementar um `storage.getItem` que devolva a sessão completa ao JavaScript: isso exporia novamente o refresh token e desfaria a proteção pretendida. Também não enviar tokens ao Durable Object sem controle de expiração, isolamento de tenant e criptografia.

## Arquivos e componentes previstos

- `src/integrations/supabase/client.ts`: separar cliente de browser e clientes de servidor por requisição.
- `src/integrations/supabase/previewAuthStorage.ts`: remover `localStorage`, cookie legível por script e broker de tokens; trocar pela integração aprovada com o BFF.
- `src/routes/login.tsx`, `src/components/ClinicLogin.tsx` e todos os chamadores de `getSession`/`signOut`: usar contrato de autenticação novo.
- `src/server.ts`, `scripts/patch-wrangler.mjs` e `src/lib/*session*.server.ts`: adicionar binding e classe Durable Object de sessão separada.
- Configuração Cloudflare: novo segredo de criptografia, binding e migração do Durable Object. Não incluir valores de segredo no repositório.

## Critérios de aceite

- Login, refresh de página e navegação conservam a sessão sem persistir token no navegador.
- O refresh token não aparece em `document.cookie`, storage web, URL, logs ou respostas acessíveis a JavaScript.
- Duas abas simultâneas renovam a sessão sem invalidar uma à outra.
- Logout revoga/apaga a sessão; sessão expirada não pode ser restaurada.
- Duas clínicas/identidades sintéticas não conseguem ler, atualizar ou revogar a sessão uma da outra.
- Requests SSR concorrentes usam usuários/cookies distintos e não compartilham sessão entre si.
- CSRF, origem, limites de tentativas, rotação de sessão, expiração e recuperação de falha do armazenamento têm cobertura.
- Lint, typecheck, build e testes de regressão passam; fluxo é validado em homologação com Playwright em desktop e mobile.
- Rafael revisa autenticação/isolamento e Gabriel/André revisam binding, migração, backup e rollback antes da publicação.

## Reversão

Desativar o endpoint novo apenas depois de manter os cookies e sessões antigos válidos durante janela de migração. A reversão não pode restaurar escrita de tokens em `localStorage`. Planejar encerramento explícito das sessões se o formato do armazenamento server-side mudar.

## Referências

- [Supabase — SSR Auth: advanced guide](https://supabase.com/docs/guides/auth/server-side/advanced-guide)
- [Supabase — creating a client for SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- [Cloudflare — SQLite-backed Durable Object Storage](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/)
