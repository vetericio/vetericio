# Quantidade a ministrar: rótulos e casas decimais

## 1. Explicar os números abaixo do campo

Hoje aparecem só três números soltos (ex.: 0,05 / 0,10 / 0,15). Passam a ter rótulo:

```text
Atalhos:  [ Mínimo 0,05 ]  [ Médio 0,10 ]  [ Máximo 0,15 ]
```

- Linha "Atalhos rápidos (referência calculada)" acima dos botões.
- Cada botão mostra o rótulo pequeno em cima (Mínimo / Médio / Máximo) e o valor embaixo.
- Se mínimo e máximo forem iguais, mostra só um botão "Dose calculada".

## 2. Base passa a ser 0,00 (2 casas)

- O campo de quantidade e os atalhos passam a usar 2 casas por padrão: digitar `15` vira `0,15`; digitar `300` vira `3,00`.
- Placeholder vira `0,00`.

## 3. Como pedir 0,000 (3 casas)

Botão pequeno ao lado do rótulo "Quantidade a ministrar", alternando precisão:

```text
QUANTIDADE A MINISTRAR        [ 0,00 | 0,000 ]
```

- Toque alterna entre 2 e 3 casas; o valor digitado é convertido sem perder o que já foi escrito.
- A escolha fica salva no aparelho (localStorage), então o app "lembra" da preferência.
- Volumes muito pequenos (menores que 0,10 mL calculado) abrem já em 3 casas automaticamente, para não perder precisão.
- O histórico do animal registra exatamente o texto exibido (ex.: "0,15 mL" ou "0,075 mL").

## Detalhes técnicos

- `src/components/medicamentos/DialogoQuantidade.tsx`: formatação parametrizada por `casas` (2 ou 3) em vez de `formatar3`/`paraDigitos` fixos; atalhos viram objetos `{ rotulo, valor }`.
- Preferência persistida em `localStorage` sob chave `veterico:precisao-ml`, lida por um pequeno hook para valer em todo o módulo de medicações.