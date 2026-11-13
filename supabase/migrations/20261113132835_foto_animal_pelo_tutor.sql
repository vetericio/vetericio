-- Permite alterar somente a foto de um pet vinculado ao tutor autenticado.
create function public.oricse_portal_salvar_foto_animal(p_animal_id uuid, p_foto text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := auth.uid();
  v_bytes bytea;
begin
  if v_usuario is null then
    raise exception 'Entre no Portal do Tutor para atualizar a foto.' using errcode = '42501';
  end if;

  if p_foto is null or length(p_foto) > 350000 or
    p_foto !~ '^data:image/jpeg;base64,[A-Za-z0-9+/]+={0,2}$' then
    raise exception 'A imagem enviada é inválida ou excede o tamanho permitido.' using errcode = '22023';
  end if;

  v_bytes := decode(substr(p_foto, 24), 'base64');
  if octet_length(v_bytes) < 4 or substring(v_bytes from 1 for 3) <> decode('ffd8ff', 'hex')
    or substring(v_bytes from octet_length(v_bytes) - 1 for 2) <> decode('ffd9', 'hex') then
    raise exception 'A foto deve estar em formato JPEG.' using errcode = '22023';
  end if;

  update public.oricse_animais a
  set foto_url = p_foto, updated_at = now()
  where a.id = p_animal_id
    and exists (
      select 1 from public.oricse_portal_tutores p
      where p.auth_user_id = v_usuario and p.ativo
        and p.clinica_id = a.clinica_id and p.tutor_id = a.tutor_id
    )
    and public.oricse_portal_pode_acessar_clinica(a.clinica_id);

  if not found then
    raise exception 'Você não tem permissão para alterar a foto deste pet.' using errcode = '42501';
  end if;
  return true;
end;
$$;

revoke all on function public.oricse_portal_salvar_foto_animal(uuid, text) from public, anon;
grant execute on function public.oricse_portal_salvar_foto_animal(uuid, text) to authenticated;
