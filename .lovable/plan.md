# Destaque vinho para parâmetros fora da faixa

Em **Animais internados**, os cards da lista devem deixar em **negrito na cor vinho** qualquer parâmetro numérico que esteja fora da faixa da espécie. O destaque também deve aparecer no PDF.

## O que muda

1. **Lista de animais internados**
   - `src/components/ListaRegistros.tsx` passa a renderizar cada linha do card como elemento, não mais como um único `<pre>`.
   - Linhas de parâmetros numéricos (`Temperatura`, `FC`, `FR`, `PAS`, `Glicemia`) são verificadas com `avaliarValor` sobre o **último valor** (caso tenha histórico).
   - Quando estiverem fora da faixa, a linha toda fica `font-bold` com cor vinho (`#722F37`).
   - Demais linhas e funcionalidades dos botões permanecem iguais.

2. **PDF**
   - `src/lib/pdf.ts` detecta as mesmas linhas numéricas durante a renderização.
   - Se o valor estiver fora da faixa, aplica `helvetica bold` + cor vinho (`114, 47, 55`) antes de imprimir a linha.
   - Após a linha, restaura a formatação padrão.

3. **Auxiliar compartilhado**
   - `src/lib/ficha.ts` exporta uma função pequena `linhaEstaForaDaFaixa(r: Registro, linha: string): boolean` que mapeia o rótulo da linha para a chave numérica e usa `avaliarValor`/`ultimoValor`.
   - Isso evita duplicar a lógica de parse e garante que lista e PDF usem o mesmo critério.

## Fora de escopo

- Nada muda nas abas, busca, ordenação, botões de ação, anamnese, curvas, alarmes, medicações, backup, temas, sons ou sincronização.
- Não se altera a aba **Animais em atenção**; ela já usa os tokens de destaque existentes.
