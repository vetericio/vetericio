# Adicionar calculadora de Norepinefrina (NOREP)

## Objetivo

Incluir uma nova calculadora específica de NOREP no bloco de ferramentas da página inicial, sem alterar ou remover a calculadora geral, o cronômetro, a taxa de infusão ou a transfusão sanguínea.

## Layout

```text
┌─────────────────┬──────────────────────────────┐
│                 │  Slide 1: Cronômetro         │
│  Calculadora    │          Taxa de infusão     │
│   (existente)   ├──────────────────────────────┤
│                 │  Slide 2: Transfusão         │
│                 ├──────────────────────────────┤
│                 │  Slide 3: Norepinefrina      │
│                 │          (NOREP)               │
└─────────────────┴──────────────────────────────┘
                        ●  ●  ●
```

- A nova calculadora será o **terceiro slide** do carrossel existente em `FerramentasClinicas`.
- O indicador de bolinhas passa de 2 para 3, mantendo a mesma lógica de ativo preenchido/inativo vazado.
- Nenhuma outra ferramenta é removida ou reorganizada.

## Componente `src/components/CalculadoraNorep.tsx`

- Título: **Norepinefrina**
- Subtítulo fixo: **Diluição: 4 mL de norepinefrina + 96 mL de SF = 40 mcg/mL**
- Campos:
  1. **Peso (kg)** — obrigatório, aceita vírgula ou ponto.
  2. **Dose (mcg/kg/min)** — editável.
  3. **Taxa de infusão (mL/h)** — editável.
- Resultado exibido abaixo dos campos, com unidades.
- Aviso de estimativa clínica no rodapé do card.
- Visual coerente com `TaxaInfusao`/`TransfusaoSanguinea` (bordas arredondadas, `bg-card`, `text-primary` para valores).

## Lógica de cálculo `src/lib/norep.ts`

- Constante de concentração: `40 mcg/mL`.
- `paraNumero` reutilizado de `src/lib/ficha.ts` para converter vírgula/ponto.
- Regras:
  - Se peso inválido ou ≤ 0 → erro "Informe um peso válido maior que zero."
  - Se dose informada e taxa vazia → calcular taxa: `peso × dose × 60 ÷ 40`.
  - Se taxa informada e dose vazia → calcular dose: `taxa × 40 ÷ (peso × 60)`.
  - Se ambos informados → manter o último campo editado como fonte e recalcular o outro.
  - Se ambos vazios → mostrar placeholder "—" e instrução.
- Arredondamento: taxa em 2 casas decimais; dose em 2 casas decimais.
- Fórmula exibida dinamicamente conforme o sentido do cálculo.

## Gerenciamento de estado sem loop

- Estado local com `useState` para `peso`, `dose` e `taxa`.
- Campo `ultimoEditado: "dose" | "taxa" | null` para saber qual valor deve prevalecer quando ambos estão preenchidos.
- Efeito que reage às mudanças de `peso`, `dose`, `taxa` e `ultimoEditado`, calculando o campo "dependente" sem causar ciclos.
- Limpeza individual mantida: ao apagar um campo, o outro continua editável e o cálculo é refeito.

## Atualização do carrossel `src/components/FerramentasClinicas.tsx`

- Importar `CalculadoraNorep`.
- Adicionar terceiro slide com `flex-[0_0_100%]`.
- Atualizar array de indicadores de `[0, 1]` para `[0, 1, 2]`.
- Manter `align: "start"`, `containScroll: "trimSnaps"` e eventos `select`/`reInit`.

## Testes de conferência

Após implementação, validar os seguintes pares:


| Peso  | Dose | Taxa esperada |
| ----- | ---- | ------------- |
| 3 kg  | 0,2  | 0,90 mL/h     |
| 5 kg  | 0,2  | 1,50 mL/h     |
| 10 kg | 0,2  | 3,00 mL/h     |
| 20 kg | 0,4  | 12,00 mL/h    |
| 30 kg | 1,0  | 45,00 mL/h    |


E o sentido inverso: 5,3 kg + 1,59 mL/h → 0,20 mcg/kg/min.

## Detalhes técnicos

- Não alterar `Calculadora.tsx`, `TaxaInfusao.tsx`, `Cronometro.tsx`, `TransfusaoSanguinea.tsx` nem `src/lib/transfusao.ts`.
- `src/routes/index.tsx` não precisa ser alterado; a inclusão acontece dentro de `FerramentasClinicas`.
- TypeScript deve passar com `bunx tsgo --noEmit` após as alterações.