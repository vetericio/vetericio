# Observações automáticas inteligentes e dois modos na lista

## 1. Frase automática que acompanha o campo

Ao digitar um valor fora da faixa, a frase "Animal com hipertermia em 07/08/2026 às 12:25." continua sendo inserida em Observações. A diferença:

- Se você apagar ou corrigir o valor antes de enviar, a frase correspondente àquele parâmetro é removida automaticamente.
- Se digitar outro valor ainda fora da faixa, a frase é reescrita com o novo termo e hora. Depois de enviar, a frase nunca é apagada automaticamente — nem se o valor voltar para a faixa normal; só sai se você apagar o texto manualmente.
- Frases escritas por você à mão nunca são apagadas — só as geradas pelo app.

## 2. Editando um registro já salvo

Quando o registro está em modo de edição e você altera um parâmetro (ex.: temperatura), aparece uma pergunta:

- **Substituir**: apaga a frase automática anterior daquele parâmetro e coloca a nova.
- **Acrescentar**: mantém a anterior e adiciona uma linha de atualização:
  `Temperatura foi atualizada às 12h para 40,2 °C.`

A pergunta aparece uma vez por parâmetro alterado, no momento da alteração.

## 3. Animais internados: dois botões diferentes

Cada card passa a ter:

- **Editar animal** — abre a ficha existente para corrigir dados daquele registro (comportamento atual).
- **Atualizar informações** — mostra a avaliação anterior do animal em modo somente leitura (não editável) no topo da ficha e abre campos vazios abaixo para acrescentar a nova informação, mantendo os dois valores no parâmetro (ex.: `Temperatura: 32,5 / 37,9`) e acrescentando em Observações a frase `Temperatura atualizada às 12h para 37,9 °C.`

Copiar e Excluir seguem como estão.

## Detalhes técnicos

- `src/lib/ficha.ts`: marcar frases automáticas com o parâmetro de origem (regex por termo de cada `ChaveNumerica`); novas funções `removerFraseDoParametro`, `fraseAtualizacao(chave, valor, especie)`.
- `src/components/FormAvaliacao.tsx`: em `setNumero`, recalcular observações — remover a frase antiga do parâmetro e inserir a nova quando fora da faixa; quando `editando`, abrir `AlertDialog` (substituir/acrescentar) antes de aplicar.
- `src/components/ListaRegistros.tsx`: novo prop `onAtualizar` e botão "Atualizar informações"; renomear botão para "Editar animal".
- `src/routes/registros.tsx`: `onAtualizar` grava `veterico-novo-de-id` no `localStorage` e navega para `/`.
- `src/routes/index.tsx`: ler `veterico-novo-de-id` e pré-preencher só `animal` + `especie`, sem `editandoId` e sem diálogo de duplicado.
