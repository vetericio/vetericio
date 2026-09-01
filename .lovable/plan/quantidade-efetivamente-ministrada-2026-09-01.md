# Quantidade efetivamente ministrada

Hoje, ao tocar em "Ministrar", o app já leva a quantidade calculada (a faixa, ex. `0,09 – 0,14 mL`) direto para a escolha do animal e grava isso na ficha. Passa a existir um passo intermediário onde eu escolho o valor real.

## 1. Novo passo ao tocar em "Ministrar"

Abre um diálogo com:

- O cálculo, só como referência (não editável):
  - `10 – 15 mg/kg`
  - `45 – 67,5 mg`
  - `0,09 – 0,14 mL`
- Campo em destaque **Quantidade a ministrar**, já pré-preenchido com a quantidade calculada (o valor máximo da faixa), mas totalmente editável.
- Botão **CONFIRMAR APLICAÇÃO**.

Depois de confirmar, segue o fluxo atual: "Para qual animal?" → escolho o animal internado → grava.

## 2. Como o campo se comporta

**Líquidos (mL, gotas):** digitação estilo centavos, igual ao peso — digito `015` e aparece `0,150 mL`. Atalhos rápidos ao lado com valores próximos do calculado (mín, máx e arredondado), toque preenche o campo.

**Comprimidos / cápsulas:** botões de fração prática, escolho um:
`¼` · `⅓` · `½` · `1` · `1½` · `2`
(e a opção calculada aparece marcada como sugestão)

Nada é obrigatório seguir o cálculo: qualquer valor que eu escolher é aceito.

## 3. O que fica registrado

O histórico da ficha do animal grava **somente o valor escolhido**, nunca a faixa:

```text
Dipirona 500 - 0,15 mL / IV / 8h
```

A dose de referência (mg/kg e mg) continua guardada no campo de dose da medicação, para conferência, mas a quantidade aplicada é exatamente a que eu confirmei. O mesmo vale para comprimidos: se escolhi `½ comprimido`, o histórico mostra `½ comprimido`.

## Detalhes técnicos

- Novo `src/components/medicamentos/DialogoQuantidade.tsx`: recebe o `ResultadoFaixa` + a via/frequência, mostra o cálculo, controla o campo/frações e devolve a `AplicacaoPendente` com `quantidade` já definida.
- `src/routes/medicacoes.tsx`: `CardMedicamento` passa a abrir `DialogoQuantidade` em vez de montar a `AplicacaoPendente` direto; ao confirmar, o resultado alimenta o `DialogoAplicar` já existente.
- `src/lib/medicamentos.ts`: expor os valores numéricos da faixa (`volMin`/`volMax`) no `ResultadoFaixa` para pré-preencher o campo e gerar os atalhos; reutilizar `textoQuantidade` / `fracaoComprimido` na formatação.
- `DialogoAplicar` e `src/lib/ficha.ts` não mudam de formato — a `quantidade` continua string, agora sempre um valor único.
