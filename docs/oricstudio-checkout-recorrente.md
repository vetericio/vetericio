# OricStúdio — Checkout recorrente (etapa 4/5)

Fluxo previsto:
1. A clínica solicita quantidade de contas; uma conta está incluída na mensalidade-base.
2. O servidor usa preço congelado na solicitação, nunca preço informado pelo navegador.
3. Checkout Mercado Pago cria assinatura mensal exclusiva do OricStúdio.
4. Retorno do navegador não libera o serviço.
5. Webhook só libera licença depois de confirmar pagamento aprovado, moeda BRL, assinatura e valor exato diretamente na API.
6. Registro de pagamento é idempotente.

Pendências de homologação:
- Definir preços antes de habilitar vendas.
- Configurar credenciais do Mercado Pago e destino de webhook para assinaturas, sem divulgar segredos no frontend.
- Verificar entrega real de notificações de pagamento de assinaturas pelo Mercado Pago.
- Testar cobrança em ambiente de homologação.
- Implementar conciliação de perda de webhook, cancelamento, estorno e inadimplência.
- Não alterar pagamentos dos planos principais do ORICSE.

Regra de lançamento: comercializacao_ativa=false até que webhook e conciliação tenham sido homologados.

## Conciliação e cancelamento (novembro de 2026)

- O webhook deve ser cadastrado no aplicativo Mercado Pago do OricStúdio com a secret **exclusiva** `ORICSTUDIO_MP_WEBHOOK_SECRET`. Não usar a secret do checkout principal ORICSE.
- Inscrever os eventos `payment`, `subscription_authorized_payment` e `subscription_preapproval`. Cada notificação é validada por HMAC e seguida de consulta real ao recurso Mercado Pago.
- O evento de **fatura autorizada** não equivale a pagamento: o OricStúdio confirma a transação real antes de ampliar o período.
- O gestor da clínica pode usar **Verificar situação com o Mercado Pago** para consultar as últimas faturas quando o webhook não tiver chegado.
- O gestor pode cancelar renovação futura; o pagamento já efetuado mantém acesso até vencer.
- Estornos do pagamento mais recente suspendem a licença e criam evento de auditoria.
- A Administração Geral exibe o histórico de pagamentos e de eventos financeiros em Monitoramento.
- A validação de código e os testes transacionais não substituem homologação real do checkout.
- Antes de ativar vendas, implementar também rotina **automática** de conciliação periódica (a ação manual não basta para operação em produção).

Os preços administrativos vigentes são R$ 29,90/mês com uma conta incluída + R$ 18,90/mês por conta adicional. A tabela pode ser editada posteriormente sem alterar automaticamente valores já registrados em contratos.
