# Compartilhar backup via Web Share API

## O que será feito

Adicionar uma nova ação **"Compartilhar backup"** dentro do painel `Backup` (`src/components/Backup.tsx`), reaproveitando as funções de backup já existentes (`montarBackup`, `nomeArquivoBackup` de `src/lib/backup.ts`).

## Passos

1. Importar `nomeArquivoBackup` em `src/components/Backup.tsx`.
2. Criar a função `compartilharBackup` que:
   - Gera o backup completo com `montarBackup()`.
   - Cria um `File` JSON com o nome vindo de `nomeArquivoBackup()`.
   - Verifica se `navigator.share` e `navigator.canShare` estão disponíveis.
   - Se compatível, chama `navigator.share({ files: [arquivo], title: "Backup Veterício" })`.
   - Se não compatível, mostra aviso claro: "Compartilhamento de arquivo não é compatível com este navegador/dispositivo.".
   - Ignora o erro de cancelamento (`AbortError`).
3. Inserir o botão **"Compartilhar backup"** no painel, em uma nova linha abaixo dos botões principais, sem remover nem alterar os botões existentes.
4. Não modificar `src/lib/backup.ts`, `src/lib/transferencia.functions.ts`, sincronização por código, backup local, layout geral ou outras funcionalidades.

## Testes

- Verificar se o botão aparece no painel Backup.
- Verificar se, em ambientes sem Web Share, a mensagem de incompatibilidade é exibida.
- Verificar se o botão "Gerar backup" continua funcionando.
- Verificar se restauração por arquivo/QR/código continua funcionando.
- Validar build com `bunx tsgo --noEmit`.
