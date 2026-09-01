# Anamnese depois das medicações (ficha e PDF)

Hoje a anamnese vinculada (Queixa, Conduta, Atenção) aparece no card do animal internado logo abaixo do nome, antes dos dados, e não sai no PDF.

## O que muda

1. **Card do animal internado**: o bloco da anamnese passa a ficar depois das medicações — ou seja, na sequência dados clínicos → medicações → anamnese → observações/resumo.
2. **PDF e texto copiado**: incluir a anamnese do animal logo após o bloco "Medicações:", no formato compacto:

```text
Anamnese:
- Queixa: ...
- Relato: ...
- Exames: ...
- Conduta: ...
- Atenção: ...
- Pendências: item 1; item 2
```

Só aparecem as linhas preenchidas; se o animal não tem anamnese vinculada, nada é impresso.

## Detalhes técnicos

- `src/lib/ficha.ts`: novo bloco `blocoAnamnese(r, anamneses)` inserido em `formatarRegistro` entre `blocoMedicacoes` e as curvas; `OpcoesFormato` ganha `anamneses?: Anamnese[]` (sem esse campo, lê `carregarAnamneses()` como já é feito com curvas).
- `src/lib/pdf.ts`: reconhece "Anamnese:" como título em negrito com itens recuados, igual ao bloco de medicações, e o regex de fim de curva continua válido.
- `src/components/ListaRegistros.tsx`: mover `<FichaAnamnese />` para depois do `<pre>` de dados; como o texto do card usa `formatarRegistro`, a anamnese passa a vir junto no bloco de texto — o componente separado é removido para evitar duplicação.
- Plantões já arquivados continuam exportando normalmente (anamnese ausente = bloco omitido).
