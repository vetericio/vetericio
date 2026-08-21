# Plantão que não se perde e alfabeto lateral na busca

## 1. Plantão lembrado até ser finalizado

Hoje o plantão escolhido é descartado quando o dia do aparelho muda (ou ao atualizar o app depois da meia-noite), e a pergunta "Diurno ou Noturno?" reaparece.

Passa a funcionar assim:

- O plantão escolhido fica guardado até você finalizar o plantão (ou usar "Alterar" no cabeçalho).
- Atualizar o app, fechar e reabrir, ou virar a meia-noite num plantão noturno não faz mais a pergunta aparecer.
- Ao tocar em "Finalizar plantão", o plantão é arquivado e a escolha é limpa — na próxima abertura o app pergunta de novo o turno.

## 2. Alfabeto lateral (estilo Niagara Launcher)

Na página Animais internados, à direita da lista, uma coluna pequena e vertical com as letras iniciais dos animais existentes:

- Só aparecem letras que realmente têm animal (sem letra, sem espaço vazio).
- Tocar numa letra rola até o primeiro animal com aquela inicial e destaca brevemente o card.
- Tocar de novo na mesma letra (ou apagar a busca) volta a mostrar tudo.
- A coluna acompanha a rolagem, discreta, sem cobrir os botões de ação dos cards.
- Ao digitar na busca, o alfabeto mostra apenas as letras dos animais filtrados.

## Detalhes técnicos

- `src/lib/plantao.ts`: `carregarPlantaoAtual()` deixa de comparar `escolhidoEm`/`dia` com `diaDeHoje()`; valida apenas o formato (`dia` + `turno` válido). `escolhidoEm` permanece salvo para compatibilidade.
- `src/hooks/usePlantaoAtual.ts`: expor `limparPlantao()` (chama `definir(null)`).
- `src/routes/registros.tsx`: em `finalizarPlantao`, usar `plantao?.dia ?? diaDeHoje()` como `data` do plantão arquivado e chamar `limparPlantao()` após salvar.
- Novo `src/components/IndiceAlfabetico.tsx`: recebe `letras: string[]`, `ativa`, `onSelecionar`; renderiza coluna `sticky top-24` com botões pequenos (`text-[10px]`).
- `src/routes/registros.tsx`: derivar letras da lista visível com a `normalizar` existente (primeira letra sem acento, maiúscula, apenas A–Z; outras entram em `#`), estado `letra`, layout `flex` com a lista à esquerda e o índice à direita; rolagem via `document.getElementById(\`animal-\${id}\`)?.scrollIntoView({ behavior: "smooth", block: "start" })`.
- `src/components/ListaRegistros.tsx`: adicionar `id={\`animal-\${r.id}\`}` no card para permitir a rolagem (sem outras mudanças).
