# Diferenciar botão de medicação e remover pré-seleção de duração

## Objetivo
Melhorar a usabilidade da seção de medicações para quem tem TDAH, deixando a ação de adicionar uma medicação visualmente distinta do botão de envio da ficha e tirando a pré-seleção automática da duração.

## Alterações

### 1. Botão de adicionar medicação
- Em `src/components/Medicacoes.tsx`, trocar o rótulo do botão interno de **"Enviar"** para **"Adicionar medicação"**.
- Mudar o estilo para um botão de ação secundária (visual diferente do botão principal da ficha), mantendo-o alinhado à direita dentro do quadro de medicação.
- Adicionar separação visual (borda superior / espaçamento extra) entre o formulário de medicação e o botão principal "Enviar" da ficha, para que as duas ações não pareçam a mesma coisa.

### 2. Duração sem pré-seleção
- Em `src/components/Medicacoes.tsx`, iniciar o estado `duracao` como vazio (`""`), sem nenhum radio selecionado.
- Atualizar `parseDuracao` para retornar modo vazio quando não houver duração salva.
- Ajustar `resetForm` para voltar ao estado vazio ao adicionar/editar uma medicação.
- Permitir enviar a medicação com duração em branco caso o usuário não selecione nenhuma opção (a duração será salva como string vazia, mantendo compatibilidade).
- Manter a opção "outros" funcionando como hoje: ao selecionar, abre o campo de texto; se preenchido, salva o valor livre.

### 3. Espaçamento na ficha (se necessário)
- Em `src/components/FormAvaliacao.tsx`, revisar o espaçamento entre a seção "Medicações" e o botão principal "Enviar" da ficha, garantindo clareza visual.

## Não alterar
- `src/lib/ficha.ts`: tipo `Medicacao` continua `{ nome: string; dose: string; duracao: string }`.
- `src/lib/medicacoes.functions.ts`: IA continua devolvendo string livre para duração.
- Exportação/PDF: já lêem `duracao` como string e continuam compatíveis.
