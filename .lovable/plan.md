# Mais temas, menu em duas linhas e som do alarme pela internet

## 1. Novos temas (9 novos, total 14)

Adiciono ao seletor "Temas" do rodapé:

- **Black** — tudo preto, texto claro
- **Tons de cinza** — escala de cinza, sem cor
- **Escuro azulado** — o "outro escuro", azul-noite
- **Bob Esponja** — amarelo, azul-mar e detalhes divertidos
- **Gatinhos** — rosado suave com várias patinhas/gatinhos discretos ao fundo
- **Verde e cinza** — verde folha com cinzas
- **Profissional** — azul-marinho sóbrio, ar clínico/corporativo
- **Laranja** — laranja quente
- **Minha cor** — você escolhe a cor no app (seletor de cor + alguns atalhos); o app gera automaticamente fundo, botões e contrastes a partir dela

A escolha continua salva no aparelho, agora incluindo a cor personalizada.

## 2. Menu dividido em duas linhas

O menu do topo passa a mostrar metade dos botões em uma linha e a outra metade na linha de baixo (Início, Animais internados, Evolução em cima; Curva, Alarmes, Plantões embaixo), centralizados, em qualquer tamanho de tela.

## 3. Som do alarme pela internet (YouTube / Spotify / Deezer)

Em Alarmes, além das 20 músicas do app, você poderá colar um link do YouTube, Spotify ou Deezer e dar um nome ("Música do YouTube", por exemplo). O link fica salvo junto do alarme.

Importante ser transparente sobre o limite: apps na web **não conseguem tocar Spotify e Deezer sozinhos** (essas plataformas não liberam áudio para outros sites), e o YouTube só toca se a página do app estiver aberta. Então funciona assim:

- **YouTube:** quando o alarme soa com o app aberto, o vídeo começa a tocar dentro da tela do alarme (player embutido, sem imagem grande).
- **Spotify / Deezer:** o alarme soa com uma das músicas do app e aparece um botão grande **"Abrir minha música"** que leva direto para o link. Se o Spotify/Deezer estiver instalado, abre no app.
- Também haverá um botão de **testar** o link ao cadastrar.

## Detalhes técnicos

- `src/lib/tema.ts`: ampliar `TemaId` e `TEMAS` com os 9 novos; para "Minha cor", guardar hex/oklch em `localStorage` e injetar variáveis (`--primary`, `--background`, `--accent`, foregrounds derivados por contraste) direto no `documentElement.style`.
- `src/styles.css`: novas classes `.tema-black`, `.tema-cinza`, `.tema-noite`, `.tema-esponja`, `.tema-gatinhos`, `.tema-verde-cinza`, `.tema-pro`, `.tema-laranja` sobrescrevendo os tokens `oklch` existentes; `.tema-gatinhos body` e `.tema-esponja body` com padrão de fundo em SVG data-URI.
- `src/components/Rodape.tsx`: grade de temas + `<input type="color">` visível apenas no tema "Minha cor".
- `src/components/Cabecalho.tsx`: `<nav>` em duas linhas (dois grupos flex) em vez de um único `flex-wrap`.
- `src/lib/alarmes.ts`: campos opcionais `linkExterno` e `plataforma` ('youtube' | 'spotify' | 'deezer') no tipo `Alarme` (dados antigos seguem válidos).
- `src/components/Alarmes.tsx`: campo de link com detecção automática da plataforma e aviso de limitação.
- `src/components/AlarmeAtivo.tsx`: se `plataforma === 'youtube'`, renderizar iframe do YouTube com `autoplay=1` e silenciar o toque gerado; senão, tocar o toque normal e mostrar o botão "Abrir minha música".
- Tudo offline exceto o link externo, que precisa de internet no momento do disparo.
