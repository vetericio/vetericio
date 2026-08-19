# Alarmes e curva glicêmica / PAS

Dois recursos novos: uma central de alarmes com toque musical e um acompanhamento de curva (glicemia e/ou PAS) por animal, que entra na ficha final.

## 1. Alarmes

Nova área "Alarmes" no início (abaixo da calculadora/cronômetro) e um item no menu.

- Alarme pré-definido pronto para ativar: **00h — Jejum dos animais** (só ligar/desligar).
- Botão **Adicionar alarme**: hora, rótulo, repetir diariamente (sim/não) e escolha do toque.
- 5 toques gerados dentro do app (offline, sem arquivos): Suave, Sino, Urgente, Pulso, Sirene — cada um com botão de ouvir antes.
- Ao soar: música em volume máximo em loop, vibração e um aviso em tela cheia com **Parar** e **Soneca 5 min**.
- Alarmes ficam salvos no aparelho (como o resto do app) e continuam valendo entre plantões.

### Sobre o modo silencioso — o que é possível e o que não é

Vale ser direto: um app instalado pela web não tem permissão do Android para tocar por cima do modo silencioso nem para acordar o aparelho com o app fechado. Isso só existe em app nativo da Play Store. O que vou fazer para chegar o mais perto possível:

- Com o app aberto (mesmo com a tela apagada ou em outro app, desde que a aba siga viva): música alta em loop + vibração + tela de alarme.
- Uma **notificação do sistema** no horário, que aparece mesmo com o app fechado — mas ela obedece ao silencioso do aparelho.
- Um aviso na tela de alarmes explicando que, para tocar garantido, o app deve ficar aberto e o volume de mídia ligado.

Se você quiser alarme que fure o silencioso com o app fechado, isso exige um app nativo — posso indicar depois o caminho.

## 2. Curva glicêmica / PAS por animal

Nova aba **Curva** (e acesso a partir de cada animal em "Animais internados").

- Escolho o animal internado na lista.
- Escolho o parâmetro: **Glicemia**, **PAS** ou **os dois**.
- Escolho o intervalo: **1h, 2h, 3h ou 4h**.
- Ao iniciar, o app sugere criar o alarme recorrente naquele intervalo ("Curva Saturna — glicemia, a cada 2h") com um toque à escolha; ele repete até eu encerrar a curva.
- Cada medição é registrada com hora e valor, com destaque em vermelho quando fora da faixa da espécie (mesmas faixas já usadas no app).
- A curva aparece:
  - na ficha do animal em "Animais internados" (tabela hora × valor);
  - no texto copiado e no PDF, em bloco próprio, uma linha por medição:
    ```text
    Curva glicêmica (a cada 2h)
    09h00 - 210 mg/dL
    11h00 - 168 mg/dL
    ```
  - como gráfico na aba Evolução, junto dos outros parâmetros.
- Posso encerrar a curva (para os alarmes, mantém o histórico) ou apagar medições individuais.

## Detalhes técnicos

- `src/lib/alarmes.ts`: tipo `Alarme`, persistência em `localStorage`, cálculo do próximo disparo, alarme padrão de jejum.
- `src/lib/toques.ts`: 5 toques via Web Audio API (osciladores + envelope), com `tocar/parar` em loop.
- `src/hooks/useAlarmes.ts`: store compartilhado no padrão `useSyncExternalStore` já usado em `useRegistros`, com verificação por segundo e disparo.
- `src/components/Alarmes.tsx` (lista/criação) e `src/components/AlarmeAtivo.tsx` (overlay com Parar/Soneca, `navigator.vibrate`, `AudioContext` desbloqueado no primeiro toque do usuário).
- Notificação do sistema via Notification API quando permitida; sem service worker novo além do já existente do PWA.
- `src/lib/curva.ts`: tipo `Curva` (animalId, parâmetros, intervaloHoras, medições, ativa) + formatação de texto.
- `src/routes/curva.tsx` + link no `Cabecalho.tsx`; blocos de curva em `ListaRegistros.tsx`, `src/lib/pdf.ts` e `src/lib/evolucao.ts`.
- Nada de backend: tudo offline no aparelho, como o app já funciona hoje.
