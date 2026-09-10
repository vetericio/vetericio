# Pendências sempre abertas e avisos que você cadastra

## O que muda para você

**1. Pendências abre sempre**
A aba Pendências deixa de exigir plantão aberto: você entra e vê a lista a qualquer momento. Nada é apagado ao finalizar o plantão — as pendências continuam lá até você concluir ou excluir.

**2. Você cadastra quando o app deve perguntar**
Dentro de Pendências, no lugar dos "limites dos avisos", passa a existir **Avisos automáticos** com lista de regras que você mesmo cria, edita, liga/desliga e apaga. Cada regra tem:
- Parâmetro: Temperatura, FC, FR, PAS ou Glicemia.
- Quando perguntar: **sempre que eu preencher**, **abaixo de** um valor ou **acima de** um valor.
- A pergunta que aparece (texto livre).
- O que vai para cobrança: nome do item e tipo (pendência, medicamento cobrado ou procedimento).

**3. Regras já prontas ao abrir (você pode mudar todas)**
- Glicemia — sempre que preencher → "Registrar a glicemia para cobrança?" → procedimento **Glicose**.
- PAS abaixo de 90 → "PAS baixa. Foi iniciada norepinefrina?" → medicamento cobrado **Norepinefrina**.
- Temperatura abaixo de 37,5 → "Temperatura baixa. Foi para o aquecimento?" → procedimento **Aquecimento**.
Os limites que você já tinha ajustado são reaproveitados.

**4. Na ficha**
Ao sair do campo, a pergunta aparece com **Sim, registrar / Não / Agora não**. Nada é cobrado sem o "Sim". Se o mesmo valor dispara mais de uma regra, as perguntas aparecem uma depois da outra. Cada "Sim" soma uma ocorrência no animal (glicose 3 vezes = 3 cobranças).

Doses e cálculos não mudam; nada é apagado.

## Detalhes técnicos

- `src/lib/pendencias.ts`
  - Novo tipo `RegraAlerta { id, parametro: ChaveNumerica, condicao: "sempre" | "abaixo" | "acima", limite?: number, pergunta, itemNome, itemCategoria, ativo }`, persistido em `veterico-regras-alerta-v1` (`carregarRegras` / `salvarRegras` / `regraVazia` / `REGRAS_INICIAIS`).
  - `carregarRegras()` semeia as três regras acima na primeira leitura e migra os valores de `veterico-alertas-v1` (`carregarLimites`) para o campo `limite` das regras de temperatura/PAS. As funções antigas ficam apenas como leitura de migração.
  - `regrasDisparadas(parametro, valor, regras): RegraAlerta[]` — usa o último valor em campos com histórico ("35,8 / 38,1"); `condicao: "sempre"` dispara com qualquer número válido.
- `src/components/pendencias/DialogoAlerta.tsx`: sem mudança de contrato (recebe a regra e mostra `pergunta`).
- `src/components/pendencias/DialogoRegra.tsx` (novo): formulário da regra em `Dialog` Radix, com select de parâmetro, condição, limite (escondido em "sempre"), pergunta, nome e categoria do item.
- `src/routes/pendencias.tsx`: remove o wrapper `ExigePlantao` (mantém o resto do conteúdo intacto); troca a seção de limites por **Avisos automáticos** — lista de regras com ligar/desligar, editar, excluir (via `ConfirmarAcao` + desfazer 6 s) e botão "Nova regra".
- `src/lib/navegacao.ts`: `/pendencias` sai de `SO_COM_PLANTAO` e passa do grupo "No plantão" para acesso livre no menu.
- `src/components/FormAvaliacao.tsx`: `verificarAlerta` passa a usar `regrasDisparadas` e mantém uma fila (`alertas: RegraAlerta[]`) para perguntas em sequência; controle de "já perguntado" por `campo+id da regra`, reiniciado quando o valor do campo muda. `confirmarAlerta` continua chamando `garantirItemERegistrar`.
- `src/lib/backup.ts`: adiciona `regrasAlerta: "veterico-regras-alerta-v1"` em `CHAVES_BACKUP` para entrar no backup e na sincronização.
- `src/lib/versao.ts` → 1.54.

Validação: `bunx tsgo --noEmit` e teste no preview (Pendências abre sem plantão; glicemia 95 pergunta e registra Glicose; PAS 75 pergunta norepinefrina; criar uma regra nova de FC acima de 180 e vê-la disparar).
