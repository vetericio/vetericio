# Sincronização por plantão e exclusões definitivas

## Objetivo

Impedir que animais excluídos reapareçam e evitar que plantões abertos de dias diferentes sejam misturados durante a sincronização.

## Alterações

1. **Identificar cada plantão**
   - Dar a cada plantão aberto um identificador próprio e horários precisos de abertura/atualização.
   - Vincular cada animal ao plantão em que foi cadastrado.
   - Migrar de forma compatível os plantões e animais já salvos no aparelho, sem apagar dados existentes.

2. **Separar plantões durante a sincronização**
   - Se os dois aparelhos estiverem no mesmo plantão (mesma data e turno), unir normalmente os animais e atualizações.
   - Se houver plantões diferentes, arquivar automaticamente o mais antigo no histórico, com seus animais e curvas, e manter o mais recente como plantão ativo.
   - Usar o identificador do plantão arquivado para impedir cópias duplicadas no histórico quando os aparelhos sincronizarem novamente.
   - Uma finalização sincronizada será definitiva: uma cópia antiga não poderá reabrir o plantão.

3. **Propagar exclusões**
   - Registrar internamente cada exclusão com o ID do animal e a data/hora, em vez de representar a exclusão apenas pela ausência na lista.
   - Sincronizar esses registros de exclusão e fazê-los prevalecer sobre versões mais antigas do mesmo animal.
   - Aplicar isso à exclusão individual, “Limpar todos os dados” e à limpeza após finalizar/arquivar um plantão.
   - Manter os registros técnicos de exclusão invisíveis na interface e fora dos PDFs.

4. **Resolver atualizações concorrentes**
   - Registrar `atualizadoEm` nas alterações dos animais para comparar versões corretamente.
   - Manter a versão mais recente de cada animal quando o mesmo plantão for usado nos dois aparelhos.
   - Ajustar a restauração por backup no modo “juntar” para também respeitar exclusões, evitando que um backup antigo ressuscite um animal apagado.

5. **Atualizar a tela após sincronizar**
   - Recarregar os estados compartilhados de animais, plantão e histórico após a mesclagem, sem depender de atualizar manualmente a página.
   - Manter o comportamento offline: mudanças e exclusões ficam pendentes e são enviadas quando a internet voltar.

## Validação

- Excluir um animal no aparelho A, sincronizar A e B e confirmar que ele não reaparece após recarregar ou sincronizar novamente.
- Repetir com exclusão total e com finalização de plantão.
- Abrir plantões de datas diferentes em A e B; confirmar que o mais antigo vai uma única vez para o histórico e o mais recente fica ativo.
- Abrir o mesmo plantão em A e B; confirmar que os animais são unidos sem duplicação.
- Editar o mesmo animal em aparelhos diferentes e confirmar que a alteração mais recente prevalece.
- Testar a fila offline, o desfazer da sincronização e a importação de backup existente.

## Detalhes técnicos

A correção continuará usando o armazenamento local e o JSON já salvo no backend. Serão adicionados metadados compatíveis (`plantaoId`, `atualizadoEm`, marcações de exclusão/finalização) e uma mesclagem determinística; não é necessária mudança de tabela no banco.
