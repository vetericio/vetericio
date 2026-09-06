# Por que os alarmes e a anamnese voltam

Ao finalizar o plantão, o aparelho apaga tudo certo: alarmes, curvas, anamneses e bloco de notas são zerados.

O problema é a sincronização entre aparelhos. Hoje ela só sabe **juntar** o que existe nos dois aparelhos: item que existe em um e não existe no outro é sempre acrescentado. Como o outro aparelho (ou a última cópia enviada) ainda tem as 13 anamneses e os alarmes, na sincronização seguinte eles são reenviados e reaparecem — parece que "não apagou".

# O que vou mudar

1. **Registro de apagados**: quando algo é apagado neste aparelho, guardo a marca "este item foi apagado às tal hora". Na sincronização, o item apagado não volta, e o outro aparelho também o apaga.
2. **Fim de plantão vira um evento sincronizado**: ao finalizar, os dois aparelhos limpam alarmes, curvas, anamneses e bloco de notas do plantão que terminou. O plantão arquivado no histórico continua intacto.
3. Nada é apagado por engano: fichas, plantões salvos, medicamentos, configurações e temas seguem exatamente como estão. Apenas o que foi apagado de propósito deixa de voltar.

# Detalhes técnicos

- `src/lib/backup.ts`: nova chave `veterico-sync-apagados-v1` com pares `chave:id → timestamp` (tombstones). `montarBackup()` passa a enviar esses registros; `juntarPorId()` passa a descartar item remoto cujo tombstone local seja mais recente que o carimbo remoto, e a remover item local quando o tombstone remoto for mais recente. Tombstones antigos (>30 dias) são descartados.
- Novo helper `marcarApagados(nome, ids)` em `backup.ts`, chamado onde hoje se apaga: `useFinalizarPlantao.ts` (curvas, alarmes, anamneses), exclusão individual de anamnese, exclusão de alarme/curva e "apagar todos os registros".
- Para os campos simples (`notas`) o tombstone é guardado como `simples:notas`, respeitando o mesmo critério de data.
- `useFinalizarPlantao.ts`: além de limpar, grava o marco `finalizadoEm` do plantão nos carimbos, para que o outro aparelho aplique a limpeza ao sincronizar.
- Sem mudança de layout, de rotas ou de qualquer cálculo.
