# Nome do arquivo PDF por plantão

## O que muda

Ao exportar o PDF, o arquivo passa a ser salvo com o nome:

- `Plantão noturno 08.08.26.pdf`
- `Plantão diurno 08.08.26.pdf`

Vale para os três casos:
1. Exportar PDF na página Animais internados (usa o turno e a data de hoje).
2. Botão PDF de um plantão salvo (usa o turno e a data daquele plantão).
3. Baixar todos os plantões (um arquivo por plantão, cada um com seu nome).

Se por algum motivo não houver turno escolhido, o nome sai apenas como `Plantão 08.08.26.pdf`.

O texto impresso dentro do PDF continua como está hoje (data por extenso).

## Detalhes técnicos

- `src/lib/plantao.ts`: nova função `nomeArquivoPdf(dia: string, turno?: string)` que devolve `Plantão <turno> <DD.MM.AA>.pdf` (data derivada de `dia` no formato AAAA-MM-DD), omitindo o turno quando vazio.
- `src/lib/pdf.ts`: quando `opcoes.arquivo` não vier, usar `nomeArquivoPdf` a partir de `carregarPlantaoAtual()` (ou do dia de hoje sem turno) em vez de `veterico-fichas.pdf`.
- `src/routes/plantoes.tsx`: em `pdf(p)` e `baixarTodos()`, trocar `veterico-plantao-${p.data}.pdf` por `nomeArquivoPdf(p.data, p.turno)`.
