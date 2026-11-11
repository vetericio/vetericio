# ORICSE — Supabase principal, Google Drive para backups e todos os PDFs

Status: **migração iniciada, ainda não pronta para publicar**.

## Decisão arquitetural
- Supabase PostgreSQL: fonte única de verdade para todos os registros estruturados e autenticação.
- Google Drive: armazenamento de **todos os PDFs** e cópias versionadas de todos os registros estruturados.
- PDF no banco: apenas identificadores, vínculos, permissões e metadados, nunca bytes.
- O backup deve ser executado no backend e não depender de aba aberta.
- Cada cópia deve manter o identificador da clínica; validação de escopo no servidor.
- Falha no Drive não deve apagar dados ou bloquear novas operações confirmadas no Supabase.
- Exclusões devem gerar eventos de tombstone e reter versões anteriores.
- Reprocessamento idempotente, retry com backoff e métricas de pendências.
- Não desviar leitura/escrita para Drive caso Supabase esteja indisponível.

## O que já foi aplicado
No projeto Supabase mwrmfcyrdxfxssebgknz foi criada public.oricse_drive_backup_outbox, com políticas RLS, índices de pendências e trigger de enfileiramento em 19 tabelas operacionais. Cada alteração confirmada nessas tabelas gera evento na mesma transação.

## Pendências obrigatórias ANTES de ativar o novo fluxo
1. Criar executor backend (Cloudflare Worker agendado) que leia eventos pendentes com credenciais de serviço e envie JSON versionado ao Drive, confirmando copiado_em apenas depois do upload. Incluir trava/lease, backoff, idempotência e logs; proteger credenciais no Worker.
2. Habilitar autenticação e RLS em **todas** as tabelas operacionais expostas aos clientes, garantindo separação por clinica_id e acessos específicos do portal do tutor.
3. Alterar src/integrations/supabase/client.ts, que atualmente direciona .from() e .rpc() ao Drive, após testar compatibilidade das consultas e RPCs.
4. Migrar src/lib/oricse-storage.ts, que atualmente salva chave/valor no Drive, para Supabase com isolamento por clínica e evitar gravar alterações somente em memória.
5. Inventariar módulos operacionais sem tabela específica e migrá-los sem perdas.
6. Garantir que a criação e leitura de todo PDF continuem apenas no Drive, sem armazenar bytes no Supabase.
7. Migrar os dados operacionais existentes no Drive com verificação de contagem e hashes; não desativar Drive como origem até a validação.
8. Testar simultaneidade, falhas de rede, exclusões, restauração e segurança entre clínicas; só então lançar em produção.

ATENÇÃO: trigger de outbox não realiza envio sozinho. Enquanto o executor não estiver instalado, eventos permanecem pendentes.
