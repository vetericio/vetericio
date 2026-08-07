# Espécie, novas opções de alimento e alertas nos números

## 1. Alimentação — novas opções

Adicionar **Comida própria** e **Frango** à lista de opções de Alimentação (junto de Ração, Patê, Ração + patê, Forçado, Recuperação, Jejum, Não alimentou, Líquido, Sonda).

## 2. Espécie logo abaixo do nome

Abaixo do campo Animal, dois botões: **Cachorro** / **Gato**.

- A espécie escolhida define as faixas de referência dos números.
- Aparece no texto exportado, na linha seguinte ao nome:

```text
Saturna
Cachorro
Alimentação: Patê.
...
```

- Sem espécie escolhida, os números não recebem alerta nem observação automática.

## 3. Números fora da faixa: campo em vermelho + observação automática

Ao digitar um valor fora da faixa da espécie, o campo fica **vermelho** e uma frase é
adicionada automaticamente nas Observações:

```text
Animal com hipotermia em 07/08/2026 às 09:05.
```

Faixas de referência:

| Parâmetro | Cão | Gato | Abaixo | Acima |
| --- | --- | --- | --- | --- |
| Temperatura (°C) | 37,5–39,5 | 37,5–39,5 | Hipotermia | Hipertermia |
| FC (bpm) | 60–180 | 140–220 | Bradicardia | Taquicardia |
| FR (irpm) | 18–34 | 20–30 | Bradipneia | Taquipneia |
| PAS (mmHg) | 110–160 | 90–170 | Hipotensão | Hipertensão |
| Glicemia (mg/dL) | 70–120 | 80–150 | Hipoglicemia | Hiperglicemia |

- FR igual a 0 gera **apneia**.
- A data/hora é a do momento em que o valor fora da faixa foi digitado.
- Cada situação entra uma única vez; se o valor voltar para a faixa (ou mudar de
  categoria), a frase correspondente é removida/atualizada, sem apagar o texto que o
  usuário escreveu à mão.
- Abaixo dos campos numéricos, um resumo das faixas da espécie selecionada, para
  referência rápida.

## Detalhes técnicos

- `src/lib/ficha.ts`: adicionar `especie` ao tipo `Registro` e a `REGISTRO_VAZIO`;
  incluir as novas opções em `OPCOES.alimentacao`; nova tabela `FAIXAS` por espécie;
  helpers `avaliarValor(chave, valor, especie)` → `{ fora: boolean, termo: string }`,
  `frasePorTermo(termo, data)` e ajuste de `formatarRegistro` para imprimir a espécie
  logo após o nome.
- `src/components/FormAvaliacao.tsx`: botões de espécie, borda/texto vermelhos
  (tokens `destructive`) nos inputs fora da faixa, e sincronização das frases
  automáticas em Observações via marcador de linhas geradas (linhas que começam com
  "Animal com ") para poder substituí-las sem tocar no texto manual.
- Registros antigos sem `especie` continuam válidos (campo opcional/vazio).
