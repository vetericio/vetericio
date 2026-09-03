# Bloco de notas na Anamnese

Um bloco de notas simples, livre, dentro da aba Anamnese. Serve para rascunho pessoal do plantão.

## Como funciona

- Fica no fim da página Anamnese, em um card próprio com o título "Bloco de notas".
- Uma área de texto grande, digitação livre, sem campos nem formatação.
- Salva sozinho no aparelho enquanto você digita (offline, igual ao resto do app).
- Mostra "salvo" discreto embaixo e um botão "Limpar" com confirmação.
- Não entra no PDF, nem no texto copiado, nem na ficha do animal, nem na exportação/relatório do plantão.
- Ao finalizar o plantão, a nota é apagada junto com a anamnese (mesma regra já existente).

## Detalhes técnicos

- Novo componente `src/components/BlocoNotas.tsx`, renderizado no fim de `src/routes/anamnese.tsx` (dentro do conteúdo que exige plantão ativo).
- Persistência própria em `localStorage`, chave `veterico-bloco-notas`, com debounce curto ao digitar.
- `src/hooks/useFinalizarPlantao.ts`: limpar a chave junto do `setAnamneses([])`.
- Nada em `src/lib/ficha.ts` nem `src/lib/pdf.ts` — por isso não aparece em PDF/cópia.
- Sem backend, sem dependências novas.
