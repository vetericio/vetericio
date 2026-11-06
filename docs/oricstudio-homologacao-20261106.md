# Homologação OricStudio — 06/11/2026

## Banco e segurança: aprovado em simulação transacional
- Duas clínicas temporárias, testes de RLS de leitura cruzada, mídia e conta não transferíveis.
- Simulação de licença inicialmente inativa, pagamento por service_role, bloqueio para authenticated,
  replay do mesmo ID não gera duplicação, licença suspensa retira acesso.
- Todos os dados temporários foram revertidos por ROLLBACK.
- Banco contém zero clientes/contas Instagram/pagamentos reais. Não confundir simulação com produção.

## Verificações externas pendentes
- Instagram profissional: app Meta exclusivo, OAuth, consentimento real, token, refresh e 1 post autorizado.
- Mercado Pago: webhook assinado, cobrança de homologação real/sandbox, estorno, renovação e idempotência.
- Cloudflare + GitHub Actions: ORICSTUDIO_CRON_SECRET idêntico e forte.
- Gateway: ORICSTUDIO_MIDIA_SIGNING_KEY privada.
- Conciliação: ORICSTUDIO_RECONCILIATION_SECRET nos segredos do GitHub + Supabase.
- Não ativar ORICSTUDIO_PUBLICACAO_HOMOLOGADA, ORICSTUDIO_COLETA_HOMOLOGADA
  ou oricstudio_produto.comercializacao_ativa até todos os testes externos serem aprovados.

## Painel
Administração Geral > OricStudio > Homologação expõe apenas sinalizadores, sem segredos.

O Gestor Instagram 2.0 original não compartilha contas, chaves nem API com o OricStudio.
