# Transferir dados entre aparelhos (100% offline)

O app continua sem servidor e sem internet. A transferência é feita por um **arquivo de backup** que você gera em um aparelho e abre no outro (por Bluetooth, cabo, WhatsApp, e-mail, pen drive — como você preferir).

## Nova aba "Backup"

Um botão novo no menu do topo, com três ações:

```text
   [ Gerar backup ]   -> baixa "veterico-backup-29.08.26.json"
   [ Restaurar backup ] -> escolhe o arquivo do outro aparelho
   [ Enviar por QR ]   -> mostra um código para o outro aparelho ler pela câmera
```

## O que vai no backup

Tudo o que hoje fica guardado no aparelho:

- Animais internados do plantão em andamento
- Plantão atual (data e turno)
- Histórico de plantões salvos
- Curvas de glicemia/PAS
- Alarmes configurados
- Tema e cor escolhidos

## Como funciona restaurar

Ao abrir o arquivo no outro aparelho, o app mostra um resumo antes de aplicar
(ex.: "3 animais, 12 plantões, 2 curvas") e pergunta:

- **Substituir tudo** — apaga o que existe neste aparelho e usa o backup.
- **Juntar** — mantém o que já existe e acrescenta o que falta (animais e plantões
  repetidos não são duplicados).

Se o arquivo não for do app ou estiver corrompido, aparece um aviso e nada é alterado.

## QR (para poucos animais)

Para quem não quer mexer com arquivo: um aparelho mostra o QR, o outro lê com a
câmera. Como o QR tem limite de tamanho, se os dados forem grandes o app avisa
para usar o arquivo. A leitura da câmera funciona offline, sem enviar nada
para fora do aparelho.

## Detalhes técnicos

- `src/lib/backup.ts`: `montarBackup()` / `aplicarBackup(dados, modo)` lendo e
  escrevendo as chaves `veterico-*` do `localStorage` (registros, plantões,
  plantao-atual, curvas, alarmes, tema, cor). Formato `{ app: "veterico", versao: 1, criadoEm, dados }`,
  validado com Zod na restauração.
- Merge por `id` (registros/plantões/curvas) para o modo "Juntar".
- Nova rota `src/routes/backup.tsx` com `head()` próprio e link em `src/components/Cabecalho.tsx`.
- Download via `Blob` + `URL.createObjectURL`; leitura via `<input type="file">` + `FileReader`.
- QR: `qrcode` para gerar e `jsqr` + `getUserMedia` para ler, ambos client-side,
  carregados por import dinâmico; dados comprimidos com `deflate` + base64 antes do QR.
- Após restaurar, os stores (`useRegistros`, `usePlantoes`, `useCurvas`, `useAlarmes`)
  são recarregados para a tela atualizar na hora.
- Nenhuma chamada de rede, nenhum backend.
