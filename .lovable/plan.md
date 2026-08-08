# Finalizar plantão, 50 plantões e data por extenso no PDF

## 1. Botão "Finalizar plantão"

Na página **Animais internados**, ao lado de "Limpar todos os dados", volta o botão **Finalizar plantão**.

Ao tocar nele:
1. Pede confirmação.
2. Salva os animais atuais como um plantão no histórico, com a data do aparelho e o turno escolhido (diurno/noturno).
3. Limpa a lista de animais internados (começa a ficha nova).
4. Vai direto para a página **Plantões**, onde o plantão recém-fechado aparece no topo.

Se não houver nenhum animal registrado, avisa que não há nada para finalizar e não faz nada.

## 2. Histórico de 50 plantões

O app passa a guardar os **50 últimos plantões** (antes eram 10). O texto da página Plantões é atualizado para "Ficam guardados os 50 últimos plantões neste aparelho".

## 3. Data por extenso no PDF

A linha do plantão no PDF passa a usar a data escrita:

- `Plantão diurno - 8 de agosto de 2026`
- `Plantão noturno - 8 de agosto de 2026`

Quando não houver turno escolhido, sai apenas a data por extenso do dia.

## Detalhes técnicos

- `src/routes/registros.tsx`: adicionar `finalizarPlantao` usando `usePlantoes()` e `usePlantaoAtual()`; monta o `Plantao` (`id`, `data` = `diaDeHoje()`, `turno`, `registros`, `criadoEm`), insere no início e corta em `MAX_PLANTOES`; depois `setRegistros([])` e `navigate({ to: "/plantoes" })`.
- `src/lib/ficha.ts`: `MAX_PLANTOES` = 50.
- `src/lib/plantao.ts`: nova função `rotuloPlantaoPdf(p)` que formata `"Plantão <turno> - <data por extenso>"` via `toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })`.
- `src/lib/pdf.ts`: usar `rotuloPlantaoPdf` para a legenda (mantendo o fallback de data por extenso); o rótulo com seta deixa de ser usado no PDF.
- `src/routes/plantoes.tsx`: legenda do PDF de cada plantão arquivado também por extenso; texto de 10 → 50.
