# Três mudanças no Veterício

Só o que foi pedido. Nenhuma tela redesenhada, nenhum dado apagado, tudo continua offline.

## 1. Plantão como liga/desliga

Fonte única da verdade: o `usePlantaoAtual` que já existe.

Sem plantão ativo ficam visíveis mas apagados e sem ação:
- Adicionar paciente (botão Enviar da ficha no Início)
- Alarmes (aba do menu e a página)
- Curva (aba do menu e a página)
- Anamnese (aba do menu e a página)

Continuam liberados sem plantão: Medicações, Plantões, Animais internados (incluindo a aba Evolução e a aba Animais em atenção, que só leem dados já salvos).

Comportamento do bloqueio:
- No menu, os três itens bloqueados ficam com opacidade reduzida, `aria-disabled` e o clique é impedido (nada de navegar).
- Se a pessoa chegar na página por URL direta, a página mostra um aviso curto ("Inicie o plantão para usar esta função") com o botão de iniciar plantão, em vez do conteúdo.
- No Início, o formulário continua aparecendo; o botão de enviar fica desabilitado com a mesma frase.

## 2. Medicações — concentração, dose e vias

Tudo dentro dos arquivos já existentes (`src/lib/medicamentos.ts`, `FormMedicamento.tsx`, `IconeVia.tsx`, `medicacoes.tsx`). Nenhuma segunda calculadora.

### Concentração
- Campo de unidade passa a ser digitável com lista de sugestões (datalist), contendo exatamente as unidades pedidas: massa/volume (mg, mcg, g por mL, 5 mL, 10 mL, 100 mL), massa/massa (mg/g, mg/kg, mcg/g, mcg/kg, g/g, g/kg), massa/unidade (mg, mcg, g por comprimido, cápsula, gota), UI (mL, 5/10/100 mL, g, kg, comprimido, cápsula, gota) e `%`.
- Texto livre continua aceito; se a unidade não puder ser relacionada matematicamente à dose, não há cálculo inventado.

### Dose
- A dose passa a ter unidade própria: mg/kg, mg/animal, mcg/kg, mcg/animal, UI/kg, UI/animal, g/kg, g/animal, mL/kg, mL/animal. O que já está salvo é lido como mg/kg (ou mg/animal quando `porAnimal`), sem perder nada.
- O cálculo primeiro identifica grandeza da dose (massa, UI ou volume), grandeza da concentração, peso e forma de apresentação; só então faz a conta compatível:
  - massa ÷ massa/volume → mL
  - massa ÷ massa/massa → g
  - massa ÷ massa/unidade → comprimido / cápsula / gota
  - UI ÷ UI/… → a unidade correspondente
  - apresentações "por 5/10/100 mL" são normalizadas antes (100 mg/10 mL → 10 mg/mL)
- Incompatível (ex.: dose em mg/kg com concentração em UI/mL): mostra "Não é possível calcular automaticamente com essas unidades. Confira a apresentação e a dose." e não calcula.
- `%` passa a valer só para apresentação líquida: 1% = 10 mg/mL. Sem apresentação líquida, cai no aviso de incompatível.
- Faixa mín–máx continua igual, agora funcionando para qualquer unidade compatível (mL, g, gota, comprimido, cápsula, UI).
- Comprimido e cápsula mantêm as frações práticas (½, 1½) e nunca são convertidos em mL.

### Vias
- Lista fixa nova: IV, IM, SC, VO, SL, ID, IO, IP, IC, IT, IN, Oftálmica, Otológica, Tópica, Transdérmica, Bucal, Retal, Vaginal.
- Os códigos antigos `OF` e `OT` são mapeados para Oftálmica e Otológica na leitura, sem apagar nem reescrever cadastros.
- `IconeVia` é ampliado (mesmo componente): seringa só para IV/IM/SC — quando houver mais de uma dessas, uma única seringa seguida de "IV / IM / SC"; comprimido para VO; frasco/pomada para Tópica e Transdérmica; gota para Oftálmica; ícone de ouvido para Otológica; ícone nasal para IN; e um ícone coerente e distinto para cada uma das demais vias. Nunca seringa em VO, Tópica, Oftálmica ou Otológica.

## 3. "Tem certeza?" ao sair com texto não salvo

- Um pequeno hook reutilizável compara o conteúdo atual do formulário com o último estado salvo; só quando existe diferença real ele arma a proteção.
- Ao tentar sair (clicar em outra aba do menu, voltar, cancelar edição ou fechar o app), aparece o diálogo com o título exato "Tem certeza?" e dois botões: "Continuar editando" e "Sair sem salvar".
- Aplicado em: Anamnese, ficha do Início (incluindo observações e edição/atualização de registro) e edição de medicamento.
- Não pergunta quando nada foi alterado, quando acabou de salvar, ou quando a navegação não perde nada. Sem `window.confirm` genérico — usa o diálogo já existente do app.

## Detalhes técnicos

- Arquivos tocados: `src/lib/medicamentos.ts` (parser de unidades, cálculo por grandeza, lista de vias), `src/components/medicamentos/FormMedicamento.tsx` (unidade digitável + unidade de dose + vias), `src/components/medicamentos/IconeVia.tsx`, `src/routes/medicacoes.tsx` (texto de incompatibilidade), `src/components/Cabecalho.tsx` (menu bloqueado), `src/routes/alarmes.tsx`, `src/routes/curva.tsx`, `src/routes/anamnese.tsx`, `src/components/FormAvaliacao.tsx`, mais um hook novo `src/hooks/useSaidaSegura.ts` e um componente de diálogo reutilizável.
- Nenhuma migração de dados destrutiva: campos novos são opcionais e a leitura tem fallback (`unidadeDose` ausente = mg/kg; vias `OF`/`OT` mapeadas em leitura).
- Nada de banco, nada de dependência nova; `localStorage` segue igual.
- Não serão alterados: calculadora clínica, taxa de infusão, transfusão, backup, sincronização, PDF, histórico de plantões.
