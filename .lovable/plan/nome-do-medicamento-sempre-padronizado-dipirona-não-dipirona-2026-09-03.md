# Nome do medicamento sempre padronizado (Dipirona, não DIPIRONA)

## Problema

Na lista de Medicações o nome do medicamento é exibido com estilo de caixa alta forçada (`uppercase`), então mesmo salvo como "Dipirona" ele aparece "DIPIRONA". Além disso, alguns pontos de exibição mostram o nome cru salvo, sem passar pela padronização já existente.

## O que muda

1. Remover a caixa alta forçada do nome do medicamento no card da lista de Medicações.
2. Aplicar a padronização existente (`normalizarNomeMedicamento`) na exibição do nome principal e do "Nome menor" em:
   - card da lista de Medicações
   - cabeçalho do formulário de edição do medicamento
   - diálogo de aplicação/quantidade
   - lista de medicações do animal
3. Manter a normalização já feita ao salvar, para que cadastros antigos gravados em caixa alta apareçam corretos sem precisar reeditar.

Nada muda em dose, concentração, vias, frequência, quantidade, exportação de texto/PDF, plantões, animais ou temas.

## Detalhes técnicos

- `src/routes/medicacoes.tsx`: tirar `uppercase` da linha do nome e envolver `m.nome` / `m.nomeMenor` em `normalizarNomeMedicamento`.
- `src/components/medicamentos/FormMedicamento.tsx`: normalizar o nome exibido no topo do formulário de edição.
- `src/components/medicamentos/DialogoQuantidade.tsx` e `DialogoAplicar.tsx`: normalizar o nome mostrado, sem alterar o valor gravado.
- `src/lib/ficha.ts` (`nomeMedicacao`) já normaliza — sem alteração.
- Sem dependências novas, sem backend, sem migração de dados.

## Verificação

- `bunx tsgo --noEmit`
- Conferir no preview que um medicamento salvo como "DIPIRONA" aparece "Dipirona" na lista, na edição e ao aplicar.
