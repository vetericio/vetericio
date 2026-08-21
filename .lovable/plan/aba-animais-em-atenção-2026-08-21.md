# Aba "Animais em atenção"

Em **Animais internados**, a lista passa a ter duas abas no topo:

- **Todos** — a lista atual, igual ao que já existe (busca, alfabeto lateral, botões de ação).
- **Animais em atenção** — só os animais com pelo menos um parâmetro fora da faixa da espécie.

## Como a aba de atenção funciona

- Cada animal aparece como um card compacto: nome + emoji da espécie (e marcação de óbito, quando houver).
- Abaixo do nome, só os parâmetros alterados, em "etiquetas" fáceis de ler:
  - seta para baixo + cor azul quando está **abaixo** da faixa (ex.: `↓ Temperatura 36,8 °C — abaixo (37,5–39,5)`);
  - seta para cima + cor vermelha quando está **acima** da faixa (ex.: `↑ FC 210 bpm — acima (60–180)`);
  - FR igual a zero aparece como `apneia`.
- Junto vem o termo clínico já usado no app (hipotermia, taquicardia, hipoglicemia, etc.).
- Quando o parâmetro tem histórico (ex.: `37,2 / 39,8`), a avaliação usa o **último valor** medido.
- O contador da aba mostra quantos animais estão em atenção (ex.: `Animais em atenção (3)`).
- Os mesmos botões de ação (Copiar, Editar, Atualizar, Óbito, Excluir) ficam disponíveis nos cards.
- Se ninguém estiver fora da faixa: mensagem "Nenhum animal com parâmetro alterado agora."

Nada muda no PDF, nas curvas, nos alarmes ou nos plantões.

## Detalhes técnicos

- Em `src/lib/ficha.ts`: nova função que, dado um `Registro`, devolve a lista de alterações
  `{ chave, rotulo, valor, unidade, direcao: "abaixo" | "acima", termo, faixa }`, reaproveitando
  `FAIXAS`, `ROTULOS_NUMERICOS`, `avaliarValor` e tomando o último valor de campos mesclados.
- Novo componente `src/components/AnimaisAtencao.tsx` renderizando os cards e as etiquetas com
  tokens semânticos de cor (`destructive` para acima, um token de destaque frio para abaixo).
- Em `src/routes/registros.tsx`: `Tabs` do shadcn envolvendo a lista atual e a nova aba, com os
  handlers de ação já existentes reaproveitados.
