create or replace function public.oricse_portal_pode_acessar_clinica(p_clinica_id uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select exists(
    select 1
    from public.oricse_portal_tutores pt
    join public.clinicas c on c.id=pt.clinica_id and c.status='ativa'
    where pt.auth_user_id=(select auth.uid())
      and pt.ativo=true
      and pt.clinica_id=p_clinica_id
  ) and public.oricse_clinica_tem_funcionalidade(p_clinica_id,'portal_tutor.acesso');
$$;

create or replace function public.oricse_portal_identidade_atual()
returns table(clinica_id uuid,tutor_id uuid,portal_id uuid,usuario text)
language sql
stable
security definer
set search_path=''
as $$
  select pt.clinica_id,pt.tutor_id,pt.id,pt.usuario
  from public.oricse_portal_tutores pt
  join public.clinicas c on c.id=pt.clinica_id and c.status='ativa'
  where pt.auth_user_id=(select auth.uid())
    and pt.ativo=true
    and public.oricse_clinica_tem_funcionalidade(pt.clinica_id,'portal_tutor.acesso')
  limit 1;
$$;

create or replace function public.oricse_portal_meu_contexto()
returns table(
  clinica_id uuid,clinica_nome text,clinica_slug text,clinica_logo_url text,
  tutor_id uuid,tutor_nome text,tutor_telefone text,tutor_email text,usuario text
)
language sql
stable
security definer
set search_path=''
as $$
  select c.id,c.nome,c.slug,c.logo_url,t.id,t.nome,t.telefone,t.email,pt.usuario
  from public.oricse_portal_tutores pt
  join public.clinicas c on c.id=pt.clinica_id and c.status='ativa'
  join public.tutores t on t.id=pt.tutor_id and t.clinica_id=pt.clinica_id
  where pt.auth_user_id=(select auth.uid())
    and pt.ativo=true
    and public.oricse_clinica_tem_funcionalidade(pt.clinica_id,'portal_tutor.acesso')
  limit 1;
$$;

drop policy if exists oricse_animais_tutor_ler on public.oricse_animais;
create policy oricse_animais_tutor_ler on public.oricse_animais
for select to authenticated
using (
  public.oricse_portal_pode_acessar_clinica(clinica_id)
  and exists(
    select 1 from public.oricse_portal_tutores pt
    where pt.auth_user_id=(select auth.uid()) and pt.ativo=true
      and pt.clinica_id=oricse_animais.clinica_id
      and pt.tutor_id=oricse_animais.tutor_id
  )
);

drop policy if exists oricse_portal_tutores_ler on public.oricse_portal_tutores;
create policy oricse_portal_tutores_ler on public.oricse_portal_tutores
for select to authenticated
using (
  (auth_user_id=(select auth.uid()) and public.oricse_portal_pode_acessar_clinica(clinica_id))
  or public.oricse_usuario_pode_permissao(clinica_id,'recepcao.cadastros.visualizar')
);

drop policy if exists oricse_portal_vacinas_ler on public.oricse_portal_vacinas;
create policy oricse_portal_vacinas_ler on public.oricse_portal_vacinas
for select to authenticated
using (
  public.oricse_usuario_pode_permissao(clinica_id,'consultorio.atendimentos')
  or (
    public.oricse_portal_pode_acessar_clinica(clinica_id)
    and exists(
      select 1 from public.oricse_animais a
      join public.oricse_portal_tutores pt on pt.clinica_id=a.clinica_id and pt.tutor_id=a.tutor_id
      where a.id=oricse_portal_vacinas.animal_id and a.clinica_id=oricse_portal_vacinas.clinica_id
        and pt.auth_user_id=(select auth.uid()) and pt.ativo=true and oricse_portal_vacinas.visivel_tutor=true
    )
  )
);

drop policy if exists oricse_portal_documentos_ler on public.oricse_portal_documentos;
create policy oricse_portal_documentos_ler on public.oricse_portal_documentos
for select to authenticated
using (
  public.oricse_usuario_pode_permissao(clinica_id,'consultorio.atendimentos')
  or (
    public.oricse_portal_pode_acessar_clinica(clinica_id)
    and exists(
      select 1 from public.oricse_animais a
      join public.oricse_portal_tutores pt on pt.clinica_id=a.clinica_id and pt.tutor_id=a.tutor_id
      where a.id=oricse_portal_documentos.animal_id and a.clinica_id=oricse_portal_documentos.clinica_id
        and pt.auth_user_id=(select auth.uid()) and pt.ativo=true and oricse_portal_documentos.visivel_tutor=true
    )
  )
);

drop policy if exists agendamento_tutor_ler on public.oricse_agendamentos_online;
create policy agendamento_tutor_ler on public.oricse_agendamentos_online
for select to authenticated
using (tutor_auth_id=(select auth.uid()) and public.oricse_portal_pode_acessar_clinica(clinica_id));

revoke all on function public.oricse_portal_pode_acessar_clinica(uuid) from public,anon;
grant execute on function public.oricse_portal_pode_acessar_clinica(uuid) to authenticated;
