# Medicações: tela única de cálculo, dose mín/máx e edição com exclusão

## 1. Interações (tirar o "segurar")
- Remover o long press que abria o menu suspenso no card.
- Toque no card abre direto **Editar medicamento**.
- Dentro do formulário de edição, um botão **Excluir medicamento** (vermelho, no fim), com confirmação "Tem certeza que deseja excluir NOME? Essa ação não pode ser desfeita." — só exclui depois do confirmar.
- Card mantém apenas os botões simples: Editar e Pesquisa avulsa (o cálculo já aparece no próprio card).

## 2. Tela principal = calculadora
Ordem fixa da tela `/medicacoes`:

```text
PESO DO ANIMAL
[ 3,6 ] kg
🐶 Cão   🐱 Gato
--------------------------
🔎 Buscar medicação...
--------------------------
lista de todos os medicamentos
```

- O bloco de peso + espécie fica **fixo no topo** (sticky) enquanto rolo a lista.
- Mudar o peso ou trocar Cão/Gato recalcula toda a lista automaticamente.
- O peso nunca é salvo no cadastro do medicamento — pertence só à calculadora.
- Sem busca: mostra todos os medicamentos, em lista compacta e alfabética.
- Com busca: filtra pelo nome em tempo real.

## 3. Card de cada medicamento
```text
DIPIRONA
VO/IM • 500 mg/mL

DOSE
72 – 90 mg
20 – 25 mg/kg
a cada 8 horas

QUANTIDADE A APLICAR
0,14 – 0,18 mL
```
- Nome grande em maiúsculas; abaixo, vias + concentração em uma linha só.
- DOSE: primeiro o valor calculado para aquele animal (grande), depois a referência cadastrada (menor).
- Intervalo em seguida, discreto.
- QUANTIDADE A APLICAR é o maior destaque: número enorme e a unidade (mL, comprimidos, gotas) **na mesma linha, logo depois, menor, na mesma cor**.
- Sem peso informado: mostra apenas dose de referência e intervalo, com "Informe o peso" no lugar do volume.

## 4. Dose mínima e máxima
- No cadastro, cada espécie ganha **Dose mínima** e **Dose máxima** (+ intervalo).
- Preencher só um dos dois já funciona: vira dose única.
- Com os dois preenchidos, tanto a dose calculada quanto a quantidade a aplicar aparecem como faixa (`72 – 90 mg`, `0,14 – 0,18 mL`).
- Medicamentos já cadastrados continuam válidos: a dose atual passa a ser a mínima.

## 5. Dose por animal
- Em cada espécie, escolha entre **mg/kg** e **mg/animal**.
- Em mg/animal a dose não multiplica pelo peso; o card mostra `10 mg` e abaixo `10 mg/animal`.
- O volume continua sendo dose total ÷ concentração.

## 6. Botão +
- Mantido como botão flutuante no canto inferior direito, abrindo o cadastro de nova medicação.

## 7. O que não muda
- A matemática de dose total ÷ concentração, as unidades e as mensagens de "informação insuficiente" continuam iguais.
- Pesquisa avulsa, backup/transferência e o resto do app seguem intactos (o backup passa a levar os novos campos automaticamente).

## Detalhes técnicos
- `src/lib/medicamentos.ts`: `DoseEspecie` ganha `doseMin`, `doseMax`, `porAnimal: boolean` com leitura tolerante do campo antigo `dose`; nova função `calcularFaixa()` que reaproveita `calcularDose()` para os dois extremos e formata texto de faixa.
- `src/components/medicamentos/FormMedicamento.tsx`: campos mín/máx e alternador mg/kg · mg/animal por espécie; botão Excluir com `AlertDialog` de confirmação; recebe `onExcluir`.
- `src/routes/medicacoes.tsx`: bloco sticky de peso/espécie, busca abaixo dele, remoção do long press/DropdownMenu, cards reordenados (nome → vias·concentração → DOSE → intervalo → QUANTIDADE A APLICAR).
- `src/components/medicamentos/ResultadoAplicar.tsx` e `CalculadoraDose.tsx`: passam a exibir faixa quando existir.
