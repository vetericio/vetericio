# Logo no topo, ajustes nas calculadoras, temas e novos toques

## 1. Números de exemplo mais claros

Nas calculadoras de **Taxa de infusão** e **Transfusão sanguínea**, os exemplos dentro dos campos (5,3 / 20 / 14 / 48 / 25) passam a um cinza bem claro, sem se confundir com valor digitado.

## 2. Medicação

- Duração passa a ser **8h · 12h · 24h · outros ____**, os quatro na mesma linha (48h e 7 dias saem). Registros antigos com 48h/7 dias continuam aparecendo como texto em "outros".
- **Quantidade em mL** vira máscara de centavos: digita de trás para frente — `5` → `0,05`, `50` → `0,50`, `125` → `1,25`. Só vale para mL; cápsula/comprimido continua número livre.

## 3. Sua logo no topo e no PDF

Recorto a logo (cão laranja + gato azul no círculo) da imagem que você enviou, deixo o fundo transparente e coloco:

- pequena no cabeçalho, acima de tudo, em todas as páginas;
- no topo do PDF exportado, ao lado do nome da clínica.

## 4. Cinco temas novos + tema Veterício

- **Natal** — verde pinheiro, vermelho e dourado.
- **Jack Skellington** — preto e branco osso, roxo, com morceguinhos e o Zero discretos ao fundo (desenhados no app, uso não comercial).
- **Cansado** — tons baixos, sem brilho, contraste suave para plantão pesado.
- **Feliz** — cores vivas e alegres.
- **Rock** — preto, prata e vermelho, com detalhes de palheta/raio.
- **Veterício** — fundo claro com o padrãozinho de patinhas da sua arte, laranja + azul-petróleo da logo.

Todos entram no seletor "Temas" do rodapé e continuam salvos no aparelho.

## 5. Cinco toques novos (55 no total)

Um animado, um rock e três calmos que combinam com o app. Sobre "música real": o app toca tudo gerado internamente (sem arquivos e sem internet), então uso **melodias reais de domínio público** — por exemplo Alvorada/Reveille, Turkey in the Straw, Greensleeves, Canon de Pachelbel e Clair de Lune — reconhecíveis e legais. Música comercial gravada (rock ou pop atual) exigiria licença e arquivo de áudio; não dá para incluir.

## Detalhes técnicos

- `placeholder:text-muted-foreground/50` nos inputs de `TaxaInfusao.tsx` e `TransfusaoSanguinea.tsx`.
- `Medicacoes.tsx`: `DURACOES_PADRAO = ["8h","12h","24h"]` + outros em `grid-cols-4`; `classificarDuracao` mapeia 48h/7 dias para outros; máscara de centavos no campo quantidade quando `unidade === "mL"`.
- Logo: recorte da imagem enviada → `lovable-assets create` → pointer em `src/assets/logo-veterico.png.asset.json`; usado em `Cabecalho.tsx` e convertido para dataURL em `src/lib/pdf.ts` (`addImage`).
- `src/lib/tema.ts`: 6 novos ids em `TemaId`/`TEMAS`; classes `.tema-natal`, `.tema-jack`, `.tema-cansado`, `.tema-feliz`, `.tema-rock`, `.tema-veterico` em `src/styles.css` sobrescrevendo os tokens `oklch`, com padrões de fundo em SVG data-URI.
- `src/lib/toques.ts`: 5 novos ids em `EXTRAS`/`PADROES` com ciclos de melodia mais longos.
