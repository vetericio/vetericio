# Alarmes: prévia que para a anterior + 8 músicas novas

## 1. Ouvir uma música para a anterior

Hoje, ao tocar a prévia, o app só interrompe a repetição — as notas já agendadas continuam soando, então duas músicas se sobrepõem. Vou guardar cada nota tocada e cortar o som na hora ao iniciar outra prévia (ou ao parar/paralisar o alarme), com um corte suave de ~30 ms para não estalar.

## 2. Oito músicas novas (total 20, grade de 4 colunas / 5 linhas)

Clássicas (domínio público, melodia reconhecível):

- **Ode à Alegria** (Beethoven)
- **Para Elisa** (Beethoven)
- **Marcha Turca** (Mozart)
- **Ária / Prelúdio** (Bach)

Estilo (arranjos originais no clima pedido, criados no app):

- **Rock** — riff curto e marcado
- **Balada dramática** — clima Evanescence (piano grave + melodia menor)
- **Noites da Arábia** — clima Aladdin (escala oriental)
- **Vila alegre** — clima da abertura do Chaves no Brasil

Observação: as quatro últimas são melodias próprias no estilo/clima pedido, não as gravações originais — reproduzir as músicas comerciais exigiria licença.

## Detalhes técnicos

- `src/lib/toques.ts`: manter registro dos `OscillatorNode`/`GainNode` ativos em `tocarCiclo`; `pararToque()` passa a fazer `gain.cancelScheduledValues` + rampa curta e `osc.stop()`; ampliar `ToqueId`, `TOQUES` e `PADROES` com os 8 novos padrões (ciclo, onda, notas) usando o helper `melodia` e notas explícitas quando o ritmo variar.
- `src/components/Alarmes.tsx`: manter `grid-cols-4` (fica 5 linhas), atualizar o texto "12 opções" para "20 opções"; a prévia já chama `tocarToque`, que agora corta a anterior.
- `src/routes/alarmes.tsx`: atualizar as menções a 12 músicas no texto e no `head()`.
