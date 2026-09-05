# Por que a atualização em bloco não chega no outro aparelho

Hoje a sincronização só sabe **acrescentar animais novos**. Quando um animal já existe nos dois
aparelhos, a junção mantém sempre a versão que está no aparelho que recebe — então qualquer
mudança dentro de uma ficha que já existe (atualização em bloco, "Atualizar", edição, óbito,
medicação aplicada) fica só no aparelho onde foi feita.

Ou seja: não é um problema da atualização em bloco, é a regra de junção. Nada foi perdido — os
dados estão no aparelho onde você digitou.

## Como vai passar a funcionar

- Cada ficha (e cada plantão, curva, alarme, medicamento, anamnese) passa a ter uma marca interna
de "mudou às tantas horas", registrada no próprio aparelho quando o conteúdo muda.
- Na sincronização, para itens com o mesmo identificador, **vence a versão alterada mais recentemente**.
- Itens que existem só em um aparelho continuam sendo acrescentados, como já acontece.
- Nada é apagado: excluir um animal em um aparelho continua não apagando no outro (mesma regra
segura de hoje).
- Depois da correção, uma atualização em bloco feita no aparelho 1 aparece no aparelho 2 em até  
~15 segundos, sem tocar em nada mais.
- Tudo deve ser atualizado, desde rascunho até medicamentos, animais, inclusões, tudo tudo tudo mesmo. Sem exceção.

Layout, telas, PDF, cópia, alarmes, plantões e bloco de notas ficam exatamente como estão.

## Detalhes técnicos

- Novo módulo interno de carimbos em `src/lib/backup.ts` (sem novo arquivo obrigatório):
chave `veterico-sync-carimbos-v1` no `localStorage`, mapa `"<lista>:<id>" -> { hash, quando }`.
Ao montar o backup, calcula um hash simples do JSON de cada item; se diferir do hash guardado,
grava `quando = agora`. Assim a marca é derivada do conteúdo — nenhum ponto de escrita do app
(`ficha.ts`, `registros.tsx`, `AtualizarEmBloco.tsx`, hooks) precisa ser alterado.
- `Backup` ganha um campo opcional `carimbos?: Record<string, { hash: string; quando: string }>`,
preenchido por `montarBackup()`. Backups antigos sem esse campo continuam válidos
(`validarBackup` inalterado no essencial).
- `juntarPorId` passa a receber os carimbos local e remoto: para ids presentes nos dois lados,
escolhe o item com `quando` mais recente (empate ou carimbo ausente → mantém o local, como hoje);
ids só remotos entram no fim.
- `aplicarBackup(..., "juntar")` repassa os carimbos e, ao aceitar um item remoto, grava o carimbo
remoto localmente para não gerar ping-pong. `"substituir"` fica inalterado.
- `juntarSincronizacao` continua devolvendo `true` quando algo mudou, então o recarregamento
automático de `src/components/Backup.tsx` já cobre a atualização de tela — o componente não muda.
- Verificação: `bunx tsgo --noEmit` e teste com dois contextos de navegador (atualizar em bloco no
aparelho 1 e conferir a chegada no aparelho 2, e o inverso).