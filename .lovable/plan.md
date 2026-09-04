# Medicações no Início: remover "nome menor" e modo rápido com setinha

Alteração restrita ao bloco de medicações do formulário da página inicial (`src/components/Medicacoes.tsx`, usado no `FormAvaliacao`). Nada muda em Animais internados, exportação, PDF, plantões ou na aba Medicações.

## 1. Remover "Nome menor"

- O campo "Nome menor (opcional)" sai do formulário.
- `nomeMenor` deixa de ser preenchido/editado aqui; itens antigos que já tenham `nomeMenor` continuam exibindo normalmente na lista (dados existentes não são apagados).

## 2. Setinha no topo do formulário

- Pequena seta (▸/▾) no topo do quadro de inserção, alternando entre dois modos:
  - **Setinha recolhida (padrão):** formulário exatamente como hoje (Medicação, Quantidade, unidade, duração 8h/12h/24h/outros, botão Adicionar).
  - **Setinha aberta — modo rápido:** só nomes.

## 3. Modo rápido (setinha aberta)

- Começa com 2 campos de texto, somente o nome da medicação.
- Ao focar/clicar no último campo da lista, um novo campo vazio aparece embaixo (sempre um espaço extra).
- Botão "Adicionar tudo": grava de uma vez todos os nomes preenchidos (normalizados com `normalizarNomeMedicamento`), sem dose/duração, e limpa os campos.
- Campos vazios são ignorados; se nenhum nome for preenchido, mostra aviso.

## Fora do escopo

Lista de medicações já salvas, edição, exclusão, foto/OCR, máscara de quantidade, duração, exportação e PDF continuam iguais. Sem backend, sem dependências novas.

## Detalhes técnicos

- `src/components/Medicacoes.tsx`: remover estado/input de `nomeMenor` na inserção; novo estado `modoRapido` (boolean) e `nomesRapidos: string[]`; render condicional do quadro de inserção; função `enviarRapido` que monta itens `{ nome }` e chama `onChange([...lista, ...itens])`.
- Exibição da lista mantém o suporte a `nomeMenor` para registros antigos.
- `Medicacao` continua igual em `src/lib/ficha.ts` (sem migração).

## Verificação

- `bunx tsgo --noEmit`
