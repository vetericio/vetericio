# Execução manual: sites de clínicas

1. Em um projeto de teste, crie dois usuários de teste em **Authentication** e substitua os UUIDs no arquivo `supabase/tests/clinic_sites_rls_manual.sql`.
2. Rode primeiro a migration `supabase/migrations/20261105195430_clinic_sites.sql` no SQL Editor.
3. Rode `supabase/tests/clinic_sites_rls_manual.sql`. Ele começa com `begin` e termina com `rollback`; confira que cada linha tenha `passou = true`.
4. Se desejar desfazer a estrutura de teste, use `supabase/migrations/20261105195430_clinic_sites_reversal.sql`.

Não rode estes arquivos em produção antes de revisar os resultados. Nenhum deles altera tabelas, políticas ou dados já existentes; a migration é somente aditiva.
