# Plantão no topo + aba Medicações com leitura de foto offline

## 1. Iniciar / Finalizar plantão no cabeçalho

- No cabeçalho (abaixo da linha da data) entra um único botão grande:
  - Sem plantão ativo: **Iniciar plantão** (ativo). Ao clicar, abre confirmação com "Tem certeza que deseja iniciar o plantão?" e a escolha **Diurno** ou **Noturno** (mantendo a opção de escolher a data manualmente, como já existe hoje).
  - Com plantão ativo: **Finalizar plantão** (ativo). Ao clicar, pede confirmação e, ao confirmar, arquiva o plantão em Plantões (mesmo comportamento do botão atual em Animais internados) e redireciona para /plantoes.
- O diálogo automático de turno na abertura do app deixa de aparecer sozinho: o plantão passa a começar sempre pelo botão.
- O botão "Finalizar plantão" continua existindo em Animais internados (nada é removido lá).

## 2. Aba "Medicações" por animal

Cada animal ganha uma lista de medicações com três campos: **Medicação · Dose · Duração**.

- No card do animal (Animais internados), abaixo dos dados, uma aba/seção "Medicações" mostra as medicações cadastradas e permite adicionar, editar e remover linhas manualmente.
- As medicações entram no texto da ficha (cópia individual e cópia de todos) em bloco próprio:

```text
Medicações:
- Dipirona - 0,5 mL - 3 dias
```

- O PDF exportado passa a imprimir o mesmo bloco de medicações do animal, junto dos demais dados, e as medicações são guardadas no histórico do plantão (para o PDF do plantão finalizado não perder nada).

## 3. Foto → preenchimento automático (offline)

- Botão "Tirar foto / escolher imagem" dentro de Medicações, usando a câmera do celular.
- O texto é lido no próprio aparelho por OCR offline (Tesseract em WebAssembly, com o pacote de português embutido no app e guardado no cache do app após o primeiro carregamento — funciona sem internet depois disso).
- O texto reconhecido é interpretado linha por linha para separar medicação, dose e duração (dose por padrões como mL, mg, cp, UI; duração por "x dias", "por 5 dias", "1x ao dia"), e cada linha vira uma linha editável na tabela.
- A tela mostra o resultado como sugestão: você revisa/corrige e confirma antes de salvar. Se a leitura falhar, o texto bruto aparece para edição manual.
- Aviso: leitura de letra manuscrita é imprecisa; funciona bem com receitas impressas/etiquetas. A revisão manual é sempre necessária.

## Detalhes técnicos

- `src/lib/plantao.ts` / `usePlantaoAtual`: sem mudança de formato; `DialogoTurno` passa a ser controlado pelo botão do `Cabecalho` (props de abertura), com etapa de confirmação; a finalização reusa `usePlantoes` + navegação.
- `src/lib/ficha.ts`: novo campo opcional `medicacoes?: { nome: string; dose: string; duracao: string }[]` em `Registro`, incluído em `formatarRegistro`.
- `src/lib/pdf.ts`: bloco de medicações impresso após os dados do animal, antes da curva.
- Novo `src/components/Medicacoes.tsx` (tabela editável + captura de imagem) e `src/lib/ocr.ts` (carregamento do worker Tesseract e parser das linhas). Dependência nova: `tesseract.js` com os arquivos de idioma servidos de `public/` para uso offline.
