create or replace function public.oricse_perfil_usuario_visivel(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_user_id = (select auth.uid())
    or public.oricse_is_platform_admin()
    or exists (
      select 1
      from public.clinica_usuarios membro_atual
      join public.clinica_usuarios membro_alvo
        on membro_alvo.clinica_id = membro_atual.clinica_id
      where membro_atual.user_id = (select auth.uid())
        and membro_atual.ativo = true
        and membro_alvo.user_id = p_user_id
        and membro_alvo.ativo = true
    )
$$;

revoke all on function public.oricse_perfil_usuario_visivel(uuid) from public, anon;
grant execute on function public.oricse_perfil_usuario_visivel(uuid) to authenticated;

drop policy if exists app_users_select_self_or_admin on public.app_users;
create policy app_users_select_self_or_admin
  on public.app_users for select to authenticated
  using (public.oricse_perfil_usuario_visivel(user_id));

drop policy if exists clinica_usuarios_select_self on public.clinica_usuarios;
create policy clinica_usuarios_select_self
  on public.clinica_usuarios for select to authenticated
  using (user_id = (select auth.uid()) or public.oricse_is_platform_admin());

drop policy if exists clinicas_select_member on public.clinicas;
create policy clinicas_select_member
  on public.clinicas for select to authenticated
  using (public.oricse_usuario_na_clinica(id));

grant select, insert, update, delete on public.clinicas to authenticated;
grant select, insert, update, delete on public.clinica_usuarios to authenticated;

insert into storage.buckets (id, name, public)
values ('oricse-branding', 'oricse-branding', true)
on conflict (id) do nothing;

drop policy if exists oricse_branding_public_read on storage.objects;
create policy oricse_branding_public_read
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'oricse-branding');

drop policy if exists oricse_branding_admin_insert on storage.objects;
create policy oricse_branding_admin_insert
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'oricse-branding'
    and public.oricse_is_platform_admin()
  );

drop policy if exists oricse_branding_admin_update on storage.objects;
create policy oricse_branding_admin_update
  on storage.objects for update to authenticated
  using (
    bucket_id = 'oricse-branding'
    and public.oricse_is_platform_admin()
  )
  with check (
    bucket_id = 'oricse-branding'
    and public.oricse_is_platform_admin()
  );

drop policy if exists oricse_branding_admin_delete on storage.objects;
create policy oricse_branding_admin_delete
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'oricse-branding'
    and public.oricse_is_platform_admin()
  );
