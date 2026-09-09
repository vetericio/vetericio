# Medicações na ficha: estrelas e sugestão ao digitar

## O que muda

1. **Atalhos com estrela**
   No bloco Medicações da ficha, as medicações marcadas com estrela no cadastro aparecem como botões, uma do lado da outra, em ordem alfabética. Um toque já lança a medicação com a dose padrão (que continua editável). Isso já existe, mas só aparece quando existe alguma medicação marcada — então o botão de estrela no cadastro fica mais visível e passa a mostrar a estrela também na lista de medicações, para marcar e desmarcar direto de lá.

2. **Sugestão ao digitar (Tra → Tramadol)**
   Nos campos de nome da medicação (tanto no modo rápido de vários nomes quanto no formulário completo), ao digitar 2 letras ou mais aparece uma listinha logo abaixo com as medicações cadastradas que começam por aquelas letras (e depois as que contêm). Tocar na sugestão preenche o nome; no formulário completo também preenche a dose padrão e o intervalo cadastrados. Setas para cima/baixo e Enter escolhem a sugestão; Esc fecha.
   As sugestões vêm apenas do cadastro do Veterício — nenhuma dose é inventada.

## Detalhes técnicos

- `src/components/Medicacoes.tsx`: novo subcomponente local `CampoNomeMedicacao` (input + lista de sugestões controlada por estado, filtro sobre `useMedicamentos()` com `normalizarNomeMedicamento`, ordenação `localeCompare` pt-BR, teto de 8 sugestões). Usado nos inputs do modo rápido e no input `nome` do formulário completo, preservando o comportamento atual de Enter/foco que cria o próximo campo.
- Ao escolher uma sugestão no formulário completo, aproveita `doseDaEspecie`/`doseEfetiva`/`faixaDe`/`viasDe` (já importados) para preencher quantidade/unidade e duração quando houver intervalo cadastrado.
- `src/routes/medicacoes.tsx` (lista do cadastro): botão de estrela em cada card para marcar/desmarcar `especial`, gravando por `salvar()`; nenhuma alteração de dose, layout de dose ou cálculo.
- Sem mudanças em PDF, backup, sincronização ou fórmulas. `bunx tsgo --noEmit` e conferência no preview mobile no fim.
