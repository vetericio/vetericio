# Sincronização entre aparelhos

Uma opção **Sincronização** que reúne o backup completo e o pareamento de dois aparelhos por código (1 letra + 5 números, ex.: `H78096`) com QR. Nada do que existe hoje muda de lugar nem de comportamento: o painel atual de Backup passa a se chamar Sincronização e ganha a parte de vínculo.

## O que já existe (verificado no código)

- Tudo é salvo no próprio aparelho, nas chaves: registros (animais/fichas/avaliações/sinais/observações), plantões salvos, plantão atual, curvas, alarmes, medicamentos, tema e cor.
- Já existe um painel **Backup** no rodapé que gera arquivo, restaura arquivo e envia/recebe por QR com código de 6 números, válido 24 h, guardado na nuvem.
- Duas tabelas já criadas na nuvem: `transferencias` (envio pontual, com código e validade de 24 h) e `sync_salas` (código + dados + data de atualização) — a segunda está criada e sem uso no código.
- Faltam no backup duas coisas que o app salva hoje: **anamneses** e **bloco de notas/rascunho**.

## O que será feito

1. **Backup completo de verdade**: incluir anamneses e o bloco de notas (rascunho não finalizado) na cópia. Assim "se o app salva, entra no backup" passa a valer de fato. Backups antigos continuam funcionando.
2. **Painel Sincronização**: o mesmo botão do rodapé, renomeado, com dois blocos:
   - **Backup** — Gerar / Compartilhar / Restaurar arquivo (exatamente como hoje).
   - **Sincronizar** — botão que cria o vínculo, mostra o código `1 letra + 5 números` e o QR; no outro aparelho, digitar o código ou escanear.
3. **Vínculo permanente entre os dois aparelhos** usando a tabela `sync_salas`: depois de pareado, cada aparelho guarda o código e ganha dois botões — **Enviar deste aparelho** e **Trazer do outro aparelho** — para sincronizar quando quiser, com o mesmo código.
4. **Ao receber**: aparece o resumo ("3 animais, 12 plantões, 2 curvas…") e a escolha entre **Substituir tudo** e **Juntar**, como já é hoje. Se o aparelho 2 não tiver plantão aberto, o plantão recebido abre automaticamente; um plantão já finalizado neste aparelho continua protegido (regra atual mantida).
5. Sem internet, tudo continua funcionando offline e o backup por arquivo segue disponível.

## Sobre segurança e privacidade

Sem login, uso pessoal: quem tem o código acessa os dados daquele vínculo. Por isso o código é aleatório e a sala é apagada quando você tocar em **Desvincular**.

## Detalhes técnicos

- `src/lib/backup.ts`: acrescentar `anamneses: "veterico-anamneses"` e `notas: "veterico-bloco-notas"` a `CHAVES_BACKUP`; `notas` entra na lista de valores simples de `aplicarBackup`, `anamneses` no merge por `id`. `resumirBackup` ganha as contagens.
- Migração: em `sync_salas`, garantir chave primária/índice único em `codigo_hash` e manter RLS sem políticas (acesso só pelo servidor). Nenhuma alteração destrutiva; nenhuma tabela removida.
- Novo `src/lib/sincronizacao.functions.ts` (`createServerFn`, `supabaseAdmin` carregado dentro do handler, validação Zod `^[A-Z][0-9]{5}$`):
  - `criarSala()` → gera código único, grava sala vazia, devolve `{ codigo }`.
  - `enviarSala({ codigo, dados })` → upsert em `sync_salas`.
  - `puxarSala({ codigo })` → devolve dados + `atualizado_em`, ou `null`.
  - `apagarSala({ codigo })`.
- `src/lib/transferencia.functions.ts` e a tabela `transferencias` permanecem intactos (fluxo atual de QR por 24 h continua funcionando).
- `src/components/Backup.tsx`: rótulo "Sincronização", bloco novo de vínculo reaproveitando o QR (`gerarImagemQr`) e o leitor de câmera (`jsqr`) já presentes; aceita no leitor tanto o link `?transfer=` atual quanto `?sala=CÓDIGO`. Código do vínculo guardado em `veterico-sala-v1`.
- `src/routes/index.tsx` / painel: abre a restauração quando a URL trouxer `?sala=`, igual ao `?transfer=` de hoje.
- Nenhuma mudança em calculadoras, fichas, medicamentos, alarmes, plantões, bloco de notas ou layout — apenas os arquivos citados acima.
- Sem uso de IA; nenhum crédito de IA consumido.

## Arquivos afetados (estimativa)

- `src/lib/backup.ts` (ajuste)
- `src/lib/sincronizacao.functions.ts` (novo)
- `src/components/Backup.tsx` (ajuste)
- `src/routes/index.tsx` (leitura do parâmetro na URL)
- 1 migração de banco (índice único em `sync_salas`)
