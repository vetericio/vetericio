# Curva no PDF exportado

## O que já funciona

No plantão de hoje, a curva já entra no texto copiado e no PDF quando existe pelo menos uma medição registrada na aba Curva. Verifiquei agora com um animal de teste e o bloco saiu assim:

```text
Glicemia: 210 mg/dL
Curva glicêmica (a cada 2h)
12h00 - 210 mg/dL
14h00 - 168 mg/dL
```

## O que está faltando

1. **PDF de plantões já finalizados não guarda a curva.** Ao finalizar o plantão, os animais são arquivados, mas as curvas não vão junto: o PDF antigo busca a curva "ao vivo" no aparelho. Então, se o mesmo animal voltar com uma curva nova, ou se as curvas forem apagadas, o PDF do plantão anterior sai sem a curva (ou com a curva errada).
2. **Curva sem medição não aparece** — hoje ela é omitida em silêncio. Vou passar a mostrar o título com o aviso de que ainda não há medições, para não parecer que sumiu.
3. **A curva se mistura ao restante da ficha.** Vou destacá-la como bloco próprio no PDF, com o título em negrito e as medições recuadas, uma por linha.

## O que muda na prática

- Ao finalizar o plantão, cada animal leva a foto das suas curvas para o histórico. O PDF daquele plantão sempre mostrará exatamente as medições feitas naquele dia, para sempre.
- No PDF (do plantão de hoje e dos anteriores), a curva aparece assim:

```text
Saturna (Cachorro)
Glicemia: 210 mg/dL
Observações: ...

  Curva glicêmica (a cada 2h)
  12h00 - 210 mg/dL
  14h00 - 168 mg/dL
```

- Plantões antigos já salvos (que não têm a foto da curva) continuam usando as curvas do aparelho, como hoje — nada é perdido.

## Detalhes técnicos

- `src/lib/ficha.ts`: `Plantao` ganha `curvas?: Curva[]`; `OpcoesFormato` ganha `curvas?: Curva[]` para que `formatarRegistro` use a lista recebida em vez de ler o `localStorage` (mantendo a leitura atual como fallback).
- `src/lib/curva.ts`: `blocoCurvasDoRegistro(r, curvas?)` passa a aceitar a lista; `textoCurva` retorna o título com "sem medições registradas" quando não há valores.
- `src/routes/registros.tsx`: ao finalizar o plantão, salvar `curvas` (só as do animais daquele plantão) dentro do objeto do plantão antes de encerrá-las.
- `src/routes/plantoes.tsx`: passar `p.curvas` para `exportarPdf` e `formatarTodos`.
- `src/lib/pdf.ts`: identificar as linhas da curva no bloco e desenhá-las como seção separada — título em negrito, medições com recuo e espaço antes/depois, sem quebrar a cópia linha por linha.
- Sem backend: tudo continua offline no aparelho.
