# Backup e recuperação

## O que precisa de backup

| Item | Onde está | Como é protegido |
|---|---|---|
| Código | GitHub `vinibruxin/gestor-de-contas-instagram` | Histórico git + cópia no Lovable |
| Banco (contas, publicações, métricas, relatórios, auditoria) | Lovable Cloud (Postgres) | Backups do provedor conforme o plano + exportação manual mensal |
| Mídias enviadas | Storage, bucket `midia` | Originais continuam na pasta do computador (ex.: Documentos\Instagram) |
| Secrets | Lovable Cloud → Secrets | Lista de nomes em `.env.example`; valores recuperáveis no painel da Meta (exceto `TOKEN_ENCRYPTION_KEY`) |
| Chave do assistente | `%USERPROFILE%\.gestor-instagram` | Pode ser recriada a qualquer momento |

## Exportação manual (mensal)

No Lovable Cloud → Database, exporte as tabelas importantes em CSV (`posts`, `post_events`, `media_assets`, `ig_media`, `metric_snapshots`, `reports`, `brands`, `regras_publicacao`, `audit_log`) e guarde em uma pasta do OneDrive. Tokens (`meta_tokens`) não precisam de backup: em caso de perda, basta reconectar.

## Recuperação

| Cenário | Passos |
|---|---|
| Site fora do ar após deploy | Lovable → histórico de versões → restaurar a versão anterior e publicar; ou `git revert` do commit e push |
| Banco perdido/corrompido | Restaurar backup do provedor; reaplicar `drizzle/migrations/` em ordem se for um banco novo; recriar o administrador pela configuração inicial; reconectar a Meta; reagendar posts a partir dos CSV |
| Secret apagado | Recriar no Lovable Cloud (valores da Meta no painel); se for a `TOKEN_ENCRYPTION_KEY`, gerar uma nova e reconectar as contas |
| Token revogado | Contas conectadas → Reconectar |
| Fila travada | Ver [manutenção → agendador](manutencao.md#agendador); posts “resultado desconhecido” se resolvem sozinhos sem republicar |

## Resposta a incidentes

1. Suspeita de acesso indevido: ative a **pausa geral**, revogue chaves do assistente, troque senhas dos usuários, desconecte a Meta (revoga permissões) e redefina `META_APP_SECRET`.
2. Analise `audit_log` (Atividades) para entender o que foi feito e por quem.
3. Reconecte, revise as publicações agendadas e só então retome a automação.
4. Se houver dados pessoais envolvidos, avalie a comunicação aos titulares e à ANPD (LGPD, art. 48).
