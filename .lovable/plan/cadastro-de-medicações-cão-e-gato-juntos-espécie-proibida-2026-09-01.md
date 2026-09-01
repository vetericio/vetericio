# Cadastro de medicações: cão e gato juntos + espécie proibida

## Como fica o cadastro

1. No lugar dos dois blocos separados (🐶 Cão e 🐱 Gato), aparece **um único bloco 🐶🐱 Cão e gato** com dose mínima, máxima, intervalo e mg/kg · mg/animal.
2. Acima dele, uma seleção simples:

```text
DOSE
[ 🐶🐱 Mesma dose ]  [ 🐶 / 🐱 Separar ]
```

- **Mesma dose** (padrão para novo medicamento): um bloco só; o valor digitado vale para cão e para gato.
- **Separar**: volta a mostrar os dois blocos, cada um com seus próprios valores.

3. Quando estiver **separado**, cada espécie ganha uma caixinha:

```text
[ ] Não pode ser ministrado nesta espécie
```

- Marcada: os campos de dose daquela espécie ficam desativados e o bloco fica em tom de alerta.

## Efeito na calculadora

- Medicamento marcado como proibido para a espécie selecionada no topo: o card mostra, no lugar do botão Ministrar, o aviso **"Não pode ser ministrado em gato"** (ou cão), sem botão ativo — não é possível aplicar por engano.
- Nas demais situações nada muda: mesma matemática, mesmas faixas, mesmo diálogo de quantidade.

## Compatibilidade

- Medicamentos já cadastrados continuam como estão (tratados como "separado" quando cão e gato têm valores diferentes, e como "mesma dose" quando são iguais ou só um foi preenchido).
- Backup e sincronização levam os campos novos automaticamente.

## Detalhes técnicos

- `src/lib/medicamentos.ts`: `DoseEspecie` recebe `proibido?: boolean`; `Medicamento` recebe `doseUnificada?: boolean`; helper `especieBloqueada(m, especie)` e leitura tolerante em `faixaDe`. `calcularFaixaDose` passa a retornar `ok: false` com motivo quando a espécie está bloqueada.
- `src/components/medicamentos/FormMedicamento.tsx`: alternador Mesma dose / Separar; ao salvar em modo unificado, copia o bloco único para `cao` e `gato`; checkbox de espécie proibida por bloco quando separado.
- `src/routes/medicacoes.tsx`: card exibe o aviso de espécie bloqueada e desativa Ministrar (usa o `motivo` já existente, sem mudar a matemática).
