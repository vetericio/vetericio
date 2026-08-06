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

## Detalhes técnicos

- Novo componente `src/components/Cabecalho.tsx` (título, subtítulo e navegação com `Link` + `activeProps`), renderizado em `src/routes/__root.tsx` acima do `<Outlet />` para não remontar entre rotas.
- `TaxaInfusao.tsx`: apenas troca do texto da unidade para `mL/dia`.
- `index.tsx` e `registros.tsx`: remoção dos cabeçalhos/botões duplicados; títulos de `head()` permanecem distintos por rota.
- `ListaRegistros.tsx`: botão Copiar por item usando `formatarRegistro` + `navigator.clipboard`.
- PDF no cliente com `jspdf` (instalar), em `src/lib/pdf.ts`, usando fonte com acentuação e quebra de linha/página; import dinâmico para não pesar o carregamento inicial.

