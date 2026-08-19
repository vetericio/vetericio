# Reorganizar card de animal internado

## Problema
Na tela de animais internados, o nome do animal fica à esquerda e os botões de ação à direita. Com vários botões (Copiar, Editar, Atualizar, Óbito, Excluir), a fileira de botões estoura a largura e sai da tela no mobile.

## Solução
Reorganizar cada card da lista para a ordem solicitada:

1. **Botões de ação** — no topo, em uma única fileira que pode quebrar linha se necessário.
2. **Animal + emoji** — abaixo dos botões, com destaque (nome da espécie com emoji 🐶/🐱 e badge de óbito quando houver).
3. **Dados** — por último, mantendo o bloco de texto formatado.

## Arquivo a alterar
- `src/components/ListaRegistros.tsx`: reestruturar o `<article>` para colocar os botões antes do título, ajustar espaçamentos e garantir que a fileira de botões quebre corretamente sem sair da tela.

## Critério de aceitação
- Visualizar a página `/registros` no mobile: os botões aparecem no topo do card, o nome do animal fica abaixo e os dados por último.
- Nenhum botão fica cortado ou fora da tela.
- Funcionalidades (copiar, editar, atualizar, óbito, excluir) permanecem intactas.
