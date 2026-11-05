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
