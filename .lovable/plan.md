# Curva contínua, óbito e importar plantão em PDF

## 1. A curva não finaliza mais sozinha

- Hoje, ao finalizar o plantão, as curvas são encerradas e os alarmes desligados.
- Passa a ser: a curva continua ativa normalmente, medindo e tocando o alarme, até você finalizar o plantão.
- Ao finalizar o plantão, aí sim ela é encerrada automaticamente (como acontece hoje) e a foto das medições vai para o histórico daquele plantão.
- Exportar PDF **não** encerra nada: sai o que existe no momento e a curva segue rodando.

## 2. Óbito do animal

- Na lista de animais internados, cada ficha ganha o botão **Óbito**.
- Ao tocar, abre a confirmação: "Confirmar que este animal foi a óbito?" e, em seguida, os campos **hora** (já sugerida a hora atual, editável) e **motivo**.
- Confirmado, a ficha recebe a linha `Óbito: 14h30 — motivo`, o animal fica com selo de óbito na lista (continua entre os internados) e essa informação entra na cópia e no PDF.
- Há como desfazer, caso tenha sido toque errado.

## 3. Gráfico da curva no PDF

- Além das medições em texto, o PDF passa a mostrar **o gráfico da curva** logo abaixo das medições daquele animal.
- Um gráfico por curva, com as horas embaixo e os valores marcados, seguindo a faixa de referência da espécie.
- Se a curva não tiver medições, nada de gráfico — apenas o aviso de que não há medições, como hoje.

## 4. Enviar um plantão em PDF e recuperar os dados

- Em **Plantões**, novo botão **Importar plantão (PDF)**.
- Você escolhe um PDF gerado por este app; ele lê a data/turno, os animais, todos os campos da ficha, observações, resumo, óbito e as medições de curva.
- Mostra uma prévia do que foi encontrado ("12 animais, 3 curvas") para você confirmar antes de salvar.
- Depois de confirmar, o plantão entra no histórico e passa a alimentar **Animais**, **Evolução** e **Curvas** normalmente.
- Se o PDF não for de um plantão deste app, aviso claro em vez de dados errados.

## Detalhes técnicos

- `src/lib/curva.ts`: `Registro` de óbito não afeta curva; nada muda no encerramento além de mover a lógica de encerrar/limpar alarmes para dentro de `finalizarPlantao` (já é onde está) e remover qualquer encerramento acionado por exportação.
- `src/lib/ficha.ts`: `Registro` ganha `obito?: { hora: string; motivo: string }`; `formatarRegistro` inclui a linha `Óbito:` antes de `Observações:`; a linha é preservada na cópia e no PDF.
- `src/components/ListaRegistros.tsx`: botão Óbito + `onObito`; diálogo com hora/motivo em `src/routes/registros.tsx` (`AlertDialog` + inputs), selo visual na ficha.
- `src/lib/pdf.ts`: para cada bloco de animal, desenhar o gráfico da curva com primitivos do jsPDF (linhas/eixos/pontos), sem canvas nem imagem externa — mantém a cópia de texto intacta.
- Importação: `pdfjs-dist` (`getTextContent`) em `src/lib/importar-pdf.ts`; parser reverso do formato de `formatarTodos` (cabeçalho `Nome (Espécie)`, pares `Campo: valor`, bloco de curva `HHhMM - valor unidade`), gerando `Plantao` com `registros` e `curvas`; grava via `usePlantoes`. Tudo offline, sem backend.
