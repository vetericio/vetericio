-- Impede que a política administrativa de escrita seja avaliada durante
-- leituras públicas do editor visual.
drop policy if exists admin_write_oricse_config on public.oricse_config;

create policy admin_insert_oricse_config
on public.oricse_config
for insert
to authenticated
with check (
  exists (
    select 1
    from public.app_users au
    where au.user_id = auth.uid()
      and au.role = 'admin'
  )
);

create policy admin_update_oricse_config
on public.oricse_config
for update
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

create policy admin_delete_oricse_config
on public.oricse_config
for delete
to authenticated
using (
  exists (
    select 1
    from public.app_users au
    where au.user_id = auth.uid()
      and au.role = 'admin'
  )
);
