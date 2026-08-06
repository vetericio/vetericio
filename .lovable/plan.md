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
- Mantém copiar, compartilhar, apagar todos, editar/excluir por item e o texto exportado.

## Detalhes técnicos

- Novo componente `src/components/Cabecalho.tsx` (título, subtítulo e navegação com `Link` + `activeProps`), renderizado em `src/routes/__root.tsx` acima do `<Outlet />` para não remontar entre rotas.
- `TaxaInfusao.tsx`: apenas troca do texto da unidade para `mL/dia`.
- `index.tsx` e `registros.tsx`: remoção dos cabeçalhos/botões duplicados; títulos de `head()` permanecem distintos por rota.
