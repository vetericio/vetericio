# Relatório 23: compras de controlados e pendências

- Piloto exclusivo da Veterício. Quem pode consultar o catálogo vê o relatório
  e as pendências. Para registrar ou concluir uma compra também precisa da
  permissão de movimentação. As permissões são confirmadas no servidor.
- Em **Registrar compra**, escolha um produto do catálogo e informe a data e
  a quantidade comprada, fornecedor, número/identificador da nota fiscal e lote.
  O sistema grava quem registrou pela conta autenticada, sem digitação manual.
- **Salvar pendência** permite completar os dados depois. A aba **Pendências**
  mostra os campos faltantes e abre o registro certo para edição. A conclusão
  exige os campos completos; registros concluídos ficam somente para leitura.
- **Consultar relatório** separa compras completas, pendências e movimentos
  gerais de estoque. O relatório não cria compras a partir de entradas antigas.
- Esta função não altera o saldo, não reclassifica produtos automaticamente e
  não substitui documentos fiscais ou controle oficial. A nota fiscal é
  registrada pelo identificador; o arquivo não é anexado neste fluxo.
- Antes de publicar: aplicar a migração aditiva no ambiente certo; usar
  dados fictícios para validar edição, conclusão, ausência de efeito no
  estoque, leitura e bloqueio por clínica. Para reverter, restaurar a versão
  anterior do app e manter os registros de compras no banco.
