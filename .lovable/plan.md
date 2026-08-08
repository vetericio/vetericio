# Plantão diurno/noturno, nome com emoji e resumo automático

## 1. Pergunta de turno ao abrir

Na primeira abertura do dia, o app pergunta: **Plantão diurno ou noturno?** A escolha fica salva no aparelho por aquele dia (pode ser trocada por um toque na linha do plantão no cabeçalho).

Abaixo de "Ficha de Avaliação da Internação" aparece:

```text
Plantão diurno: 07/08/26
Plantão noturno: 07/08/26 (noite) → 08/08/26 (manhã)
```

O texto do plantão também entra no topo da exportação (texto copiado e PDF).

## 2. Nome do animal sem data

Nos cards de Animais internados, no texto copiado e no PDF, o título passa a ser só nome + emoji da espécie:

```text
Tigresa 🐶
Mel 🐱
```

Sem data/hora e sem "(Cachorro)". A data continua registrada internamente e segue aparecendo nos gráficos de Evolução.

## 3. Resumo automático (feito pelo app, offline)

Cada registro ganha uma linha **Resumo:** em linguagem natural, montada pelo app a partir dos campos preenchidos — funciona sem internet.

Exemplos:

```text
Resumo: Animal se alimentou por sonda, estava ativo e com parâmetros normais.
Resumo: Animal não se alimentou, estava taquicárdico, não defecou.
```

Como o texto é montado:

- Alimentação: "se alimentou com ração", "se alimentou por sonda", "não se alimentou", "em jejum".
- Comportamento: "estava ativo/prostrado/responsivo…".
- Fezes e urina: "defecou (pastoso)", "não defecou", "urinou", "não urinou".
- Vômito: "apresentou vômito", "sem vômito", "com sialorreia".
- Mucosas: citadas quando diferentes de normocoradas.
- Números: se todos dentro da faixa da espécie → "com parâmetros normais"; se houver alterações → lista os termos clínicos (taquicárdico, hipotérmico, hipoglicêmico…).

O resumo aparece no card da lista, no texto copiado e no PDF, e é recalculado sozinho quando o registro é atualizado.

## Detalhes técnicos

- `src/lib/plantao.ts` (novo): tipo `Turno`, leitura/gravação em `localStorage` (`veterico-plantao-v1` com `{ dia, turno }`), e `rotuloTurno()` gerando as frases de data (noturno = dia escolhido → dia seguinte, formato `dd/MM/aa`).
- `src/hooks/usePlantaoAtual.ts` (novo): mesmo padrão `useSyncExternalStore` de `useRegistros`.
- `src/components/DialogoTurno.tsx` (novo): `AlertDialog` com Diurno/Noturno, aberto quando não há turno salvo para o dia de hoje.
- `src/components/Cabecalho.tsx`: mostra a linha do plantão (clicável para trocar) acima do total de registros; monta o diálogo em `__root.tsx` ou no próprio cabeçalho.
- `src/lib/ficha.ts`: `formatarRegistro` passa a usar `nomeComEmoji(r)` (🐶/🐱) no lugar de `Nome (Espécie)` e acrescenta a linha `Resumo:`; `formatarTodos` deixa de prefixar a data/hora e recebe o cabeçalho do plantão.
- `src/lib/resumo.ts` (novo): `resumirRegistro(r)` com os mapeamentos acima, reaproveitando `avaliarValor`/`FAIXAS` para os termos clínicos.
- `src/components/ListaRegistros.tsx`: remove o prefixo `dataHoraRegistro` do título.
- `src/lib/pdf.ts`: inclui a linha do plantão no topo do documento.
- `src/lib/evolucao.ts` permanece igual (Evolução continua usando data/hora).
