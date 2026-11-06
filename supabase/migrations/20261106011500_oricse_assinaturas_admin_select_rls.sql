-- Permite ao Admin geral consultar as vigências pelo cliente autenticado.
-- GRANT habilita a operação; RLS limita todas as linhas ao Administrador geral.
alter table public.oricse_assinaturas enable row level security;
revoke select on table public.oricse_assinaturas from anon;
grant select on table public.oricse_assinaturas to authenticated;
drop policy if exists oricse_assinaturas_admin_select on public.oricse_assinaturas;
create policy oricse_assinaturas_admin_select on public.oricse_assinaturas
  for select to authenticated
  using ((select public.oricse_is_platform_admin()));
