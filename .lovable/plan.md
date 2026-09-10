# Veterício mais fácil para TDAH e autismo

Li todas as telas do app. Ele funciona bem, mas hoje pede muita atenção de uma vez: telas cheias, muitos avisos "tem certeza?", alarme forte sem controle fino e 19 temas sem um "modo calmo". Abaixo, o que dá para melhorar, em ordem de impacto.

## O que atrapalha hoje (o que encontrei)

1. **Avisos do navegador** (aquelas caixinhas cinzas do sistema) em Animais internados, Anamnese, Pendências, Curva, Plantões e no botão de finalizar plantão. São ásperas, fora do visual do app e não têm "desfazer".
2. **Apagar tudo em Plantões pede confirmação 4 vezes seguidas**, com textos diferentes e sem dizer "1 de 4". É cansativo e confuso.
3. **Iniciar plantão pergunta "Tem certeza?"** para uma ação simples e reversível. Isso acostuma a ignorar avisos de verdade.
4. **Exclusões sem desfazer**: medicação, medição da curva, pendência da anamnese e alarme desaparecem na hora.
5. **Tela de Início muito cheia**: calculadora e ferramentas clínicas ficam sempre abertas, competindo com a ficha.
6. **Cartão de medicação com muita informação e botões minúsculos** (estrela e "⋯" são pequenos demais para o dedo).
7. **Duas navegações separadas** (3 itens no topo, 8 no menu lateral) e itens bloqueados que só explicam o motivo em "tooltip", que não aparece no celular.
8. **Alarme**: tela cheia, som em laço e vibração repetida a cada 18 segundos, sem volume nem opção de vibração desligada. Na lista de toques, 55 sons com play, fácil disparar sem querer.
9. **19 temas misturados** (Bob Esponja, Natal, Gatinhos junto com Sóbrio e Cinza), sem nenhum indicado como calmo/baixo estímulo. "Minha cor" pode gerar combinação de baixa leitura.
10. **Textos que exigem memória**: por exemplo "só vai para Animais internados depois que a ficha for enviada no Início".

## Etapa 1 — Calma e previsibilidade (maior ganho)

- Trocar **todas** as caixinhas do navegador por janelas do próprio app, sempre com o mesmo formato: título curto, o que vai acontecer, botões "Cancelar" e a ação nomeada ("Excluir Tramadol", não "OK").
- "Apagar todos os plantões": **uma única** janela, com a frase do que será perdido e o passo indicado ("passo 1 de 2" quando fizer sentido digitar APAGAR para confirmar).
- Iniciar plantão deixa de perguntar "Tem certeza?" e passa a ser uma tela simples de escolha do turno.
- **Desfazer de 6 segundos** no aviso após excluir medicação, medição da curva, pendência e alarme.
- Deixar as janelas todas com o mesmo comportamento de teclado (fecha com Esc, foco no lugar certo).

## Etapa 2 — Modo calmo

- Novo botão **"Modo calmo"** na tela de Temas, que de uma vez: usa um tema sóbrio de bom contraste, tira animações, deixa alarme em volume baixo, desliga vibração repetida e esconde as ferramentas extras do Início.
- Reorganizar Temas em dois grupos claros: **Sóbrios** e **Divertidos**.
- Em "Minha cor", ajustar automaticamente para o texto continuar legível.

## Etapa 3 — Menos coisa na tela

- No Início, calculadora e ferramentas clínicas passam a ficar recolhidas, abrindo com um toque, e lembram a escolha.
- No cartão de medicação: informação essencial visível (nome, concentração, dose e volume) e o resto em "ver detalhes".
- Estrela e "⋯" ganham área de toque maior; os pontinhos do carrossel também.

## Etapa 4 — Alarme sob controle

- Controle de **volume** e chave de **vibração** na tela de Alarmes.
- Quando o alarme toca: som cresce suave em 3 segundos, vibração só uma vez (ou nunca, se desligada), e os botões continuam grandes: "Parar" e "Soneca".
- Na lista de toques, tocar a prévia por poucos segundos e só um som por vez.

## Etapa 5 — Não se perder

- Menu único: os 3 itens do topo continuam, e o menu lateral passa a mostrar **todos** os destinos agrupados (Atendimento / Registros / Ferramentas / Ajustes), com a seção atual marcada.
- Itens bloqueados passam a mostrar o motivo em texto visível e o botão "Iniciar plantão" ali mesmo.
- Rever frases longas: cada uma vira instrução direta do que fazer agora.

## Detalhes técnicos

- Substituir `window.confirm`/`window.prompt` por `AlertDialog` (Radix) em `registros.tsx`, `plantoes.tsx`, `pendencias.tsx`, `curva.tsx`, `anamnese.tsx`, `Cabecalho.tsx`; criar um componente único `ConfirmarAcao` para padronizar.
- `DialogoTurno.tsx` migra para `Dialog` do Radix (foco, Esc, `aria-modal`).
- Desfazer via `toast` com ação, guardando o item removido em estado local por 6s antes da gravação definitiva.
- Preferências novas em `localStorage` (`veterico-conforto-v1`: modo calmo, volume, vibração, seções recolhidas), incluídas no backup e na sincronização.
- `tema.ts`: campo `grupo: "sobrio" | "divertido"` e clamp de contraste em `aplicarCorPersonalizada`.
- `AlarmeAtivo.tsx`: fade-in de ganho, vibração condicional, remover o `setInterval` de 18s.
- `index.tsx`: substituir `window.location.assign("/")` por navegação do router, preservando foco.
- Alvos de toque mínimos `min-h-11 min-w-11` nos botões pequenos de `medicacoes.tsx` e `FerramentasClinicas.tsx`.
- Versão sobe para 1.53.

Nada de dados apagados, nenhuma dose alterada, nenhum cálculo mexido.
