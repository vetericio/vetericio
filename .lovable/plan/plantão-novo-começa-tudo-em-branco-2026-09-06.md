# Plantão novo começa tudo em branco

## O que acontece hoje

Ao finalizar o plantão, os alarmes **não são apagados** — ficam guardados, só desligados (aparecem na aba Alarmes do próximo plantão). As curvas também ficam guardadas (encerradas, mas visíveis). A anamnese e o bloco de notas já são apagados.

## O que vai mudar

Ao finalizar o plantão, apagar de vez:

- **Todos os alarmes** — a aba Alarmes volta ao estado de fábrica (lista vazia; o alarme de jejum das 00h só reaparece desligado, como padrão, e liga sozinho se o próximo plantão for noturno, como já acontece hoje).
- **Todas as curvas** — a aba Curva começa vazia (hoje ficam guardadas encerradas).
- **Anamnese** — apagar todos os animais.
- **Bloco de notas** — já é apagado hoje, sem mudança.

Assim, ao iniciar o próximo plantão está tudo em branco: Início, Animais internados, Anamnese, Curva e Alarmes.

## O que NÃO muda

- Animais internados continuam indo para o histórico de plantões (como hoje).
- Histórico de plantões (`/plantoes`) continua intacto.
- Biblioteca de medicações continua guardada (não é do plantão).
- Tema e configurações continuam.

## Detalhes técnicos

- `src/hooks/useAlarmes.ts`: trocar `encerrarTodosAlarmes()` para esvaziar a lista (`alarmes = []`, parar o que estiver tocando, salvar). O alarme de jejum volta a existir só quando necessário, via `padraoJejum()`/`ativarJejumNoturno()`, que já recriam quando a lista está vazia.
- `src/hooks/useFinalizarPlantao.ts`: `setCurvas([])` em vez de desativar; a foto das curvas já é guardada no histórico do plantão antes de apagar (linha `curvas: curvas.filter(...)` permanece).
- Sem backend novo, sem mudança de layout. Verificar com `bunx tsgo --noEmit` e teste no preview: finalizar plantão com alarmes/curvas criados e confirmar abas vazias no plantão seguinte.