# Guia de manutenção

## Deploy

1. Altere o código localmente, rode `npx tsc --noEmit` e `npm test`.
2. `git push` na `main` → o Lovable sincroniza automaticamente (não gasta créditos).
3. Publique: no editor do Lovable, botão **Publicar** (ou a ação de deploy da integração do Lovable). Secrets novos só valem no site publicado depois de publicar de novo.
4. Confira: `curl -X POST https://gestor-insta-vetericio.lovable.app/api/public/jobs/publish-queue` deve responder **401** (rota existe e exige token).

Não reescreva o histórico da `main` (force push/rebase): o Lovable perde o histórico.

## Banco de dados

- Migrações versionadas em `drizzle/migrations/`. Aplique o SQL pelo Lovable Cloud (editor SQL do Cloud) ou pela integração do Lovable (`query_database`) e registre o arquivo no repositório.
- Depois de mudar o schema, atualize `src/integrations/supabase/types.ts` (o Lovable também o regenera).
- Toda tabela nova: `ENABLE ROW LEVEL SECURITY`, políticas por papel e, se for sensível, sem permissão para `authenticated`.

## Agendador

```sql
select jobname, schedule, active from cron.job;                                   -- jobs
select status, start_time from cron.job_run_details order by start_time desc limit 20;  -- execuções
select status_code, left(content, 200), created from net._http_response order by created desc limit 10; -- respostas do servidor
```

Se a fila parar: confira se os jobs estão `active`, se o site publicado responde e se `app_settings.ultimo_ciclo_fila` está avançando. O token dos jobs fica no Vault (`jobs_token`); para trocá-lo: `select vault.update_secret((select id from vault.secrets where name='jobs_token'), encode(gen_random_bytes(32),'hex'));`.

## Secrets

Lovable Cloud → Secrets. Rotação:
- `META_APP_SECRET`: Meta for Developers → Configurações do app → Básico → Redefinir; atualize o secret e publique.
- `TOKEN_ENCRYPTION_KEY`: trocar invalida os tokens guardados; depois de trocar, use “Reconectar” em cada conexão.
- Chave do assistente: revogue em Configurações; gere outra com `node tools/assistente.mjs criar-chave --substituir` e registre o hash: `insert into assistant_keys (nome, key_hash) values ('nome-do-pc', '<hash>');`.

## Tokens da Meta

A conexão atual não tem data de expiração informada pela Meta. A verificação diária alerta 7 dias antes se uma data aparecer, e alerta imediatamente se o token for revogado. Correção: Contas conectadas → Reconectar.

## Versão da Graph API

O padrão é `v24.0` (secret `META_GRAPH_VERSION`). A Meta mantém cada versão por cerca de 2 anos; acompanhe o changelog (developers.facebook.com/docs/graph-api/changelog), teste a nova versão no preview e troque o secret. Métricas descontinuadas devem sair de `src/lib/metrics.ts`.

## Rotina sugerida

- Semanal: revisar Alertas e Histórico (falhas), conferir relatório semanal.
- Mensal: conferir uso do Lovable Cloud (banco e storage), apagar mídias antigas se necessário, revisar acessos (Funções do app na Meta, usuários do sistema, chaves do assistente).
