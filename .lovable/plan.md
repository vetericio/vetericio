# Aba Evolução — gráficos por animal

## 1. Nova aba

Novo botão **Evolução** no cabeçalho (ao lado de Plantões) e nova página `/evolucao`.

Na página:

- Uma **caixa suspensa** com todos os animais que têm avaliações (nome + espécie).
- Ao escolher um animal, aparecem gráficos de **todos os parâmetros**, em duas partes:
  - **Números** (gráfico de linha): Temperatura, FC, FR, PAS e Glicemia.
  - **Escolhas** (linha do tempo visual em faixas coloridas, uma faixa por avaliação):
    Alimentação, Comportamento, Fezes, Mucosas, Urina e Vômito — cada opção tem sua
    própria cor, com legenda ao lado, para ver a evolução de um relance.
- Cada ponto/faixa é **uma avaliação**, em ordem de tempo (eixo X com data/hora
  da avaliação; se só houver uma avaliação, mostra o ponto isolado).
- Parâmetro sem nenhum valor preenchido não gera gráfico (fica escondido).
- Abaixo de cada gráfico numérico, uma faixa de referência da espécie (quando a espécie
  estiver definida) para leitura rápida do que está fora do normal.

- Sem animais registrados, a página mostra uma mensagem simples convidando a registrar
  a primeira avaliação.

Fonte dos dados: as avaliações da lista atual **e** as dos plantões salvos, agrupadas
pelo mesmo animal, para a evolução não se perder ao fechar o plantão.

## 2. Mesmo animal ou animal diferente

Ao enviar uma avaliação cujo **nome e espécie** já existem, o app pergunta:

```text
Já existe "Saturna (Cachorro)". É o mesmo animal?
[ Sim, é o mesmo ]   [ Não, é outro animal ]
```

- **Sim**: a avaliação entra no histórico do animal existente (mesmo gráfico).
- **Não**: cria um animal separado, com o nome escrito **"Saturna (2)"** — e (3), (4)…
  conforme o necessário. O nome com o número é o que aparece na lista, no texto
  exportado, no PDF e na caixa suspensa.
- Se nome ou espécie diferem de tudo que já existe, nada é perguntado.
- Ao **editar** um registro existente, a pergunta não aparece.

## 3. Pré-requisito: espécie e horário

Para os gráficos funcionarem, cada avaliação passa a guardar:

- **Espécie** (Cachorro / Gato) — botões abaixo do campo Animal, e no texto exportado
  aparece depois do nome, na mesma linha: `Saturna (Cachorro)`.
- **Data e hora do registro**, usada como eixo do gráfico (não aparece no texto
  exportado, só nos gráficos).

Registros antigos, sem espécie ou sem horário, continuam válidos: entram nos gráficos
em ordem de inserção e sem faixa de referência.

## Detalhes técnicos

- `src/lib/ficha.ts`: adicionar `especie` e `criadoEm` (ISO) a `Registro` /
  `REGISTRO_VAZIO`; tabela `FAIXAS` por espécie; helper `chaveAnimal(r)`
  (nome normalizado + espécie) e `proximoNomeDuplicado(nome, registros)` para gerar
  "Nome (2)"; `formatarRegistro` imprime `Nome (Espécie)` na primeira linha.
- `src/lib/evolucao.ts`: agrupa registros da lista atual + `carregarPlantoes()` por
  `chaveAnimal`, ordena por `criadoEm` e devolve séries numéricas
  (`{ rotulo, unidade, pontos: [{ quando, valor }] }`) e séries categóricas
  (`{ rotulo, pontos: [{ quando, opcao }] }`) a partir de `OPCOES`, ignorando vazios.
- `src/routes/evolucao.tsx`: `head()` própria, `<select>` de animal, gráficos numéricos
  com `recharts` (`LineChart`/`ResponsiveContainer`) e faixa de referência via
  `ReferenceArea`; séries categóricas renderizadas como trilha de blocos (divs flex,
  uma cor por opção via mapa de tokens HSL do design system) com legenda.
- `src/components/Cabecalho.tsx`: novo `<Link to="/evolucao">`.

- `src/components/FormAvaliacao.tsx`: botões de espécie.
- `src/routes/index.tsx`: ao enviar (modo criação), detectar nome+espécie existentes e
  abrir um diálogo (`AlertDialog`) com as duas opções antes de salvar; "outro animal"
  salva com o nome numerado. `criadoEm` definido no momento do envio.
