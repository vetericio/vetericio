# Medicações: novo cartão igual à imagem + Dose padrão

Só a tela Medicações muda. Sem menu inferior, sem estrela de favorito. Fichas, plantões, alarmes, curvas, anamnese, backup, sincronização e cálculos ficam intactos.

## 1. Cartão de cada medicação (igual à imagem)

Duas colunas dentro do cartão:

```text
┌──────────────────────────────────────────────────────────┐
│  Ácido Ursodesoxicólico                       ⋯          │
│  150 mg/mL                                                │
│                                                           │
│  Indicação          🕐 24h       ┌──────────┐ Mín.  Máx.  │
│  Colestase,         Dose base    │ Dose(mL) │0,033 0,134  │
│  hepatopatias       50 mg/kg     │  0,067   │(25) (100)   │
│  Via  [VO]                       │ (50 mg/kg)              │
│                                  └──────────┘             │
│                            [ 💉 Ministrar 0,067 mL ]      │
│                            [ 🧮 Consulta avulsa ]         │
└──────────────────────────────────────────────────────────┘
```

- Esquerda: nome, concentração, "Indicação" (usa o campo **Resumo** já cadastrado — nada novo pra preencher), relógio + intervalo, "Dose base" com a faixa cadastrada (ex.: "12,5 – 20 mg/kg" ou "50 mg/kg"), e as vias como etiquetas (IM / SC).
- Direita: caixa **Dose (mL)** grande com o volume e a dose em mg/kg embaixo; ao lado, caixas menores **Mín.** e **Máx.** com seus mg/kg.
- Quando não houver dose/concentração: mostra "— Não definida" na Dose e "— Não informada" em Mín./Máx. (como Alprazolam/Amoxilina na imagem). O botão Ministrar continua aparecendo; sem cálculo possível fica sem o volume e desativado, como hoje.
- Botões embaixo, lado a lado: **Ministrar 0,067 mL** (azul-marinho escuro, cheio) e **Consulta avulsa** (contornado). Funções continuam as mesmas de hoje.
- "⋯" no canto superior direito: Editar medicação / Excluir medicação com confirmação — como já está.
- Cores do app (azul-marinho, fundo claro), mesma fonte e bordas arredondadas. Sem cor nova por medicamento.

## 2. Dose padrão

- Novo campo opcional **Dose padrão** no formulário do medicamento, ao lado de Dose mínima/máxima (em mg/kg, por espécie).
- Se preenchida, a "Dose (mL)" grande e o botão Ministrar usam essa dose.
- Se vazia, usa a **média entre mínima e máxima** (comportamento atual quando as duas existem; com uma só, usa ela).
- Em "Dose base", mostra a dose padrão quando existir (ex.: "50 mg/kg"); senão, a faixa "12,5 – 20 mg/kg".
- Cadastros existentes não mudam: sem dose padrão continuam calculando pela média, como hoje.

## 3. O que NÃO muda

- Barra de peso/espécie/busca no topo continua a atual (sem seta de voltar nem lápis).
- Menu de navegação continua em cima — nada de menu inferior.
- Sem estrela de favorito.
- Ministrar → "Medições do animal" → CONFIRMAR MINISTRAÇÃO → escolher animal → grava no histórico. Consulta avulsa não grava nada.
- Nenhuma fórmula de cálculo muda; só muda qual dose entra na conta (padrão ou média).

## Detalhes técnicos

- `src/lib/medicamentos.ts`: `DoseEspecie` ganha `dosePadrao?: string`; nova função `doseEfetiva(d)` que devolve padrão, ou média min/máx, ou a única existente. `calcularFaixaDose`/`faixaDe` intocados.
- `src/components/medicamentos/FormMedicamento.tsx`: campo "Dose padrão (opcional)" no bloco de dose (cão/gato/unificado).
- `src/routes/medicacoes.tsx`: `CardMedicamento` reorganizado no layout de duas colunas da imagem (indicação = `m.resumo`, "Dose base", chips de via, caixas Dose/Mín./Máx., botões embaixo). Dose grande e Ministrar passam a usar `doseEfetiva`.
- `src/components/medicamentos/DialogoMinistrar.tsx` e `PesquisaAvulsa.tsx`: passam a exibir/usar a dose padrão quando existir (média como fallback) — mesmo cálculo, só a dose de entrada muda.
- Sem backend, sem novas dependências, sem migração; cadastros antigos continuam abrindo normalmente.
