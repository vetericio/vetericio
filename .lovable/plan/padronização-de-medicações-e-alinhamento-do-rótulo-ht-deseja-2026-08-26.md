# Padronização de medicações e alinhamento do rótulo Ht desejado

## Objetivo
Ajustar a entrada de medicações para campos padronizados e corrigir o alinhamento do rótulo "Ht desejado (%)" na transfusão sanguínea.

## 1. Duração padronizada

- Em `src/components/Medicacoes.tsx`, substituir o campo livre de duração por um seletor (`<select>`) com as opções:
  - `8h`
  - `12h`
  - `24h`
  - `48h`
  - `7 dias`
  - `outros`
- Quando selecionar `outros`, exibir um campo de texto ao lado para preenchimento livre.
- O valor salvo continua sendo uma string simples em `Medicacao.duracao`, mantendo compatibilidade com leitura de foto, edição e geração de texto/PDF.

## 2. Quantidade com unidade ao lado

- No formulário de medicação, dividir a dose em duas partes na interface:
  - Campo numérico/texto para a **quantidade**.
  - Seletor de unidade logo ao lado com as opções `mL` e `cápsula/comprimido`.
- Internamente, a quantidade e a unidade são combinadas em uma única string `Medicacao.dose` (ex.: `"0,5 mL"`, `"1 cápsula/comprimido"`).
- A listagem, a foto (IA e OCR) e o texto exportado continuam usando o campo `dose` normalmente, sem alterar o tipo `Medicacao`.

## 3. Alinhamento do rótulo Ht desejado (%)

- Em `src/components/TransfusaoSanguinea.tsx`, corrigir o rótulo `"Ht desejado (%)"` para que o `(%)` fique na mesma linha do texto, mesmo em telas estreitas.
- Solução: aplicar `whitespace-nowrap` ou usar layout flex no `<span>` do rótulo, evitando quebra de linha entre "Ht desejado" e "(%)", sem alterar os demais rótulos.

## Arquivos alterados

- `src/components/Medicacoes.tsx`
- `src/components/TransfusaoSanguinea.tsx`

## Não alterar

- `src/lib/ficha.ts`: o tipo `Medicacao` permanece `{ nome: string; dose: string; duracao: string }` para não quebrar leitura de foto, histórico e PDF.
- `src/lib/medicacoes.functions.ts`: a IA continua devolvendo strings livres em dose e duração.
- Lógica de cálculo da transfusão em `src/lib/transfusao.ts`.
