-- O cadastro é a referência do endereço ORICSE. Renomear move os registros,
-- preservando o conteúdo e o estado de publicação na mesma transação.
create function public.oricse_sincronizar_endereco_clinica()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  host_novo text := new.slug || '.oricse.com.br';
  host_anterior text;
  host_legado text;
begin
  if new.excluido_em is not null then return new; end if;

  if new.slug is null or new.slug !~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'
    or new.slug in ('alvorada','www','admin','app','api','auth','c','login','logout','portal',
      'tutor','suporte','mail','email','blog','sistema','oricse','sites','site-da-clinica')
    or old.slug = 'alvorada' then
    if new.slug is not distinct from old.slug then return new; end if;
    raise exception 'Escolha um endereço ORICSE válido e não reservado.' using errcode = '22023';
  end if;

  if tg_when = 'BEFORE' then
    if new.dominio is not null then
      host_legado := regexp_replace(lower(btrim(new.dominio)), '^www[.]', '');
      select d.hostname into host_anterior
      from public.oricse_dominios_clinica d
      where d.clinica_id = new.id and d.tipo = 'oricse';
      if host_legado <> host_novo and host_legado in (lower(old.slug) || '.oricse.com.br', host_anterior) then
        new.dominio := null;
      end if;
    end if;
    return new;
  end if;

  if exists (select 1 from public.clinic_sites s where s.slug = new.slug and s.clinica_id <> new.id) then
    raise exception 'Este endereço ORICSE já pertence a outro site.' using errcode = '23505';
  end if;

  update public.clinic_sites
    set slug = new.slug, updated_at = now()
    where clinica_id = new.id and slug is distinct from new.slug;

  select d.hostname into host_anterior
  from public.oricse_dominios_clinica d
  where d.clinica_id = new.id and d.tipo = 'oricse';
  if not found and new.slug is distinct from old.slug then
    insert into public.oricse_dominios_clinica (clinica_id, hostname, tipo, status, principal, publicar_site)
    values (new.id, host_novo, 'oricse', 'ativo', true, false);
  elsif host_anterior is not null and host_anterior is distinct from host_novo then
    update public.oricse_dominios_clinica
      set hostname = host_novo, ssl_status = null, ultimo_erro = null,
          verificacao_nome = null, verificacao_valor = null, cloudflare_hostname_id = null,
          atualizado_em = now()
      where clinica_id = new.id and tipo = 'oricse';
  end if;
  return new;
end;
$$;

-- Um editor ou uma publicação iniciada em outra aba não pode restaurar o
-- endereço anterior. NOWAIT evita bloquear a renomeação numa ordem inversa.
create function public.oricse_validar_endereco_vinculado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  slug_cadastro text;
  endereco text;
begin
  if tg_table_name = 'clinic_sites' then
    endereco := new.slug;
  elsif new.tipo = 'oricse' then
    endereco := new.hostname;
  else
    return new;
  end if;

  select lower(btrim(c.slug)) into slug_cadastro
    from public.clinicas c where c.id = new.clinica_id for share nowait;
  if tg_table_name = 'oricse_dominios_clinica' then
    slug_cadastro := slug_cadastro || '.oricse.com.br';
  end if;
  if slug_cadastro is null or endereco is distinct from slug_cadastro then
    raise exception 'O endereço da clínica mudou. Atualize a tela e tente novamente.' using errcode = '22023';
  end if;
  return new;
exception when lock_not_available then
  raise exception 'O endereço da clínica está sendo atualizado. Tente novamente.' using errcode = '55P03';
end;
$$;

revoke execute on function public.oricse_sincronizar_endereco_clinica() from public, anon, authenticated;
revoke execute on function public.oricse_validar_endereco_vinculado() from public, anon, authenticated;

create trigger oricse_clinica_ajusta_endereco_legado
before update of slug on public.clinicas
for each row execute function public.oricse_sincronizar_endereco_clinica();

create trigger oricse_clinica_sincroniza_endereco
after update of slug on public.clinicas
for each row execute function public.oricse_sincronizar_endereco_clinica();

create trigger oricse_site_valida_endereco_vinculado
before insert or update of clinica_id, slug on public.clinic_sites
for each row execute function public.oricse_validar_endereco_vinculado();

create trigger oricse_dominio_valida_endereco_vinculado
before insert or update of clinica_id, tipo, hostname on public.oricse_dominios_clinica
for each row execute function public.oricse_validar_endereco_vinculado();
