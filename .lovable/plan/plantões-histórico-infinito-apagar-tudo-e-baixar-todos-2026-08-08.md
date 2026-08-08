# Plantões: histórico infinito, apagar tudo e baixar todos

## O que muda

1. **Sem limite de plantões** — o app passa a guardar todos os plantões fechados, sem descartar os mais antigos.
2. **Apagar todos os plantões** — botão vermelho no topo da página Plantões, com **4 confirmações em sequência**, cada uma com texto diferente e mais sério:
   - 1: "Apagar todos os plantões salvos?"
   - 2: "Tem certeza? Isso remove o histórico completo."
   - 3: "Esta ação é permanente e não pode ser desfeita."
   - 4: "Última confirmação: apagar para sempre?"
   Se qualquer uma for cancelada, nada é apagado. Sugestão: exportar antes.
3. **Baixar todos os plantões** — botão que gera **um PDF por plantão**, na ordem do mais recente para o mais antigo, cada arquivo com a data/turno daquele plantão no cabeçalho e nome como `veterico-plantao-<data>.pdf`. Mostra progresso ("2 de 7…") e um aviso caso o navegador bloqueie downloads múltiplos.

## Detalhes técnicos

- `src/lib/ficha.ts`: remover o uso de `MAX_PLANTOES` como corte (manter constante apenas se referenciada, ou remover a referência).
- `src/routes/registros.tsx`: em `finalizarPlantao`, salvar `[novo, ...ps]` sem `.slice(0, MAX_PLANTOES)`.
- `src/routes/plantoes.tsx`:
  - Atualizar o texto informativo para "Todos os plantões ficam guardados neste aparelho".
  - `apagarTodos()`: 4 `window.confirm` encadeados → `setPlantoes([])` + toast.
  - `baixarTodos()`: laço sequencial chamando `exportarPdf` com `legenda: rotuloPlantaoPdfDe(p.data, p.turno)` e pequeno intervalo entre downloads; desabilita o botão enquanto roda.
