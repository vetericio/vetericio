# Novo menu lateral e "Assinar um documento"

## 1. Menu de cima mais curto

O menu no topo passa a ter apenas três botões:

```text
        [ Início ]   [ Animais internados ]   [ Anamnese ]
```

O botão "Iniciar/Finalizar plantão", a logo, o título e a contagem de registros continuam iguais.

## 2. Botão das três barrinhas

No canto superior esquerdo da página, fixo em todas as telas, aparece o botão ☰. Ao tocar, abre um painel lateral com:

- Medicações
- Curva
- Alarmes
- Plantões
- Assinar um documento

As telas que só funcionam com plantão ativo (Curva e Alarmes) continuam bloqueadas quando não há plantão, como hoje. O painel fecha ao escolher uma opção.

## 3. Assinatura e carimbo salvos

Na nova tela, um espaço para guardar:

- **Assinatura** (foto ou imagem)
- **Carimbo** (foto ou imagem)

Ao subir a imagem, o app tenta deixar o fundo branco transparente, para ficar bonito sobre o documento. Você vê a prévia e pode trocar ou apagar.

Ficam salvos no aparelho até você trocar, e entram no backup e na sincronização entre aparelhos.

## 4. Assinar o documento

```text
   [ Escolher arquivo ]  -> PDF ou foto (JPG/PNG)

   página 1 de 3   [ < ]  [ > ]

   ┌──────────────────────────┐
   │  documento na tela        │
   │        ✍  (arrastar)      │
   │              ⬛ carimbo    │
   └──────────────────────────┘

   [ + Assinatura ]  [ + Carimbo ]     [ Salvar PDF assinado ]
```

- Sobe um PDF (várias páginas) ou uma imagem, que vira um PDF.
- Toca em "+ Assinatura" ou "+ Carimbo" para colocar na página; arrasta com o dedo e ajusta o tamanho pelo canto. Pode remover e pode colocar em mais de uma página.
- Ao salvar, baixa o arquivo com o nome:

```text
Nome do arquivo (assinado vetericio).pdf
```

- Se o arquivo veio de uma foto, o nome segue o mesmo padrão, terminando em `.pdf`.
- Tudo acontece no próprio aparelho, sem internet e sem enviar o documento para nenhum lugar.

&nbsp;

Atualizar a versão no final do app

## O que não muda

Fichas, plantões, medicações, alarmes, curvas, anamnese, calculadoras, backup e sincronização continuam funcionando exatamente como hoje.

## Detalhes técnicos

- `src/components/Cabecalho.tsx`: `LINKS` reduzido a `/`, `/registros`, `/anamnese` (uma linha só); demais itens migram para o novo menu.
- Novo `src/components/MenuLateral.tsx`: botão fixo (`fixed left-2 top-2 z-40`) + `Sheet` do shadcn com os links Medicações, Curva, Alarmes, Plantões, Assinar documento; reusa a regra `SO_COM_PLANTAO` (extraída para `src/lib/navegacao.ts`) para desabilitar itens sem plantão. Renderizado em `src/routes/__root.tsx`, fora do `<Outlet />`, para não remontar.
- Nova rota `src/routes/assinar.tsx` com `head()` próprio, envolvendo `src/components/AssinarDocumento.tsx`.
- `src/lib/assinatura.ts`: chaves `veterico-assinatura-v1` e `veterico-carimbo-v1` no `localStorage` guardando data URL PNG; `removerFundoBranco(dataUrl)` via `<canvas>` (pixels claros acima de um limiar viram alpha 0); adicionadas a `CHAVES_BACKUP` em `src/lib/backup.ts` e ao grupo `SIMPLES` da sincronização (última alteração vence).
- Instalar `pdf-lib` (edita PDF existente; `jspdf` não abre PDFs) e `pdfjs-dist` para renderizar as páginas no `<canvas>` da prévia; ambos por import dinâmico. O worker do pdf.js é carregado do bundle local (`?url`), sem CDN.
- Posicionamento: overlay em coordenadas relativas (0–1) sobre o canvas da página; ao salvar, `page.drawImage` com `x/y/width` convertidos para pontos do PDF, respeitando `page.getSize()` e rotação.
- Imagem de entrada: `PDFDocument.create()` + `embedJpg/embedPng` em uma página do tamanho da imagem.
- Download via `Blob` + link temporário, nome `${nomeBase} (assinado vetericio).pdf`.
- Toques (arrastar/redimensionar) com Pointer Events, sem dependência extra.