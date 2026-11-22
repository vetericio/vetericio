-- Exclusão lógica de termos e receitas restrita ao RT, com auditoria permanente.
-- Nenhum prontuário ou PDF é removido; guarda clínica permanece preservada.
begin;

alter table public.oricse_portal_documentos
  add column if not exists excluido_em timestamptz,
  add column if not exists excluido_por uuid,
  add column if not exists exclusao_motivo text;

alter table public.oricse_portal_receitas
  add column if not exists excluido_em timestamptz,
  add column if not exists excluido_por uuid,
  add column if not exists exclusao_motivo text;

alter table public.oricse_portal_documentos
  drop constraint if exists oricse_termos_exclusao_logica_valida;
alter table public.oricse_portal_documentos
  add constraint oricse_termos_exclusao_logica_valida check (
    excluido_em is null or
    (excluido_por is not null and length(trim(coalesce(exclusao_motivo,''))) >= 5 and not visivel_tutor)
  );

alter table public.oricse_portal_receitas
  drop constraint if exists oricse_receitas_exclusao_logica_valida;
alter table public.oricse_portal_receitas
  add constraint oricse_receitas_exclusao_logica_valida check (
    excluido_em is null or
    (excluido_por is not null and length(trim(coalesce(exclusao_motivo,''))) >= 5 and not visivel_tutor)
  );

create table if not exists public.oricse_auditoria_exclusoes_clinicas (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null,
  animal_id uuid not null,
  documento_id uuid not null,
  categoria text not null check (categoria in ('termo','receita')),
  titulo_original text not null,
  tipo_original text not null,
  arquivo_original_id uuid,
  excluido_por uuid not null,
  motivo text not null,
  excluido_em timestamptz not null default now(),
  unique (categoria,documento_id)
);
alter table public.oricse_auditoria_exclusoes_clinicas enable row level security;
revoke all on public.oricse_auditoria_exclusoes_clinicas from public, anon, authenticated;

-- Impede exclusões físicas via APIs de funcionários; rotinas administrativas
-- internas com service_role permanecem livres para cumprir obrigações legais.
drop policy if exists oricse_documentos_bloquear_delete_api on public.oricse_portal_documentos;
create policy oricse_documentos_bloquear_delete_api
  on public.oricse_portal_documentos as restrictive for delete to authenticated using (false);
drop policy if exists oricse_receitas_bloquear_delete_api on public.oricse_portal_receitas;
create policy oricse_receitas_bloquear_delete_api
  on public.oricse_portal_receitas as restrictive for delete to authenticated using (false);

-- Nem a API padrão nem usuários sem papel de RT podem marcar uma exclusão
-- usando UPDATE diretamente. Somente a chamada administrativa auditada pode.
create or replace function public.oricse_proteger_exclusao_clinica()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if old.excluido_em is distinct from new.excluido_em
     or old.excluido_por is distinct from new.excluido_por
     or old.exclusao_motivo is distinct from new.exclusao_motivo then
    if current_user <> 'service_role' then
      raise exception 'A exclusão de termos e receitas requer ação do RT autenticado.'
        using errcode = '42501';
    end if;
  end if;
  if new.excluido_em is not null and new.visivel_tutor is true then
    raise exception 'Documento excluído não pode ficar visível ao tutor.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.oricse_proteger_exclusao_clinica() from public, anon, authenticated;
drop trigger if exists oricse_proteger_exclusao_documentos on public.oricse_portal_documentos;
create trigger oricse_proteger_exclusao_documentos
  before update on public.oricse_portal_documentos
  for each row execute function public.oricse_proteger_exclusao_clinica();
drop trigger if exists oricse_proteger_exclusao_receitas on public.oricse_portal_receitas;
create trigger oricse_proteger_exclusao_receitas
  before update on public.oricse_portal_receitas
  for each row execute function public.oricse_proteger_exclusao_clinica();

-- O RPC é de uso EXCLUSIVO do servidor com service_role, nunca do navegador.
-- Recebe o ID do usuário após validação de token feita no servidor e,
-- adicionalmente, verifica o vínculo RT novamente dentro da transação.
create or replace function public.oricse_arquivar_documento_rt(
  p_clinica_id uuid,
  p_animal_id uuid,
  p_documento_id uuid,
  p_categoria text,
  p_usuario_id uuid,
  p_motivo text
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_tipo text;
  v_titulo text;
  v_arquivo uuid;
  v_excluido timestamptz;
  v_auditoria uuid;
begin
  if current_user <> 'service_role' then
    raise exception 'Operação indisponível fora do serviço seguro.' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_motivo,''))) < 5 or length(p_motivo) > 500 then
    raise exception 'Informe o motivo da exclusão (5 a 500 caracteres).';
  end if;
  if p_categoria not in ('termo','receita') or p_usuario_id is null then
    raise exception 'Tipo de documento ou profissional inválido.';
  end if;
  if not exists (
    select 1 from public.clinicas c where c.id=p_clinica_id
      and c.status='ativa' and c.excluido_em is null
  ) or not exists (
    select 1 from public.clinica_usuarios u
    where u.clinica_id=p_clinica_id and u.user_id=p_usuario_id
      and u.ativo=true and u.papel='rt'
  ) then
    raise exception 'Somente o responsável técnico ativo desta clínica pode excluir documentos.'
      using errcode='42501';
  end if;

  if p_categoria='termo' then
    select d.tipo,d.titulo,d.drive_arquivo_id,d.excluido_em
      into v_tipo,v_titulo,v_arquivo,v_excluido
      from public.oricse_portal_documentos d
      where d.id=p_documento_id and d.clinica_id=p_clinica_id
        and d.animal_id=p_animal_id
      for update;
    if not found or lower(trim(coalesce(v_tipo,''))) not like 'termo%' then
      raise exception 'Termo não encontrado no prontuário deste animal.';
    end if;
    if v_excluido is not null then raise exception 'Este termo já foi excluído pelo RT.'; end if;
    update public.oricse_portal_documentos
      set excluido_em=now(), excluido_por=p_usuario_id,
          exclusao_motivo=trim(p_motivo), visivel_tutor=false, updated_at=now()
      where id=p_documento_id and clinica_id=p_clinica_id and animal_id=p_animal_id;
  else
    select r.tipo,r.titulo,r.drive_arquivo_id,r.excluido_em
      into v_tipo,v_titulo,v_arquivo,v_excluido
      from public.oricse_portal_receitas r
      where r.id=p_documento_id and r.clinica_id=p_clinica_id
        and r.animal_id=p_animal_id
      for update;
    if not found then raise exception 'Receita não encontrada no prontuário deste animal.'; end if;
    if v_excluido is not null then raise exception 'Esta receita já foi excluída pelo RT.'; end if;
    update public.oricse_portal_receitas
      set excluido_em=now(), excluido_por=p_usuario_id,
          exclusao_motivo=trim(p_motivo), visivel_tutor=false,
          motivo_ocultacao='outro', motivo_outro='Exclusão lógica autorizada pelo RT',
          updated_at=now()
      where id=p_documento_id and clinica_id=p_clinica_id and animal_id=p_animal_id;
  end if;

  insert into public.oricse_auditoria_exclusoes_clinicas
    (clinica_id,animal_id,documento_id,categoria,titulo_original,
     tipo_original,arquivo_original_id,excluido_por,motivo)
  values
    (p_clinica_id,p_animal_id,p_documento_id,p_categoria,v_titulo,
     v_tipo,v_arquivo,p_usuario_id,trim(p_motivo))
  returning id into v_auditoria;
  return v_auditoria;
end;
$$;
revoke all on function public.oricse_arquivar_documento_rt(uuid,uuid,uuid,text,uuid,text)
  from public, anon, authenticated;
grant execute on function public.oricse_arquivar_documento_rt(uuid,uuid,uuid,text,uuid,text)
  to service_role;

comment on function public.oricse_arquivar_documento_rt(uuid,uuid,uuid,text,uuid,text) is
  'Exclusão lógica auditada, exclusiva do RT da clínica, sem apagar o prontuário e os PDFs.';
commit;
