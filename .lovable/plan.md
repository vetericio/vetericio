# Módulo de Cálculo de Volume de Transfusão Sanguínea Veterinária

## Objetivo
Adicionar uma nova ferramenta clínica ao lado da "Taxa de infusão", no mesmo card da página inicial, permitindo alternar entre as duas calculadoras com deslize (swipe) e indicadores de página.

## O que será feito

1. **Novo componente de transfusão**
   - Criar `src/components/TransfusaoSanguinea.tsx` com os campos:
     - Espécie: Cão / Gato (botões segmentados).
     - Peso do paciente (kg).
     - VG/HT atual do paciente (%).
     - VG/HT da unidade sanguínea (%).
     - VG/HT alvo (%), preenchido automaticamente com 25 e editável.
   - Cálculo em tempo real:
     - Cão: `peso × 90 × (VG alvo − VG atual) ÷ VG da unidade`.
     - Gato: `peso × 70 × (VG alvo − VG atual) ÷ VG da unidade`.
   - Resultado arredondado para inteiro e exibido em mL.
   - Exibir a fórmula completa e o fator utilizado (Cão = 90 mL/kg, Gato = 70 mL/kg).
   - Aviso de estimativa clínica abaixo do resultado.

2. **Swipe entre Taxa de infusão e Transfusão**
   - Criar um wrapper `src/components/FerramentasClinicas.tsx` usando `embla-carousel-react` (já instalado).
   - O wrapper conterá dois slides:
     - Slide 1: `TaxaInfusao` (existente).
     - Slide 2: `TransfusaoSanguinea` (novo).
   - Em baixo do card, adicionar 2 bolinhas indicadoras: a ativa fica preenchida, a inativa vazada.
   - O card ocupa a mesma altura e largura do `TaxaInfusao` atual, sem quebrar o layout de duas colunas da página inicial.

3. **Ajustes na página inicial**
   - Substituir `<TaxaInfusao />` por `<FerramentasClinicas />` em `src/routes/index.tsx`.
   - Manter `Cronometro` acima e o novo wrapper no lugar do card anterior.

4. **Validações e mensagens**
   - Bloquear cálculo e mostrar aviso quando VG atual ≥ VG alvo.
   - Rejeitar peso, VG atual ou VG da unidade iguais a zero (exigir valor > 0).
   - Aceitar vírgula ou ponto nos campos decimais, igual na calculadora de taxa de infusão.
   - Mostrar aviso de que o resultado é uma estimativa e deve ser ajustado clinicamente.

5. **Extensibilidade para concentrado de hemácias**
   - Estruturar o componente com uma aba/seletor interno "Sangue total" (ativo) e reservar o ponto de extensão "Concentrado de hemácias".
   - A fórmula de sangue total permanece inalterada; a lógica de cálculo será desacoplada em funções puras em `src/lib/transfusao.ts`, facilitando a adição futura de outra fórmula sem tocar no componente existente.

## Detalhes técnicos

- `src/lib/transfusao.ts`: funções puras `calcularVolumeSangueTotal(especie, peso, vgAtual, vgAlvo, vgUnidade)` e validadores.
- `src/components/TransfusaoSanguinea.tsx`: estado local, validação e UI.
- `src/components/FerramentasClinicas.tsx`: carousel Embla com indicadores.
- `src/routes/index.tsx`: substituir import e uso de `TaxaInfusao` por `FerramentasClinicas`.
- Nenhuma dependência nova: usar `embla-carousel-react` já presente no projeto.
