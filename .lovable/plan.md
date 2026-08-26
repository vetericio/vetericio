# Trocar duração de medicação para radio buttons

## Objetivo
Na tela de medicações, o campo "Duração" deve ser exibido como opções de rádio individual, não como `<select>`.

## Layout esperado
```
( ) 8h  ( ) 12h  ( ) 24h  ( ) 48h  ( ) 7 dias  ( ) outros
```

## Funcionalidade
- Opções fixas: `8h`, `12h`, `24h`, `48h`, `7 dias`, `outros`.
- Se selecionar `outros`, abrir um campo de texto ao lado para preenchimento livre.
- O valor salvo continua em `Medicacao.duracao` como string, mantendo compatibilidade com leitura de foto, edição e PDF.

## Arquivo alterado
- `src/components/Medicacoes.tsx`

## Não alterar
- `src/lib/ficha.ts`: tipo `Medicacao` continua `{ nome: string; dose: string; duracao: string }`.
- `src/lib/medicacoes.functions.ts`: IA continua devolvendo string livre para duração.
