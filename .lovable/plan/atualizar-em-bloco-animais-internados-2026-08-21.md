# Atualizar em bloco (animais internados)

Novo botão **Atualizar em bloco**, na mesma linha de Exportar PDF / Finalizar plantão / Limpar todos os dados.

## Como vai funcionar

1. Toque em "Atualizar em bloco" → abre uma janela.
2. No topo, escolho **um parâmetro**: Temperatura, FC, FR, PAS, Glicemia, Alimentação, Comportamento, Fezes, Mucosas, Urina, Vômito.
3. Abaixo, a lista de **todos os animais internados** (nome + emoji da espécie), em ordem alfabética, sem poder editar o nome nem os outros dados. Ao lado de cada animal, um campo para o valor novo daquele parâmetro:
   - parâmetros numéricos: campo numérico (mostra o valor atual ao lado, como referência);
   - parâmetros de escolha: caixa de seleção com as mesmas opções fixas da ficha.
4. Botão **Atualizar todos** grava, de uma vez, todos os animais em que preenchi algo. Animais deixados em branco ficam intactos.
5. Aviso de quantos animais foram atualizados.

A gravação segue exatamente a regra que já existe no botão "Atualizar" de cada animal:
- o valor novo é somado ao anterior no campo (ex.: `Temperatura: 37,2 / 39,8`);
- entra em Observações a frase "Temperatura atualizada às 14h30 para 39,8 °C.";
- se o valor estiver fora da faixa da espécie, entra também a frase clínica automática (hipertermia, taquicardia, etc.);
- animais com óbito registrado aparecem marcados e vêm com o campo desabilitado.

## Detalhes técnicos

- Novo componente `src/components/AtualizarEmBloco.tsx`: diálogo com seletor de parâmetro e lista de animais (usa `Dialog` do shadcn, opções de campos e emoji já expostos por `src/lib/ficha.ts`).
- Em `src/routes/registros.tsx`: estado de abertura do diálogo, botão na barra de ações e um handler que aplica o mapa `{ registroId: valor }` sobre `registros` via `setRegistros`.
- A lógica de mesclagem é extraída para `src/lib/ficha.ts` (função reutilizável baseada em `mesclarValores`, `fraseAtualizacao`, `avaliarValor`/`frasePorTermo`), para que a página inicial e o modo em bloco compartilhem o mesmo comportamento.
- Nenhuma mudança em PDF, curvas, alarmes ou plantões.
