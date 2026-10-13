alter table public.oricse_planos enable row level security;

drop policy if exists "public_read_active_oricse_planos" on public.oricse_planos;
create policy "public_read_active_oricse_planos"
  on public.oricse_planos
  for select
  to anon, authenticated
  using (
    ativo = true
    or (
      auth.uid() is not null
      and exists (
        select 1
        from public.app_users au
        where au.user_id = auth.uid()
          and au.role = 'admin'
      )
    )
  );

drop policy if exists "platform_admin_manage_oricse_planos" on public.oricse_planos;
create policy "platform_admin_manage_oricse_planos"
  on public.oricse_planos
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.app_users au
      where au.user_id = auth.uid()
        and au.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.app_users au
      where au.user_id = auth.uid()
        and au.role = 'admin'
    )
  );
