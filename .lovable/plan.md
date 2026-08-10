# Data do plantão escolhida manualmente (opcional)

Hoje, ao abrir o app, você escolhe apenas Diurno ou Noturno e a data é sempre a do aparelho. A ideia é manter exatamente esse comportamento automático e só permitir trocar a data quando você pedir.

## O que muda

1. No diálogo "Qual é o plantão de hoje?", abaixo dos botões Diurno/Noturno, entra um link discreto: "Escolher outra data". Sem clicar nele, nada muda — a data continua sendo a do aparelho.
2. Ao clicar, aparece um seletor de data (calendário). Você escolhe o dia e depois toca em Diurno ou Noturno; o plantão passa a usar essa data.
3. No cabeçalho, ao lado do rótulo do plantão ("Plantão diurno: 10/08/26"), um botão pequeno "Alterar" reabre a mesma escolha (turno + data), caso você tenha errado ou queira lançar fichas de outro dia.
4. Tudo que já usa a data do plantão continua igual: rótulo no cabeçalho e na página inicial, texto dentro do PDF (diurno por extenso, noturno "08/08/26 (noite) - 09/08/2026 (manhã)") e o nome do arquivo ("Plantão noturno 08.08.26.pdf").

## Detalhes técnicos

- `src/hooks/usePlantaoAtual.ts`: `definirTurno(turno, dia?)` passa a aceitar um dia opcional (`AAAA-MM-DD`), usando `diaDeHoje()` quando omitido. Expor também `limparPlantao()` para reabrir a escolha.
- `src/lib/plantao.ts`: `carregarPlantaoAtual()` hoje descarta o plantão salvo quando `dia !== diaDeHoje()`. Passa a guardar também o dia do aparelho em que a escolha foi feita (`escolhidoEm`) e valida por esse campo, para que uma data manual não seja apagada no mesmo dia. Registros antigos sem o campo continuam funcionando.
- `src/components/DialogoTurno.tsx`: estado local `mostrarData`; quando ativo, renderiza `Calendar` (shadcn, com `pointer-events-auto`) dentro de um `Popover`, e envia o dia escolhido ao confirmar o turno.
- `src/components/Cabecalho.tsx`: botão "Alterar" chamando `limparPlantao()`, o que faz o `DialogoTurno` reaparecer.
