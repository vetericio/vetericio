# Via de administração, campo de concentração e menu em 2 colunas

## 1. Via de administração no cadastro de medicamento
- Novo campo "Via" no formulário de cadastro/edição de medicamento, com as opções nesta ordem fixa: IV, IM, SC, VO, OF, OT.
- Botões selecionáveis (dá para marcar mais de uma via, já que o mesmo medicamento costuma ter mais de uma).
- A via aparece no card da medicação na lista (ao lado do nome/classificação) e dentro da tela "Calcular dose".
- Guardado junto do medicamento, entra no backup e na transferência entre aparelhos.
- Medicamentos já cadastrados continuam funcionando, apenas sem via até serem editados.

## 2. Tamanho do campo de concentração
- No cadastro, o valor e a unidade da concentração ficam com larguras proporcionais: o número ocupa espaço menor e a unidade ganha espaço suficiente para ler "mg/comprimido" sem cortar.
- Mesmo ajuste no formulário de pesquisa avulsa, para manter igual.

## 3. Menu sempre em 2 colunas
- O menu do topo passa a ser uma grade de exatamente 2 colunas, com todos os botões do mesmo tamanho.
- Ordem mantida: Início, Animais internados, Medicações, Evolução, Curva, Alarmes, Plantões.
- Com 7 itens, o último ocupa a linha inteira, mantendo o alinhamento das duas colunas.

## Detalhes técnicos
- `src/lib/medicamentos.ts`: novo tipo `Via` e constante `VIAS = ["IV","IM","SC","VO","OF","OT"]`; campo `vias: Via[]` em `Medicamento` (leitura tolerante para registros antigos).
- `src/components/medicamentos/FormMedicamento.tsx`: seletor de vias + ajuste de larguras da concentração.
- `src/components/medicamentos/PesquisaAvulsa.tsx`: mesmo ajuste de larguras.
- `src/routes/medicacoes.tsx` e `CalculadoraDose.tsx`: exibição das vias.
- `src/components/Cabecalho.tsx`: navegação em `grid grid-cols-2 gap-2`.
