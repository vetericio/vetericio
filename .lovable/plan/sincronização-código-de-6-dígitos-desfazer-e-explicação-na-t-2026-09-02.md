# Sincronização: código de 6 dígitos, desfazer e explicação na tela

## 1. Código curto (6 dígitos)

- Ao gerar o código deste aparelho, o app cria um código de 7 dígitos, uma letra e 6 números (ex:  j965459).
- Antes de usar, o app confere se aquele código já está ocupado na nuvem; se estiver, gera outro (até 8 tentativas).
- O QR continua funcionando, e o campo "já tenho um código" passa a aceitar só os 6 dígitos, com teclado numérico no celular. Abre a opção de ler um qr
- Códigos longos já existentes continuam válidos (quem já pareou não precisa refazer nada).

Observação: um código de 7 dígitos é bem mais fácil de digitar, mas também mais fácil de alguém acertar por tentativa. Por isso o aviso na tela vai lembrar de sincronizar e, quando terminar, tocar em "Desconectar".

## 2. Desfazer a sincronização

- Antes de cada sincronização, o app guarda no próprio aparelho uma cópia do estado anterior (só a última).
- No painel Sincronizar aparece **"Desfazer última sincronização"**, com confirmação: volta os dados deste aparelho ao ponto anterior à última junção (animais, plantões, curvas, alarmes, medicações, anamneses).
- Após desfazer, o app não sincroniza de novo automaticamente até você tocar em "Sincronizar agora" — assim os dados desfeitos não voltam sozinhos.
- O botão fica escondido quando não existe cópia anterior.
- "Desconectar" continua existindo (para de sincronizar; mantém os dados atuais).

## 3. Explicação de Backup x Sincronização

Texto curto e direto, dentro de cada painel do rodapé:

```text
Backup
Uma cópia congelada dos dados, em arquivo ou por QR.
Serve para guardar ou levar para outro aparelho uma vez.
Não fica atualizando: é uma foto do momento.

Sincronização
Dois aparelhos com o mesmo código ficam sempre iguais.
Tudo que você registrar em um aparece no outro.
Funciona offline: sobe sozinho quando a internet voltar.
```

Cada painel também ganha uma linha "Qual escolher?": *guardar/mudar de aparelho → Backup; usar dois aparelhos ao mesmo tempo → Sincronização.*

## Detalhes técnicos

- `src/lib/sync.ts`: `gerarCodigo()` passa a devolver 6 dígitos; `codigoValido` aceita `^\d{6}$` **ou** o formato antigo `^[a-z0-9]{16,64}$`; `normalizarCodigo` inalterado. `textoQrSync`/`codigoDoQr` mantidos.
- Nova cópia local: chave `veterico-sync-desfazer-v1` gravada em `sincronizarAgora()` antes de `mesclarPacote` (snapshot de `pacoteLocal()`), com funções `podeDesfazer()` e `desfazerUltimaSync()` que reescrevem as chaves de backup e limpam a pendência.
- `src/lib/sync.functions.ts`: schema do código aceita os dois formatos; nova função `codigoLivre({ codigo })` (consulta por hash) usada na geração para evitar colisão. Nenhuma migração de banco necessária — `sync_salas` continua guardando só o hash.
- `src/hooks/useSync.ts`: `criarCodigo` tenta códigos até achar um livre; expõe `desfazer` e `temDesfazer`.
- `src/components/Sincronizacao.tsx`: código exibido em fonte grande espaçada, `inputMode="numeric"` e `maxLength=6` no campo, botão "Desfazer última sincronização" e o bloco explicativo.
- `src/components/Backup.tsx`: bloco explicativo equivalente no topo do painel.
- Nenhuma chamada de IA; sem custo de créditos.