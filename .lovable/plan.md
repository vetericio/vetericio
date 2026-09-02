# Backup no Google Drive, correção do plantão e versão do app

## 1. Sincronizar com o Google Drive

O app continua 100% offline: tudo permanece salvo no aparelho. O Drive passa a ser só o lugar onde os backups completos ficam guardados.

- Um único botão **Sincronizar** no rodapé (onde hoje ficam Temas e Backup). O painel atual de sincronização por código/QR será removido, conforme sua escolha.
- Ao tocar em Sincronizar: o app monta o backup completo com tudo que está no aparelho (plantões, animais, anamneses, curvas, alarmes, medicamentos, tema/cor e as demais chaves já usadas pelo backup atual) e envia um arquivo novo para a pasta **Backup** no seu Drive. A pasta é criada se não existir.
- Nome do arquivo exatamente no padrão pedido, com a data/hora do aparelho: `Backup 02 set - 15h42`.
- Cada sincronização cria um arquivo novo. Nada é sobrescrito nem apagado, nunca.
- Sem internet: o app segue funcionando e avisa que a sincronização precisa de conexão.
- **Restaurar** fica dentro do painel **Backup** já existente: lista os arquivos da pasta Backup pela data/hora, você escolhe um, e o app usa o mesmo mecanismo de restauração que já existe hoje (substituir ou juntar) para gravar os dados no aparelho.
- A autorização do Google é pedida somente na primeira vez que você toca em Sincronizar (ou em Restaurar do Drive).

### O que você precisa fazer uma vez

Para o app acessar o Drive da sua conta, é obrigatório:

1. Criar/escolher as credenciais do Google (eu abro o formulário de conexão do Google Drive; ele já traz as instruções e o endereço de retorno que deve ser colado no Google).
2. Aceitar que o app tenha uma **entrada com Google** (login). Isso é exigência do acesso ao Drive por usuário: é o login que identifica de quem é o Drive e permite abrir os mesmos backups em outro aparelho, como você pediu no item 8. O login não é necessário para usar o app offline — só para sincronizar/restaurar.

## 2. Plantão que reabre depois de atualizar

Causa confirmada: o plantão ativo é apagado corretamente ao finalizar, mas a sincronização em nuvem devolvia o plantão antigo para o aparelho (em `src/lib/sync.ts`, valores únicos como `plantaoAtual` voltam do remoto quando o local está vazio). No recarregamento o plantão reaparecia como aberto.

Correção:

- Finalizar passa a gravar uma marca persistente de "finalizado" na mesma chave que já guarda o plantão (`veterico-plantao-v1`) — sem criar segunda fonte de verdade. Um plantão finalizado nunca é lido como ativo.
- Restaurar backup/Drive respeita essa marca: dados vindos de fora não reabrem um plantão finalizado neste aparelho.
- Plantão iniciado continua ativo após recarregar, fechar e reabrir o app.
- Plantões finalizados continuam no histórico com registros, curvas e anamneses; nada é apagado por atualizar a página.

## 3. Versão do app

No rodapé, abaixo do texto institucional, um texto pequeno e discreto centralizado: `Versão 1.xx`, incrementado a cada rodada de alterações (esta rodada fica em 1.01 se hoje for 1.00).

## Detalhes técnicos

- Conector: App User Connector `google_drive` (`connector_app_user--connect_client`), escopos `drive.file` + userinfo. Chamadas ao Drive só do servidor, via `callAsAppUser` em `createServerFn`.
- Login: Lovable Cloud auth com provedor Google; tabela `app_user_connections` (service_role only, chave criptografada com `APP_USER_CONNECTION_KEY_SECRET`) para guardar a conexão de cada usuário.
- Novos server fns em `src/lib/drive.functions.ts`: garantir pasta `Backup` (`files.list` por nome + `files.create` de folder), `files.create` multipart com o JSON do backup, `files.list` da pasta e `files.get?alt=media` para restaurar.
- Reuso: `montarBackup()`, `validarBackup()`, `aplicarBackup()` e `resumirBackup()` de `src/lib/backup.ts` — sem novo formato de dados.
- Remoção: `src/components/Sincronizacao.tsx`, `src/hooks/useSync.ts`, `src/lib/sync.ts`, `src/lib/sync.functions.ts` e chamadas de auto-sync; a transferência por código/QR do painel Backup permanece.
- `src/lib/plantao.ts`: tipo passa a aceitar estado finalizado (`{ finalizadoEm }`), `carregarPlantaoAtual()` devolve `null` nesse caso, `usePlantaoAtual`/`useFinalizarPlantao` seguem como única fonte de verdade.
- `src/lib/versao.ts` com a constante exibida em `Rodape.tsx`.
- Testes: os 7 cenários listados por você, incluindo dois envios seguidos ao Drive e uma restauração.
