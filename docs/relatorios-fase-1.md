# Relatórios ORICSE: primeira entrega financeira (01 a 07)

Piloto restrito à Veterício. Acesse **Relatórios** no menu da Veterício. Cada consulta usa a clínica selecionada e até 93 dias.
A clínica do piloto e a permissão financeira são verificadas no servidor antes de ler ou gravar dados de relatórios. As demais clínicas continuam com o módulo bloqueado.
Os relatórios 08 a 30 não fazem parte desse lote.

| Nº | O que está disponível |
|---|---|
| 01 | Faturamento bruto por setor, itens identificados na Venda Expressa e recebimentos de consulta por profissional quando há vínculo registrado. Os últimos dois recortes não são totais adicionais. |
| 02 | Entradas, saídas pagas por categoria, estornos confirmados e resultado dos lançamentos. Sem inventar custo histórico por item, margem ou lucro contábil. |
| 03 | Aberturas e fechamentos por operador, fundo, esperado, contado e divergência registrada. |
| 04 | Saldo atual de comandas abertas e entradas manuais pendentes da origem no período, sem incluir pendências anteriores à data inicial. Sem vencimento registrado, não classifica pendência como inadimplência. |
| 05 | Saídas pendentes, movimentação realizada e projeção pelo que foi registrado no caixa. Competência de um pendente não é vencimento. Não calcula saldo bancário. |
| 06 | Conferência dos pagamentos do portal vinculados ao caixa, valores de taxa e repasse registrados, baixas e estornos. Não declara conferência com extrato bancário. |
| 07 | Orçamentos registrados para acompanhamento, vendas e comandas. Um gestor pode relacionar uma venda existente posterior ao orçamento, dentro da mesma clínica. Não cria venda, pagamento ou baixa de estoque. Só entram orçamentos registrados para acompanhamento. A conversão da lista filtrada pela data de registro é acumulada até hoje e inclui venda posterior ao período. |

## Homologação e rollback

1. Aplicar a migração aditiva de orçamentos somente em homologação e testar com duas
   clínicas fictícias. Validar acesso financeiro, negação de acesso sem vínculo,
   isolamento nas referências de orçamento e venda e unicidade de cada vínculo.
2. Testar filtros em desktop/mobile, ausência de dados, mais de 500 registros,
   competência na virada de dia, pagamento baixado fora da competência, estorno,
   transferência de período e 01/06 com IDs faltantes. Conferir os totais com o
   caixa e validar os limites de cada relatório com a área financeira.
3. Emitir revisão independente antes de publicar. Nada no código muda preços,
   pagamentos, repasses, taxas ou a regra de fechar o caixa. A gravação de orçamento
   afeta apenas a base de acompanhamento e não atende a campanhas do CRM.
4. Reverter a versão de aplicativo se necessário. Não apagar a tabela de acompanhamento
   se já houver registros. A rotina anterior de PDF, impressão e envio continua disponível.

Testes locais: `node --test tests/relatorios{,-acesso}.test.*`, typecheck, build,
guardas de autorização e credenciais.
