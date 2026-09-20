# Logo na abertura do app

Objetivo: usar a logo oficial enviada na tela inicial do Veterício.

## O que será feito

1. Transformar a imagem enviada em asset do projeto (ponteiro `.asset.json`), mantendo o repositório leve.
2. Inserir a logo no topo da tela inicial (`src/routes/index.tsx`), centralizada, com tamanho responsivo e respeitando o tema atual.
3. Garantir que não quebre o layout existente nem afete outras funcionalidades.
4. Validar visualmente no preview.

## Detalhes técnicos

- Criar `src/assets/vetericio-logo-oficial.png.asset.json` via `lovable-assets create` a partir do upload.
- Importar o asset em `src/routes/index.tsx` e renderizar dentro de um container com `bg-white rounded-2xl p-6 shadow-sm` para destacar no fundo do app.
- Usar `max-w-xs sm:max-w-sm md:max-w-md mx-auto` para responsividade.
- Não modificar nenhuma outra tela ou funcionalidade.
