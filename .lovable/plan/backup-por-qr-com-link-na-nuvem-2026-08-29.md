# Backup por QR com link na nuvem

O QR passa a carregar um **link temporário** em vez dos dados brutos. Assim o tamanho do backup deixa de ser um problema: o outro aparelho lê o QR (ou abre o link), baixa o backup e escolhe entre substituir ou juntar.

Nada de IA envolvido — só banco de dados e envio/leitura do arquivo, então **não consome créditos de IA**.

## Como fica no app

No painel **Backup** (rodapé, ao lado de Temas):

```text
   [ Gerar backup ]        -> arquivo .json (offline, como hoje)
   [ Restaurar backup ]    -> escolher arquivo (offline, como hoje)
   [ Enviar por QR ]       -> envia para a nuvem e mostra o QR + código de 6 dígitos
   [ Ler QR ]              -> câmera lê o QR e baixa os dados
   [ Tenho um código ]     -> digitar os 6 dígitos, se a câmera falhar
```

O QR agora mostra sempre, sem aviso de "dados grandes".

Debaixo do QR aparece: **"Válido por 24 horas. Precisa de internet nos dois aparelhos."**

## Fluxo

1. Aparelho A toca em **Enviar por QR**: o app envia o backup para a nuvem e recebe um link com um código secreto.
2. O QR mostra esse link; abaixo dele, o código curto de 6 dígitos para digitar à mão.
3. Aparelho B lê o QR (ou digita o código), o app baixa o backup e mostra o resumo ("3 animais, 12 plantões, 2 curvas").
4. B escolhe **Substituir tudo** ou **Juntar** — igual ao fluxo por arquivo.
5. Depois de 24 horas o backup enviado é apagado automaticamente.

Se não houver internet, o app avisa e sugere o backup por arquivo, que continua 100% offline.

## Privacidade

- Os dados ficam na nuvem apenas até serem usados ou por 24 horas.
- Só quem tem o código do QR consegue baixar; o app nunca lista transferências de terceiros.
- Sem login: quem tem o código, tem o backup — por isso a validade curta.
- Opção **Apagar agora** ao lado do QR, para remover o backup da nuvem na hora.

## Detalhes técnicos

- Tabela `public.transferencias` (já criada): `id`, `dados jsonb`, `criado_em`, `expira_em` (24h). RLS ativa **sem** políticas — nenhum acesso direto pelo cliente.
- Migração complementar: coluna `codigo text unique` (6 dígitos) + índice, para a entrada manual.
- `src/lib/transferencia.functions.ts` com `createServerFn`, sem autenticação (o segredo é o código), usando `supabaseAdmin` carregado dentro do handler:
  - `enviarTransferencia({ dados })` → grava a linha, apaga expiradas, devolve `{ id, codigo }`.
  - `buscarTransferencia({ codigo })` → devolve `dados` se não expirou, senão `null`.
  - `apagarTransferencia({ codigo })`.
  - Validação com Zod: código `^[0-9]{6}$`, tamanho máximo do payload.
- `src/components/Backup.tsx`: substitui a compactação `pako`/limite de 2200 caracteres por QR de URL (`{origin}/?transfer=CODIGO`), mantém a leitura por câmera com `jsqr` e ganha o campo de código manual. A validação/merge segue em `src/lib/backup.ts` (`validarBackup`, `aplicarBackup`).
- `src/routes/index.tsx`: se a URL tiver `?transfer=CODIGO`, abre direto o resumo da restauração.
- O backup por arquivo e o merge por `id` permanecem inalterados.
- Nenhuma chamada ao AI Gateway.
