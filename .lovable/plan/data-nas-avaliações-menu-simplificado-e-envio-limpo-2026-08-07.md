# Data nas avaliações, menu simplificado e envio limpo

## 1. Data em vez de "#1"

Cada avaliação passa a ser identificada por data e hora (ex.: `07/08 09:05`) em vez de número:

- Gráficos e trilhas da aba Evolução (eixo do tempo e rótulos dos blocos).
- Lista de Animais registrados (título de cada card).
- Texto copiado e PDF exportado.

Registros antigos sem data salva mostram apenas o nome do animal, sem número.

## 2. Menu

- Botões: **Início** e **Animais registrados** (sem quantidade). Plantões e Evolução saem do menu e passam a ser botões dentro da página de Animais registrados.
- Abaixo dos botõo cabeçalho: **"Total de registros do plantão de hoje: X"**, sempre atualizado automaticamente. X é o total de animais registrados 

## 3. Envio de animal

Ao clicar em Enviar (novo registro):

- O registro é salvo no aparelho.
- A página é recarregada em "/" com o formulário vazio, pronto para o próximo animal, e o total no cabeçalho já atualizado.

Edição de um registro existente continua sem recarregar (volta ao início com aviso de "Registro atualizado").

## Detalhes técnicos

- `src/lib/evolucao.ts`: `quando()` deixa de cair em `#${indice+1}`; retorna string vazia quando não há `criadoEm`.
- `src/components/ListaRegistros.tsx` e `src/lib/ficha.ts` (formatação de texto/PDF): trocar prefixo `${i+1}.` pela data/hora de `criadoEm`.
- `src/components/Cabecalho.tsx`: remover links de Plantões/Evolução, adicionar a linha de total usando `useRegistros()`.
- `src/routes/registros.tsx`: adicionar links para `/plantoes` e `/evolucao`.
- `src/routes/index.tsx`: em `salvar()` para novo registro, salvar e então `window.location.assign("/")` (o `localStorage` já persiste antes do reload).