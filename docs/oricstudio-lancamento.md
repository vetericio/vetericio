# OricStúdio — Checklist de lançamento

## Preços
Mensalidade-base: **R$ 29,90** com 1 Instagram incluído. Adicionais: **R$ 18,90/conta/mês**. Valores editáveis na Administração Geral, mas contratos já feitos não mudam automaticamente.

## Mercado Pago
- Secret da conta recebedora no Supabase: ORICSE_MP_ACCESS_TOKEN.
- Secret exclusiva para webhook do OricStúdio: ORICSTUDIO_MP_WEBHOOK_SECRET (não usar a secret dos planos principais).
- URL webhook: https://mwrmfcyrdxfxssebgknz.supabase.co/functions/v1/oricstudio-checkout?action=webhook
- Eventos: payment, subscription_preapproval e subscription_authorized_payment.
- Homologar uma assinatura de teste, débito aprovado/pendente, estorno, cancelamento, duplicação do webhook e renovação.
- Jamais liberar a licença pelo retorno do navegador; somente confirmação do pagamento consultado no MP.
- Só ativar comercializacao_ativa após a homologação real.

## Conciliação periódica
- Workflow GitHub Actions: .github/workflows/oricstudio-reconciliacao.yml (a cada 30 minutos).
- Criar a mesma chave aleatória de 32+ caracteres como ORICSTUDIO_RECONCILIATION_SECRET nos segredos do GitHub Actions e do Supabase.
- Sem as duas configurações, a rotina não roda efetivamente. Não enviar o segredo na conversa.
- A rotina consulta até 6 assinaturas por execução e as primeiras 30 faturas retornadas por assinatura.
- Monitoramento na Administração Geral e verificação sob demanda no OricStúdio complementam a rotina; ela ainda precisa ser validada com dados reais e paginação.
- O indicador de configuração no painel **não prova** que os webhooks foram homologados.

## Meta / Instagram
- Criar um aplicativo Meta distinto para o produto OricStúdio. Nunca compartilhar tokens com Gestor Instagram 2.0.
- Configurar no Cloudflare: ORICSTUDIO_META_CLIENT_ID, ORICSTUDIO_META_CLIENT_SECRET, ORICSTUDIO_META_REDIRECT_URI e ORICSTUDIO_META_ENCRYPTION_KEY.
- Redirect: https://oricse.vetericio.workers.dev/api/oricstudio/meta/callback
- Testar OAuth para duas clínicas e proteção cruzada. A API de publicação exige contas profissionais; contas pessoais podem usar editor e calendário sem automação.
- Agendamento e publicação automática ainda precisam de implementação e homologação.

## Critérios antes de abrir vendas
- Cobrança real homologada via Mercado Pago e credenciais em produção.
- Acesso por clínica, cancelamento, estorno e não duplicidade testados.
- Emissão e reconciliação das faturas com as URLs reais e dados reais.
- Alertas de falha e assistência disponíveis para clínicas e Administração Geral.
- Restrições comerciais e limite de contas consistentes em todos os fluxos.
- Não ativar a comercialização sem finalizar todos os itens.

Referências: https://www.mercadopago.com.br/developers/pt/docs/subscriptions/additional-content/your-integrations/notifications/webhooks
