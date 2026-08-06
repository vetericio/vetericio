# Ajustes: taxa de infusão, cabeçalho fixo e navegação

## 1. Taxa de infusão (rótulo correto)

O cálculo `130 × peso^0,75` (cachorro) e `80 × peso^0,75` (gato) está certo, mas o resultado é volume por **dia**, não por hora.

- Trocar a unidade exibida de `mL/h` para `mL/dia`.
- Manter o campo Peso aceitando `5,3` ou `5.3` e o resultado com uma casa decimal e vírgula.
- Exemplo com 10 kg: Cachorro 731,1 mL/dia · Gato 449,9 mL/dia.

## 2. Cabeçalho fixo em todas as páginas

O título "Veterício Serviços Veterinários LTDA" + "Ficha de Avaliação da Internação" sai do cabeçalho da página inicial e passa a ser um cabeçalho compartilhado, exibido igual nas duas páginas, sem recarregar ao trocar de página.

Logo abaixo do subtítulo, uma linha de navegação com dois botões:

```text
        Veterício Serviços Veterinários LTDA
           Ficha de Avaliação da Internação

        [ Início ]   [ Animais registrados (3) ]
```

- A página inicial passa a se chamar **Início**.
- O botão ativo fica destacado.
- O contador de animais aparece no botão de registros.

## 3. Página inicial

- Remove o botão "Animais registrados" que estava no fim da página (agora está no topo).
- Ordem: cabeçalho → navegação → calculadora + cronômetro/taxa → formulário → instalar app.

## 4. Página de registros

- Remove o cabeçalho próprio e o botão "Nova ficha" (a navegação do topo já cobre isso).
- Mantém apagar todos, editar/excluir por item e o texto exportado.

## 5. Copiar e exportar

- **Copiar** em cada animal da lista: copia só o texto daquele registro.
- **Copiar todos**: copia o texto completo, com os animais numerados (1, 2, 3...).
- **Exportar PDF**: gera um PDF com todos os animais, título "Veterício Serviços Veterinários LTDA", subtítulo "Ficha de Avaliação da Internação", data, e cada animal numerado com quebra de página automática. Baixa como `veterico-fichas.pdf`.
- Confirmação por toast em cada ação ("Texto copiado", "PDF gerado").
- Tudo funciona offline (geração no próprio aparelho).

## 6. Salvar por plantão (histórico dos 10 últimos)

Os animais em andamento ficam no plantão atual. Quando o plantão termina, ele é arquivado no histórico.

- Botão **Fechar plantão** na página de registros: pede a **data** (já vem preenchida com a de hoje) e um **turno** opcional (Diurno / Noturno), salva o plantão com todos os animais e limpa a lista para começar o próximo.
- Nova página **Plantões** (botão no cabeçalho, ao lado de Início e Animais registrados) listando os plantões salvos, do mais recente para o mais antigo: data, turno e quantidade de animais.
- Ao abrir um plantão salvo: ver o texto completo, **copiar**, **exportar PDF** e **excluir** aquele plantão.
- Guarda apenas os **10 últimos** plantões; ao fechar o 11º, o mais antigo é descartado automaticamente.
- Tudo salvo no próprio aparelho, funcionando offline.

## Detalhes técnicos


- Novo componente `src/components/Cabecalho.tsx` (título, subtítulo e navegação com `Link` + `activeProps`), renderizado em `src/routes/__root.tsx` acima do `<Outlet />` para não remontar entre rotas.
- `TaxaInfusao.tsx`: apenas troca do texto da unidade para `mL/dia`.
- `index.tsx` e `registros.tsx`: remoção dos cabeçalhos/botões duplicados; títulos de `head()` permanecem distintos por rota.
- `ListaRegistros.tsx`: botão Copiar por item usando `formatarRegistro` + `navigator.clipboard`.
- PDF no cliente com `jspdf` (instalar), em `src/lib/pdf.ts`, usando fonte com acentuação e quebra de linha/página; import dinâmico para não pesar o carregamento inicial.
- Plantões: tipo `Plantao { id, data, turno, registros }` em `src/lib/ficha.ts`, hook `src/hooks/usePlantoes.ts` com `localStorage` (chave `veterico-plantoes-v1`, corte nos 10 mais recentes) e nova rota `src/routes/plantoes.tsx` com `head()` próprio.

