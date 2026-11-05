# Execução manual: sites de clínicas

Não crie projeto nem branch de preview para este teste.

## Opção A — Supabase local (gratuita)

Com Docker em execução, use a CLI no repositório: `supabase start`, aplique a migration local e execute `supabase/tests/clinic_sites_rls_manual.sql` no Studio local. Ao terminar, `supabase stop`. A CLI e o Docker executam o banco na sua máquina e não geram custo de projeto/branch.

## Opção B — projeto existente (após conferir backup)

Depois de conferir o backup, crie dois usuários de teste em **Authentication** e substitua os UUIDs em `supabase/tests/clinic_sites_rls_manual.sql`. No SQL Editor, rode a migration `supabase/migrations/20261105195430_clinic_sites.sql`; depois rode o teste. Ele começa com `begin` e termina com `rollback`; confira que todas as linhas tenham `passou = true`.

Se precisar desfazer apenas a estrutura criada por esta entrega, rode `supabase/migrations/20261105195430_clinic_sites_reversal.sql`.

Nenhum arquivo altera tabelas, políticas ou dados já existentes; a migration é somente aditiva. Não aplique em produção antes da revisão manual do backup e dos resultados de RLS.
