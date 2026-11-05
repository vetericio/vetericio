-- OricStudio 2/5: access roles and private media metadata
-- Read: licensed team; edit: clinic responsible/admin/RT or platform admin.
create or replace function public.oricstudio_pode_editar(p_clinica_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.oricstudio_pode_acessar(p_clinica_id)
   and (
     exists (select 1 from public.app_users a
             where a.user_id = (select auth.uid()) and a.role='admin')
     or exists (select 1 from public.clinica_usuarios cu
             where cu.user_id=(select auth.uid())
               and cu.clinica_id=p_clinica_id
               and cu.ativo=true
               and cu.papel in ('responsavel','admin_clinica','rt'))
   );
$$;
revoke all on function public.oricstudio_pode_editar(uuid) from public,anon;
grant execute on function public.oricstudio_pode_editar(uuid) to authenticated;

create or replace function public.oricstudio_meu_contexto()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'clinica_id', c.id,
    'clinica_nome', c.nome,
    'clinica_status', c.status,
    'licenca_status', coalesce(l.status,'nao_contratado'),
    'licenca_expira_em', l.expira_em,
    'tem_acesso', public.oricstudio_pode_acessar(c.id),
    'pode_editar', public.oricstudio_pode_editar(c.id)
  )
  from public.clinicas c
  left join public.oricstudio_licencas l on l.clinica_id=c.id
  where c.id=public.oricse_clinica_ativa_obter()
    and (
      exists(select 1 from public.app_users a where a.user_id=(select auth.uid()) and a.role='admin')
      or exists(select 1 from public.clinica_usuarios cu where cu.user_id=(select auth.uid()) and cu.clinica_id=c.id and cu.ativo=true)
    );
$$;

drop policy if exists oricstudio_publicacoes_criar on public.oricstudio_publicacoes;
drop policy if exists oricstudio_publicacoes_editar on public.oricstudio_publicacoes;
drop policy if exists oricstudio_publicacoes_apagar on public.oricstudio_publicacoes;
create policy oricstudio_publicacoes_criar on public.oricstudio_publicacoes
for insert to authenticated with check (
  public.oricstudio_pode_editar(clinica_id) and criado_por=(select auth.uid())
);
create policy oricstudio_publicacoes_editar on public.oricstudio_publicacoes
for update to authenticated using (public.oricstudio_pode_editar(clinica_id))
with check (public.oricstudio_pode_editar(clinica_id));
create policy oricstudio_publicacoes_apagar on public.oricstudio_publicacoes
for delete to authenticated using (public.oricstudio_pode_editar(clinica_id));

drop policy if exists oricstudio_preferencias_criar on public.oricstudio_preferencias;
drop policy if exists oricstudio_preferencias_editar on public.oricstudio_preferencias;
create policy oricstudio_preferencias_criar on public.oricstudio_preferencias
for insert to authenticated with check (public.oricstudio_pode_editar(clinica_id) and atualizado_por=(select auth.uid()));
create policy oricstudio_preferencias_editar on public.oricstudio_preferencias
for update to authenticated using (public.oricstudio_pode_editar(clinica_id))
with check (public.oricstudio_pode_editar(clinica_id) and atualizado_por=(select auth.uid()));

grant insert,delete on public.oricstudio_midias to authenticated;
create policy oricstudio_midias_criar on public.oricstudio_midias
for insert to authenticated with check (public.oricstudio_pode_editar(clinica_id));
create policy oricstudio_midias_excluir on public.oricstudio_midias
for delete to authenticated using (public.oricstudio_pode_editar(clinica_id));
