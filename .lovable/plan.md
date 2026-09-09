# Mostrar dose e mL ao adicionar medicação

## O que está acontecendo

Na tela da ficha, o bloco de medicações abre no modo rápido ("Adicionar várias de uma vez (só o nome)"), que é exatamente o da sua imagem. Nesse modo existem apenas os campos de nome — a dose padrão editável e o volume em mL só aparecem no formulário completo, depois de escolher a medicação na lista de sugestões.

Ou seja: o cálculo existe e funciona, mas está escondido no modo em que você está usando.

## O que vou fazer

- No modo rápido, ao digitar/escolher uma medicação cadastrada, mostrar logo abaixo do campo:
  - a dose padrão cadastrada, já editável para este atendimento (sem mexer no cadastro);
  - o volume em mL calculado na hora com o peso da ficha;
  - a conta visível (peso × dose ÷ concentração).
- Recalcular imediatamente quando a dose ou o peso mudarem.
- "Adicionar tudo" passa a levar a dose e o volume calculados junto do nome.
- Quando a medicação não tiver dose ou concentração cadastradas, ou o peso não estiver na ficha, mostrar o motivo em vez de inventar valores.
- Nada de doses inventadas, nenhuma outra tela, calculadora ou cadastro alterado.

## Detalhes técnicos

- `src/components/Medicacoes.tsx`: hoje `refCalculo`/`doseUsada` são estado único usado apenas no formulário completo. Passa a existir estado por linha do modo rápido (`refCalculo[i]`, `doseUsada[i]`), alimentado pelo `onEscolher` do `CampoNomeMedicacao` e por correspondência exata do nome digitado com as sugestões.
- O cálculo continua usando `calcularDose` de `src/lib/medicamentos.ts` (nenhuma fórmula nova) e `doseEfetiva` para a dose padrão.
- `enviarRapido` inclui `dose` e `quantidade` quando o cálculo estiver válido.
- Validação: caso cão e caso gato com dados já cadastrados, conferidos no preview.
