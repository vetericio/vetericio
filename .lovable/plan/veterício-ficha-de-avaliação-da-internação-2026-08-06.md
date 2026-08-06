# Veterício — Ficha de Avaliação da Internação

App offline (tudo salvo no próprio aparelho, sem internet e sem login) para registrar avaliações de animais internados e exportar tudo em texto.

## Cabeçalho

- Título: **Veterício Serviços Veterinários LTDA**
- Subtítulo menor: *Ficha de Avaliação da Internação*

## Ferramentas (linha compacta no topo do registro)

Layout em duas colunas:

```text
+---------------------------+   +------------------------+
|                           |   | Cronômetro (compacto)  |
|   CALCULADORA (grande)    |   | [Iniciar] [Zerar]      |
|   lado esquerdo           |   +------------------------+
|                           |   | Taxa de infusão        |
|                           |   | Peso: [____] kg        |
|                           |   | Cachorro: 130 x peso^0,75 = X mL/h |
|                           |   | Gato: 80 x peso^0,75 = Y mL/h      |
+---------------------------+   +------------------------+
```

- **Calculadora**: teclado grande, com operações básicas e botão de potência (elevado, `^`).
- **Cronômetro**: só **Iniciar/Pausar** e **Zerar**, tamanho reduzido, alinhado com a taxa de infusão.
- **Taxa de infusão**: só o campo *Peso* é editável (aceita `5,3` ou `5.3`); as duas linhas de cálculo são fixas e atualizam o resultado em mL/h automaticamente.
- Vai aparecer Cachorro, a formula embaixo, menor, e no espaço abaixo o numero

## Formulário de avaliação

Campos com opções fixas (seleção por toque):

- **Alimentação**: Ração, Patê, Ração + patê, Forçado, Recuperação, Jejum, Não alimentou, Líquido, Sonda
- **Comportamento**: Responsivo, Prostrado, Ativo, Neurológico, Decúbito, Agressivo, Responsivo porém prostrado
- **Fezes**: Sim, Não, Pastoso, Diarreia, Melena
- **Mucosas**: Normocoradas, Hipocoradas, Ictéricas, Hiperêmicas, Cianóticas
- **Urina**: Sim, Não, Sonda, Compressão
- **Vômito**: Sim, Não, Sialorreia 

Campos digitados: **Animal** (nome), **Temperatura** (°C), **FC** (bpm), **FR** (mpm), **PAS** (mmHg), **Glicemia** (mg/dL), **Observações**.

## Enviar e acumular

Ao clicar em **Enviar**, o registro é formatado assim e salvo na lista:

```text
Saturna
Alimentação: Patê.
Comportamento: Responsivo.
Fezes: Sim.
Mucosas: Hipocoradas.
Temperatura: 38,1 °C.
Urina: Sim.
FC: 241 bpm.
FR: 36 mpm.
Vômito: Não.
PAS: 100 mmHg.
Glicemia: 99 mg/dL.
Observações:
```

- Cada envio vira um novo animal na lista (1, 2, 3...), acumulando e persistindo no aparelho.
- Cada item da lista pode ser **editado** ou **excluído**.
- Botão **Exportar**: gera o texto completo com todos os animais numerados, com opções de **copiar** e **compartilhar**.
- Botão **Limpar tudo** com confirmação.
- Números decimais exibidos com vírgula (38,1).

## Detalhes técnicos

- Página única em `src/routes/index.tsx` com componentes em `src/components/` (Calculadora, Cronometro, TaxaInfusao, FormAvaliacao, ListaRegistros, ExportarTexto).
- Persistência via `localStorage` (offline, sem backend).
- Instalável no celular (manifest + ícones) para abrir como app; o app funciona sem internet. Ter essa opção no final do app (instalar) e gera um app na tela do android.
- Layout mobile-first, com a linha de ferramentas em duas colunas também no celular quando couber.