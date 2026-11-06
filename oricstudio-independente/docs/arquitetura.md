# Arquitetura e segurança

## Componentes

```
Navegador (painel React)  ──server functions──►  Servidor (TanStack Start, Lovable)  ──Graph API──►  Meta
        │  leitura com RLS                                  ▲    │ service role
        ▼                                                   │    ▼
   Lovable Cloud (Postgres + Auth + Storage) ◄──── pg_cron + pg_net (agendador no banco)
                                                            ▲
Assistente local (tools/assistente.mjs) ──API do assistente─┘
```

- **Painel**: lê dados direto do banco com a sessão do usuário (RLS por papel). Toda escrita sensível passa por funções de servidor, que validam papel, regras, pausa geral e limites do Instagram.
- **Servidor**: integra com a Meta usando os tokens das Páginas (criptografados em AES-256-GCM com `TOKEN_ENCRYPTION_KEY`). O navegador nunca recebe tokens.
- **Agendador**: `pg_cron` dentro do banco chama os endpoints de job com um token guardado no Vault (nunca sai do banco em texto). Funciona com o navegador fechado e o celular desligado.

| Job (pg_cron) | Frequência | O que faz |
|---|---|---|
| `fila-publicacao` | a cada minuto | Publica o que venceu, registra batimento, alerta aprovação pendente e fila atrasada |
| `coleta-metricas` | de hora em hora (min. 5) | Seguidores, insights diários (6 em 6h), mídias, insights por mídia, stories, comentários, alertas de métricas |
| `verificacao-conexoes` | diário 09:00 (Brasília) | Valida tokens e permissões, testa leitura de cada conta, alertas de conexão e expiração |
| `relatorios` | diário 09:10 (Brasília) | Relatório diário; semanal às segundas; mensal no dia 1º (consolidado e por marca) |

## Fila de publicação (garantias)

1. `claim_due_posts` reserva posts vencidos com `FOR UPDATE SKIP LOCKED` e prazo de reserva: duas execuções nunca pegam o mesmo post.
2. Cada passo é salvo antes do próximo (itens de carrossel → container → processamento → publicação).
3. Antes de chamar `media_publish`, a tentativa é registrada. Se a resposta da Meta se perder, o post vira **resultado desconhecido** e a próxima execução consulta o status do container: `PUBLISHED` confirma sem republicar; `FINISHED` comprova que não saiu e publica.
4. Só é marcado **publicado** com confirmação da Meta; o link (permalink) é gravado.
5. Erros temporários: novas tentativas com espera crescente (1, 2, 5, 15, 30 min). Erros definitivos: **falhou**, alerta e registro. N falhas seguidas suspendem a automação da conta.
6. Cota de publicação é consultada antes de publicar; se esgotada, adia 1h.

Estados: rascunho → aguardando aprovação → agendado → processando → publicado | falhou | resultado desconhecido.

## Modos de autonomia

| Modo | Pessoas (admin) | Assistente | Comentários |
|---|---|---|---|
| Assistido | Agendam/publicam | Tudo vai para aprovação | Só manual |
| Automático com regras | Agendam/publicam (regras viram avisos) | Agenda sozinho dentro das regras; fora delas, aprovação | Só manual |
| Gestão ampliada | Idem | Idem | Respostas automáticas opcionais (elogio, pergunta, interesse comercial), nunca para reclamação ou caso sensível |

Sempre exigem ação humana: excluir publicações (o sistema não exclui), gastos com anúncios (não implementado), mensagens em massa (não implementado), ocultar comentários. A **pausa geral** interrompe fila, publicação imediata e respostas automáticas sem apagar nada.

## Segurança

- Login por e-mail/senha (Supabase Auth), sem cadastro público; primeiro usuário vira admin uma única vez.
- Papéis em `user_roles` (admin, editor, leitor) com funções `has_role`/`can_edit` (security definer) e RLS em todas as tabelas.
- Tabelas sensíveis (`meta_tokens`, `oauth_states`, `assistant_keys`) inacessíveis ao navegador.
- OAuth com `state` aleatório de uso único (hash no banco, expira em 10 min); tokens nunca vão em URLs, logs ou respostas.
- Exclusão de dados da Meta: assinatura HMAC-SHA256 validada com o app secret; código de acompanhamento público.
- Jobs autenticados por token do Vault (ou `LOVABLE_CRON_SECRET`). Assistente autenticado por chave local (só o hash SHA-256 no banco; revogável em Configurações).
- Auditoria (`audit_log`) de conexões, configurações, pausa, publicações, aprovações, respostas e ações do assistente.
- Validação de entradas com zod em todas as funções de servidor e APIs.

## Dados e LGPD

Dados tratados: e-mail da equipe, dados de perfil das contas profissionais autorizadas, tokens (cifrados), publicações, métricas e comentários públicos das próprias contas. Retenção: enquanto a conta estiver conectada; métricas da Meta ficam disponíveis por até 2 anos na API e o histórico coletado fica no banco. Desconectar apaga os tokens e revoga as permissões; o retorno de exclusão da Meta apaga conexões e contas do usuário Meta. A política está em `/privacidade`.
