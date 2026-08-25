# Reorganizar as ferramentas da página inicial

## Layout

- **Calculadora**: fixa, ocupando a coluna esquerda.
- **Coluna direita**: um banner deslizável (swipe) com dois slides:
  - Slide 1: Cronômetro + Taxa de infusão (empilhados, como hoje).
  - Slide 2: Transfusão sanguínea.
- Abaixo do banner: 2 bolinhas indicadoras — a do slide ativo preenchida, a outra vazada.
- Alinhamento mobile: as duas colunas têm exatamente a mesma altura, sem estouro horizontal nem corte de texto. A altura é definida pela calculadora e o banner acompanha.
- Estrutura pronta para novas calculadoras: basta acrescentar um slide e uma bolinha extra.

## Fórmula da transfusão

Volume (mL) = [ Peso (kg) × n × (Ht desejado − Ht do receptor) ] ÷ Ht do doador

- Cães: n = 90
- Gatos: n = 70

Rótulos dos campos passam a ser: Peso (kg), Ht do receptor (%), Ht do doador (%), Ht desejado (%) — este último já preenchido com 25 e editável. Resultado arredondado para inteiro, com a fórmula e a constante usada exibidas abaixo, além do aviso de estimativa clínica.

## Detalhes técnicos

- Novo `src/components/FerramentasClinicas.tsx`: carrossel com `embla-carousel-react` (já instalado), `align: "start"`, um slide por página, indicadores controlados por `on("select")`.
- `src/routes/index.tsx`: grid de 2 colunas — `<Calculadora />` na esquerda, `<FerramentasClinicas />` na direita; remover o grid 2x2 atual.
- `src/components/TransfusaoSanguinea.tsx`: apenas ajuste de rótulos e mensagens.
- `src/lib/transfusao.ts`: cálculo mantido (já corresponde à fórmula); textos de erro alinhados aos novos rótulos.
- Regras responsivas: `min-w-0` nos contêineres de texto, `overflow-hidden` no viewport do carrossel, `h-full` nos cards.
