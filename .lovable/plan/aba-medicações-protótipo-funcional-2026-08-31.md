# Aba Medicações (protótipo funcional)

Nova aba independente para cadastrar medicamentos e calcular dose/volume. Nada mais do app é alterado.

## 1. Navegação

- Adicionar o botão **Medicações** no menu do cabeçalho, ao lado de **Animais internados**.
- Os outros botões existentes (Início, Evolução, Curva, Alarmes, Plantões) continuam como estão. O menu "Animais | Medicações" não substitui o menu atual — apenas ganha a nova aba.

## 2. Tela Medicações (`/medicacoes`)

- Título "Medicações" 
- Caixa "Pesquisar medicação" filtrando em tempo real pelo nome.
- Lista compacta, cada item mostrando:
  - NOME (maiúsculas, destacado)
  - Classificação em itálico e pequeno 
  - Concentração: valor + unidade
  - Bloco 🐶 Cão: `X mg/kg — a cada X horas`
  - Bloco 🐱 Gato: `X mg/kg — a cada X horas`
  - Os dois blocos ficam em caixas separadas, com cores diferentes.
- Toque simples abre as ações; **toque e segure** (long press) também abre o menu: Editar medicamento / Calcular dose / Pesquisa avulsa.
- Botão flutuante circular **+** no canto inferior direito para inserir um novo medicamento.

## 3. Cadastro / Edição

Modal "Inserir novo" (mesmo formulário para editar):

- Nome do medicamento
- Concentração: valor + unidade (mg/mL, mg/comprimido, mg/cápsula, mg/gota, mg/10 mL, %, ou livre)
- Resumo (texto livre)
- Classificação (texto livre)
- 🐶 Cão: Dose (mg/kg) + Intervalo (horas)
- 🐱 Gato: Dose (mg/kg) + Intervalo (horas)
- Nenhum campo vem preenchido. O app nunca sugere, busca na internet, completa ou altera doses — só guarda e calcula.

## 4. Calculadora de dose

Fica em cima e faz o cálculo de todas as medicações simultaneamente.

Ordem dos campos:

1. **Peso: ___ kg** (primeiro campo, sempre)
2. Espécie: 🐶 Cão / 🐱 Gato
3. Mostra a dose cadastrada para a espécie escolhida e a concentração.

Resultado automático:

- Dose total (mg) = peso × dose
- Volume = dose total ÷ concentração
- Destaque grande: **💉 APLICAR: X mL** (ou comprimido/cápsula/gota, conforme a unidade cadastrada)
- Abaixo, a conta escrita para conferência (ex.: `10 × 5 = 50 mg` / `50 ÷ 50 = 1 mL`).
- Sem dados suficientes ou unidade não convertível: "Informação insuficiente para calcular o volume. Confira a concentração e a unidade informadas." Nunca inventar valor.

## 5. Concentrações e unidades

- Aceita `mg/mL`, `mg/comprimido`, `mg/cápsula`, `mg/gota`, `mg/10 mL` (converte para mg/mL), `%` (1% = 10 mg/mL) e texto livre.
- A unidade do resultado acompanha a apresentação: mL, comprimido(s), cápsula(s), gotas.
- Arredondamento: mL com 2 casas; comprimido/cápsula com 2 casas; gotas inteiro.

## 6. Pesquisa avulsa

Calculadora independente, não salva nada:

1. Peso (kg) — primeiro campo
2. Espécie 🐶 / 🐱
3. Dose + unidade da dose
4. Concentração + unidade da concentração

Mostra dose total, volume, o destaque **💉 APLICAR** e a conta usada.

## 7. Dados de teste

3 medicamentos fictícios com nomes claramente de teste (ex.: "Teste A", "Teste B", "Teste C") e valores redondos, marcados como DADOS DE TESTE. Nenhuma dose veterinária real.

## 8. Design

Mobile primeiro: campos grandes, poucos elementos, resultado muito destacado, cão e gato separados visualmente, usando os tokens/temas já existentes do app.

9. Ao fazer o backup do app, os dados de medicamentos tb vao.

## Detalhes técnicos

- Novo `src/lib/medicamentos.ts`: tipo `Medicamento`, persistência em `localStorage` (chave `veterico:medicamentos`), parser de concentração e função de cálculo puro.
- Novo `src/hooks/useMedicamentos.ts` seguindo o padrão `useSyncExternalStore` já usado em `useRegistros`.
- Nova rota `src/routes/medicacoes.tsx` + componentes `src/components/medicamentos/*` (lista, formulário, calculadora, pesquisa avulsa).
- `src/components/Cabecalho.tsx`: um link novo.
- Sem backend, sem IA, sem alterações no fluxo de fichas, PDF, plantões ou na seção de medicações que já existe dentro da ficha do animal.