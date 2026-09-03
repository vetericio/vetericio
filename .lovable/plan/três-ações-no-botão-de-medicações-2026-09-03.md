# Três ações no botão "+" de Medicações

O botão "+" continua igual. Ao tocar nele, aparecem três bolinhas menores acima dele; tocar fora fecha.

## 1. Bolinha de cima — Adicionar medicamento

Abre o cadastro em branco, exatamente como o "+" faz hoje.

## 2. Bolinha do meio — Atualizar medicamento

- Abre um modal com uma lista/campo de busca com o nome de todos os medicamentos cadastrados.
- Ao escolher um, abre o formulário de cadastro já preenchido com aquele medicamento.
- Salvar atualiza o registro existente (mesmo `id`), sem duplicar.

## 3. Bolinha de baixo — Completar inserção

- Abre uma tela única com todos os medicamentos que tenham algum campo vazio.
- Considera-se incompleto quando falta: concentração (valor ou unidade), nenhuma via marcada, resumo, classificação, ou dose (mínima/unidade/intervalo) da espécie aplicável. "Nome menor" é opcional e nunca conta como falta. Espécie marcada como proibida não cobra dose.
- Para cada medicamento mostra somente os campos que estão faltando, um bloco por medicamento com o nome no topo.
- Botão "Salvar" fixo na parte superior da tela: grava de uma vez todos os medicamentos alterados.
- Nada que já esteja preenchido é alterado ou apagado.
- Medicamento que ficar completo deixa de aparecer nessa tela.

## Fora do escopo

Nenhuma outra tela, cálculo, layout global, plantão, animal, anamnese ou backup é alterado. Sem backend e sem novas dependências.

## Detalhes técnicos

- `src/routes/medicacoes.tsx`: substitui o botão fixo por um pequeno "speed dial" (estado local `menuAberto`), com as três ações; reaproveita `abrirNovo` e `abrirEdicao`.
- Novo `src/components/medicamentos/DialogoEscolherMedicamento.tsx`: modal com busca simples sobre `ordenarMedicamentos(medicamentos)`, retorna o medicamento escolhido para o `FormMedicamento` já existente.
- Novo `src/components/medicamentos/CompletarInsercao.tsx`: dialog em tela cheia; função local `camposFaltantes(m)` decide o que renderizar; estado de rascunho em memória; ao salvar chama `salvar(m)` do `useMedicamentos` para cada item alterado.
- Reaproveita os mesmos controles/estilos do cadastro (unidades de concentração, botões de via, campos de dose) — sem mexer em `src/lib/medicamentos.ts` nem em `FormMedicamento.tsx`.
