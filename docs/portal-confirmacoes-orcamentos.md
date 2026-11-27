# Portal do Tutor: confirmações e orçamentos

## Agenda

- Na aba **Agenda** do portal oficial e com sessão ativa, o tutor confirma a presença em um horário já confirmado pela clínica, ou registra um pedido de reagendamento. Essa confirmação complementar não altera a reserva, o status clínico, o pagamento nem o horário.
- Em **Todas as agendas → Respostas do Portal do Tutor**, a equipe com `recepcao.agenda` vê as confirmações e responde aos pedidos. Uma resposta é visível no portal e não troca o horário. Se a clínica acordar um horário diferente, deve atualizá-lo pelo fluxo normal da agenda.
- A confirmação pertence ao horário apresentado. Ao mover a marcação pelo fluxo normal, a confirmação antiga permanece no histórico e não é aplicada automaticamente ao novo horário.
- O histórico devolve até 150 eventos principais por consulta; pedidos sem resposta têm prioridade e, quando um pedido listado já foi respondido, sua resposta acompanha o evento.

## Orçamento

- No editor de orçamento da Venda Expressa, selecione tutor e animal vinculados e use **Compartilhar no Portal do Tutor**. É separado da geração de PDF/JPEG e do registro de indicadores financeiros; propostas externas ou antigas sem uma lista persistida de itens não podem ser convertidas por este fluxo.
- O servidor confirma o catálogo ativo da mesma unidade, recalcula o preço por item/faixa e só guarda a proposta se os valores conferirem com o que a equipe revisou. O tutor visualiza os itens em **Financeiro → Orçamentos compartilhados pela clínica** e aprova especificamente a proposta ainda válida.
- Em **Comandas → Orçamentos do Portal do Tutor**, uma pessoa autorizada seleciona **Gerar comanda**. A operação é atômica e vincula uma comanda única ao orçamento aprovado. Itens e preços não são recalculados depois da aprovação. O histórico mostra compartilhamento, aprovação e conversão. A lista devolve até 100 propostas, priorizando as aprovadas pendentes de conversão para a equipe.
- As ações não enviam mensagens, não cobram e não registram venda, estoque, documento fiscal ou entrada no Caixa. Recebimentos posteriores, se houver, usam o registro explícito do Caixa que já existe para comanda canônica.

## Isolamento e homologação

Há autorização de unidade e papel no banco, vínculos tutor/paciente conferidos em cada operação do Portal, e tabelas novas com RLS e sem acesso direto pelo papel autenticado. O ambiente de demonstração não grava.

A migração deve preceder o front-end em homologação. Exercitar com duas clínicas e mais de um tutor, usando dados artificiais. Não aplicar diretamente em produção nem remover a migração para desfazer uma interface já usada: isso perderia o histórico de confirmações/propostas. Em reversão, desabilitar as novas entradas da interface, compatibilizar a consulta de comandas com o estado do esquema e preservar os dados até uma decisão explícita.
