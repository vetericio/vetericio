# Medicações: Ministrar, Consulta avulsa e menu de "..."

Só a tela Medicações muda. Fichas, plantões, alarmes, anamnese, backup, cálculos e doses cadastradas ficam intactos.

## 1. Cartão de cada medicação

Nome no topo, "..." no canto superior direito, e a dose em três colunas:

```text
                 DOSE (mL)
                   0,027
                 (20 mg/kg)

    Mín.                        Máx.
   0,017                       0,054
 (12,5 mg/kg)               (40 mg/kg)
```

- A dose calculada continua sendo o número maior e central; mínima e máxima menores, nas laterais.
- Abaixo, na direita: `[ 💉 Ministrar 0,027 mL ]` e `[ 🧮 Consulta avulsa ]`.
- Concentração, vias e intervalo continuam onde estão hoje.
- Espécie proibida ou dados faltando: continua aparecendo o aviso atual e Ministrar fica desativado.
- Sem cor nova por medicamento; mesmas cores, fontes e espaçamentos de hoje.

## 2. Ministrar → "Medições do animal"

Tocar em Ministrar abre uma tela que já vem preenchida com:

- Nome da medicação e concentração
- Dose padrão, mínima e máxima (mg/kg)
- Dose calculada para o peso e o volume calculado
- Via (escolha quando houver mais de uma) e intervalo
- Peso do animal (o do topo, editável aqui)
- Quantidade a ministrar (com os atalhos Mínimo/Médio/Máximo e as casas decimais como hoje)
- Observação (campo livre, opcional)

Botão principal **CONFIRMAR MINISTRAÇÃO**: escolhe o animal internado na lista (como hoje) e grava. Nada é gravado só por abrir a tela.

## 3. Histórico

O registro entra no histórico de medicações do animal com: medicação, dose usada, volume, via, intervalo, peso no momento, data e hora e a observação — no mesmo formato de linha já usado hoje, acrescentando peso e observação quando existirem.

## 4. Consulta avulsa

Abre a calculadora já preenchida com a medicação tocada:

- Peso alterável, espécie do topo
- Mostra dose mínima / padrão / máxima e volume mínimo / padrão / máximo
- Escolha da via quando houver mais de uma
- Recalcula sozinho a cada mudança
- Não grava nada; só sai do jeito que entrou

## 5. Menu "..."

- ✏️ Editar medicação — abre o formulário atual preenchido.
- 🗑️ Excluir medicação — pergunta "Excluir esta medicação?" com "Cancelar" e "Excluir".

## Detalhes técnicos

- `src/routes/medicacoes.tsx`: `CardMedicamento` reorganizado (grade dose/mín/máx, dois botões, menu "..." via `DropdownMenu` + `AlertDialog` de confirmação). Nenhum cálculo novo: usa `calcularFaixaDose`, `faixaDe`, `viasDe` já existentes.
- Novo `src/components/medicamentos/DialogoMinistrar.tsx`: junta o resumo do medicamento, peso editável, seleção de via, campo de observação e a escolha de quantidade (reaproveitando a lógica de `DialogoQuantidade`), e chama `DialogoAplicar` para escolher o animal.
- `src/components/medicamentos/DialogoAplicar.tsx` e o tipo `AplicacaoPendente`: novos campos opcionais `peso` e `observacao`, repassados ao `Medicacao` gravado em `useRegistros`.
- `src/lib/ficha.ts`: `Medicacao` ganha `peso?` e `observacao?` opcionais (nada existente muda; exportação/PDF só exibem quando presentes).
- `src/components/medicamentos/PesquisaAvulsa.tsx`: aceita `medicamento` opcional para pré-preencher dose/concentração/vias e exibir mín./padrão/máx.; sem medicamento continua igual ao de hoje.
- Sem backend, sem novas dependências, sem migração.
