# Espécie, novas opções de alimento e alertas nos números

## 1. Alimentação — novas opções

Adicionar **Comida própria** e **Frango** à lista de opções de Alimentação (junto de Ração, Patê, Ração + patê, Forçado, Recuperação, Jejum, Não alimentou, Líquido, Sonda).

## 2. Espécie depois do nome

Ao lado/abaixo do campo Animal, dois botões: **Cachorro** / **Gato**.

- A espécie escolhida define as faixas de referência dos números.
- No texto exportado, aparece depois do nome, na mesma linha:

```text
Saturna (Cachorro)
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
- A frase fica registrada no histórico: se o valor voltar para a faixa normal, a
  observação **permanece** (é o registro do que aconteceu e quando). Nada é apagado
  automaticamente — o texto escrito à mão também é preservado.
- Cada situação entra uma vez por valor digitado; se o valor mudar de categoria
  (ex.: de hipotermia para hipertermia), a nova frase é acrescentada com sua própria
  data e hora, abaixo da anterior.

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
