# Tela de abertura (splash screen) com a logo

Objetivo: remover a logo do topo da página inicial e mostrá-la como tela de carregamento quando o app abre.

## O que será feito

1. Remover a logo do topo de `src/routes/index.tsx`.
2. Criar um componente de splash screen em `src/components/Splash.tsx` que exibe a logo centralizada com fundo branco.
3. Inserir o splash em `src/routes/__root.tsx`, logo acima do `<Outlet />`.
4. Controlar visibilidade: mostrar automaticamente ao carregar o app por cerca de 2,5–3 segundos, depois sumir com transição suave.
5. Garantir que só apareça uma vez por sessão (usando estado local no componente, sem persistir).
6. Manter a logo como asset já criado.

## Detalhes técnicos

- Estado local `visivel` inicia `true` e é setado `false` após o tempo de exibição via `useEffect` + `setTimeout`.
- Transição de opacidade e escala suave (Tailwind `transition-opacity duration-500`).
- Pointer-events desabilitados quando oculto para não bloquear interação.
- Layout centralizado com `fixed inset-0 z-50 flex items-center justify-center bg-background`.
- Tamanho da logo `max-w-xs sm:max-w-sm w-full` para manter proporção.
- Sem alterar outras telas, funcionalidades ou cálculos.
