# Veterício — melhorias em 4 partes

Diretriz geral: evoluir o visual atual (mesma identidade), com cards mais baixos,
hierarquia clara, ícones pequenos e funcionais, textos curtos e menos espaço vazio.

## Parte 1 — Medicações mais compactas

Card de medicação reorganizado em uma grade compacta, sem esconder informação:

```text
┌──────────────────────────────────────────────┐
│ DIPIRONA        💉 IV IM   500 mg/mL   8h   │
│ Aplicar   0,28 mL        Dose  72–90 mg     │
│ (grande, destaque)       ref. 20–25 mg/kg   │
│ [Aplicar]  [Editar]                          │
└──────────────────────────────────────────────┘
```

- Nome + vias + concentração + intervalo em uma única linha de cabeçalho.
- "Quantidade a aplicar" continua sendo o elemento de maior destaque, mas em
  bloco menor, ao lado da dose (não mais uma caixa larga separada).
- mg/kg e dose total ficam com peso visual menor (texto secundário).
- Altura do card cai cerca de 40%, sem remover nenhum dado.

Formatação de volumes:

- líquidos com 2 casas (`0,28 mL`); quando o valor for pequeno demais para
  2 casas representar bem (abaixo de 0,1 mL), usa 3 casas (`0,125 mL`).

Comprimidos e cápsulas:

- resultado convertido em fração prática: ¼, ⅓, ½, ¾, 1, 1¼, 1½, 1¾, 2…
  (aproximação para a fração administrável mais próxima, com o valor exato
  em texto pequeno ao lado, para conferência).

Vias com ícone pequeno (linha, não emoji grande): seringa para IV/IM/SC,
comprimido para VO, spray para OT, conta-gotas para OF.

## Parte 2 — Menu e Anamnese

Já implementado no passo anterior e mantido: "Evolução" saiu do menu, entrou
"Anamnese", e Animais internados tem as abas "Todos / Animais em atenção /
Evolução". A Anamnese tem nome, espécie, queixa, relato, exames, pendências com
checkbox, conduta/plano, atenção para o próximo plantão e última atualização.

Ajuste restante: ao selecionar o animal sugerido no Início e enviar a ficha, os
dados da anamnese ficam vinculados ao animal internado (a ficha do animal passa
a mostrar queixa, conduta e ponto de atenção vindos da anamnese, sem duplicar o
animal). Apagar o nome e digitar outro recomeça a busca normalmente.

## Parte 3 — Sincronização entre dois aparelhos

Sincronização pela internet usando o backend próprio do app (sem créditos, sem
Google, sem mesma rede, sem manter aparelho ligado).

- Em "Sincronização" (junto de Temas/Backup): o primeiro aparelho gera um
  **código longo secreto + QR**. O segundo aparelho lê o QR (ou digita o código)
  uma única vez e passa a compartilhar os dados.
- Sincroniza **tudo do app**: animais internados, anamneses, medicações
  aplicadas, medicamentos cadastrados, curvas, alarmes e plantões salvos.
- Estados visíveis: `Sincronizado ✓`, `Sincronizando…`, `Alterações pendentes`,
  `Erro ao sincronizar`, além de botão manual "Sincronizar".
- Funciona offline: tudo continua salvo no aparelho; ao voltar a internet, as
  alterações pendentes sobem e as do outro aparelho descem automaticamente.
- Mescla item por item pelo identificador de cada registro, mantendo a versão
  mais recente de cada um. Nada é apagado só porque não veio na outra lista, e
  nada é duplicado.

## Parte 4 — Aplicar medicação em um animal

O botão **Aplicar** no card da medicação abre "Para qual animal?" com a lista
dos animais atualmente internados (busca rápida + toque para escolher).

Ao confirmar, a aplicação é gravada nas Medicações daquele animal, com nome,
dose, mg/kg ou mg/animal, quantidade a aplicar, unidade, via, frequência e
horário. Aplicar de novo cria uma nova linha de histórico, sem apagar a
anterior e sem criar outro animal.

## Detalhes técnicos

- `src/lib/medicamentos.ts`: novo formatador de volume (2 casas, 3 quando
  < 0,1) e `fracaoComprimido(valor)` devolvendo `{ texto, exato }`; `calcularFaixaDose`
  passa a devolver também a forma (mL / comprimido / gota) para a UI escolher o formato.
- `src/routes/medicacoes.tsx`: `CardMedicamento` reescrito em grade compacta
  (cabeçalho de uma linha + duas colunas dose/aplicar), com botão Aplicar.
- Novo `src/components/medicamentos/IconeVia.tsx` (ícones `lucide-react`:
  `Syringe`, `Pill`, `SprayCan`, `Droplet`) e
  `src/components/medicamentos/DialogoAplicar.tsx` (escolha do animal a partir
  de `useRegistros`, gravando em `Medicacao[]` do `Registro` via `ficha.ts`).
- `src/lib/ficha.ts`: `Medicacao` ganha campos opcionais `via`, `mgKg`,
  `quantidade`, `aplicadoEm`, e o animal ganha vínculo `anamneseId`.
- Sincronização: nova tabela no backend guardando os dados por sala
  (`codigo_hash`, `chave`, `dados jsonb`, `atualizado_em`), sem acesso direto do
  cliente; leitura/escrita por server functions em `src/lib/sync.functions.ts`
  que validam o código secreto e usam o cliente privilegiado dentro do handler.
  `src/lib/sync.ts` faz a mesclagem por id/`atualizadoEm` e a fila offline;
  `src/hooks/useSync.ts` expõe o estado; `src/components/Sincronizacao.tsx` mostra
  QR, código, estado e o botão manual. Auto-sync ao ficar online, ao voltar o foco
  e após cada gravação (com espera curta para agrupar mudanças).
- Corrigir também o aviso de hidratação em `/registros` (contagem renderizada
  antes da leitura do armazenamento local).
