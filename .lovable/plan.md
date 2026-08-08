# Voltar o botão "Finalizar plantão"

## O que muda

Na página **Animais internados**, ao lado de "Limpar todos os dados", volta o botão **Finalizar plantão**.

Ao tocar nele:
1. Pede confirmação.
2. Salva os animais atuais como um plantão no histórico, com a data do aparelho e o turno escolhido (diurno/noturno).
3. Mantém apenas os 10 últimos plantões, descartando o mais antigo.
4. Limpa a lista de animais internados (começa a ficha nova).
5. Vai direto para a página **Plantões**, onde o plantão recém-fechado aparece no topo.

Se não houver nenhum animal registrado, avisa que não há nada para finalizar e não faz nada.

## Detalhes técnicos

- `src/routes/registros.tsx`: adicionar `finalizarPlantao` usando `usePlantoes()` e `usePlantaoAtual()`; monta `Plantao` (`id`, `data` = `diaDeHoje()`, `turno` = rótulo do plantão atual, `registros`, `criadoEm`), insere no início da lista e corta em `MAX_PLANTOES`; depois `setRegistros([])` e `navigate({ to: "/plantoes" })`.
- Botão renderizado apenas quando existem registros, com estilo secundário ao lado de "Limpar todos os dados".
- Nenhuma mudança em `src/lib/ficha.ts` ou na página de plantões.
