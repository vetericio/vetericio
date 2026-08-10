# Alimentação "outro", busca alfabética e calculadora ao vivo

## 1. Alimentação

- Remover a opção "Líquido".
- Adicionar "Iogurte".
- Adicionar a opção "Outro". Ao selecioná-la, abre um campo de texto logo abaixo para escrever o alimento.
- O que for escrito passa a valer como a opção escolhida: aparece igual às outras no texto copiado, no PDF, no resumo e nos gráficos de evolução.
- Se o campo ficar vazio, o valor fica em branco (como nenhuma opção escolhida).

## 2. Animais internados

- A lista passa a ficar sempre em ordem alfabética pelo nome (ignorando acentos e maiúsculas).
- Acima da lista, um campo "Procurar animal" filtra por nome enquanto digita, com aviso quando nenhum nome bate.
- Exportar, copiar todos, finalizar plantão e limpar continuam agindo sobre todos os animais, não apenas sobre os filtrados.

## 3. Calculadora

- O resultado aparece automaticamente embaixo da operação enquanto digita (sem apertar =).
- Ao tocar em "=", a operação é substituída pelo resultado, ficando só o resultado na tela, pronto para continuar a conta.
- A tecla "=" permanece no teclado.

## Detalhes técnicos

- `src/lib/ficha.ts`: em `OPCOES.alimentacao` trocar "Líquido" por "Iogurte"; o valor livre de "Outro" continua sendo salvo em `registro.alimentacao` como string, então formatação/resumo não mudam.
- `src/components/FormAvaliacao.tsx`: para o grupo `alimentacao`, renderizar chip extra "Outro"; estado local `outroAlimento` controla o input; chip ativo quando `valores.alimentacao` não está na lista fixa; ao digitar, `set("alimentacao", texto)`.
- `src/components/ListaRegistros.tsx`: nova prop `busca` (ou ordenar/filtrar em `registros.tsx` antes de passar) — ordenar com `localeCompare("pt-BR")` sobre nome normalizado.
- `src/routes/registros.tsx`: estado `busca` + input controlado; passar lista ordenada/filtrada para `ListaRegistros`, mantendo `registros` completo nas ações em massa.
- `src/components/Calculadora.tsx`: calcular `previa = avaliar(expr)` em tempo real (ignorar "Erro" para expressões incompletas); "=" define `setExpr(previa)` e limpa a linha de operação.
