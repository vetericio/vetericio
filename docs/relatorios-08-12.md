# ORICSE · relatórios operacionais 08 a 12

Na página **Relatórios**, os relatórios 01–07 continuam na seção **Financeiros**. Os
relatórios 08–12 ficam em **Operacionais**, com o mesmo filtro de período (até 93 dias).
Não há escrita, alteração de agenda, baixa de pagamento ou mudança de tarifas.

| Nº | Relatório | Acesso necessário |
| --- | --- | --- |
| 08 | Ocupação e capacidade por agenda e profissional | Agenda da recepção |
| 09 | Faltas, cancelamentos e reagendamentos | Agenda da recepção |
| 10 | Fila, tempo de espera e conversão em atendimento | Agenda da recepção |
| 11 | Banho e tosa: produção, receita e cancelamentos | Visualização do hotelzinho e banho e tosa |
| 12 | Hotelzinho: ocupação, diárias, extras e pagamentos | Visualização do hotelzinho e banho e tosa |

Apenas a Veterício pode acessar o piloto, e só com vínculo ativo e a permissão
de origem do relatório. O backend valida a clínica e o vínculo de novo, inclusive
para administrador da plataforma. Dados de valores dos relatórios 11 e 12 exigem,
adicionalmente, a permissão de visualização financeira. As permissões existentes
continuam controlando os relatórios 01–07.

## Como ler os dados

- **08:** mede minutos de grade, bloqueios e ocupação. A capacidade histórica é
  baseada na grade cadastrada hoje, não em uma escala antiga presumida.
- **09:** a referência é a data agendada. Expiração de reserva não é falta.
  Sem desfecho ou mudança de horário registrada, o relatório não presume falta
  nem reagendamento.
- **10:** o tempo mensurável é da entrada na fila até a chamada. Chamada não
  comprova realização de consulta; a conversão clínica não é inferida sem vínculo.
- **11:** produção pela data de conclusão registrada; cancelamentos pela data
  prevista do agendamento. Recebimentos e estornos são mostrados separadamente,
  pelas datas registradas no caixa.
- **12:** separa reservas de ocupação real, diárias de check-outs de presença e
  cobranças de entradas no caixa. Quando não há vínculo do pagamento com a estadia,
  não atribui um recebimento ao hóspede.

## Verificação

- Consultar cada código na Veterício e conferir o período em desktop e mobile.
- Fazer a mesma consulta com um cargo de operação sem acesso financeiro, e checar
  que valores não são consultados nem retornados.
- Testar outra clínica, inclusive via chamada legítima direta ao endpoint de relatórios,
  com todas as permissões de origem; nenhum painel ou dado deve aparecer.
- Conferir estados de origem indisponíveis, período sem dados e dados legados incompletos.
- Não aplicar migração: o lote lê fontes existentes. Para reverter, reimplantar a
  versão anterior do aplicativo, com os relatórios 01–07.
