# Corrigir a sincronização entre aparelhos

## O que eu verifiquei

- A nuvem está funcionando: existem salas gravadas e a última gravação foi hoje, 02/09 às 06:18. Ou seja, subir e baixar dados está OK — o problema está na hora de **juntar** os dados no aparelho.
- Encontrei dois defeitos na lógica de junção que explicam exatamente "diz sincronizado, mas os dados não passam", mesmo no mesmo plantão.

## Causas encontradas

1. **Toda gravação local marca todos os animais como "recém-alterados".**
   A cada salvamento, o app reescreve a lista inteira e coloca a hora atual em todos os animais, não só no que mudou. Como a junção mantém "a versão mais nova", a cópia local sempre ganha e as alterações vindas do outro aparelho são descartadas.

2. **Animais do outro aparelho podem ser marcados como excluídos sem ninguém excluir.**
   O app trata "não está na lista que estou salvando agora" como exclusão definitiva. Se uma tela estava com a lista antiga (antes da sincronização) e você salva qualquer coisa, os animais que vieram do outro aparelho ganham marca de exclusão permanente e não voltam nunca — nem sincronizando de novo.

Um efeito colateral do mesmo mecanismo: "Limpar todos os dados" e "Finalizar plantão" marcam como excluídos para sempre todos os animais daquele plantão, o que apaga esses animais também no outro aparelho, mesmo que ele ainda esteja com o plantão em andamento.

## Correções

1. **Marcar hora só no que realmente mudou**
   - Comparar o conteúdo do animal (não a referência em memória) e atualizar a hora apenas quando algum campo mudou.
   - Assim, uma edição feita no aparelho B prevalece sobre uma cópia intocada no aparelho A.

2. **Só marcar exclusão quando a exclusão foi pedida**
   - Registrar marca de exclusão apenas nas ações explícitas: excluir um animal, "Limpar todos os dados" e finalizar plantão.
   - Salvamentos comuns deixam de apagar animais que simplesmente não estavam na tela.
   - Antes de gravar, a lista sempre parte do estado atual do aparelho, evitando gravar sobre uma lista velha.

3. **Exclusão x edição posterior**
   - Comparar a hora da exclusão com a hora da última alteração do animal: a exclusão só prevalece se for mais recente. Isso mantém "excluído não volta" e ao mesmo tempo permite recadastrar/atualizar o animal depois.

4. **Finalizar/limpar não apaga o plantão do outro aparelho**
   - Ao finalizar um plantão, marcar o plantão como encerrado (isso já existe) e não gerar marcas de exclusão por animal; a limpeza local acontece porque o plantão foi arquivado.
   - "Limpar todos os dados" continua sendo definitivo e propagado, como você pediu.

5. **Sinais claros na tela**
   - Mostrar na tela de Sincronização quantos animais/plantões vieram na última junção e avisar quando a sincronização automática estiver pausada por causa de um "Desfazer" (hoje isso fica escondido e parece que "não funciona").

## Validação

- Cadastrar um animal no aparelho A, sincronizar, e confirmar que ele aparece no B (e o contrário).
- Editar o mesmo animal nos dois aparelhos e confirmar que a última edição prevalece.
- Excluir no A, sincronizar duas vezes e recarregar: não volta.
- Finalizar plantão no A com o B ainda no mesmo plantão: o B recebe o plantão arquivado e não perde nada indevidamente.
- Testar offline: alterar sem internet e confirmar o envio quando a conexão voltar.

## Detalhes técnicos

Alterações em `src/hooks/useRegistros.ts` (comparação por conteúdo para `atualizadoEm`, remoção do tombstone implícito no setter, leitura do estado atual antes de gravar), `src/lib/sync.ts` (exclusão vence só se `excluidoEm > atualizadoEm`; `arquivarPlantao` sem tombstones por animal) e `src/hooks/useFinalizarPlantao.ts` / `src/routes/registros.tsx` (chamada explícita de exclusão nas ações que realmente apagam). Sem mudanças no banco.
