-- Agenda por usuário contratado: aplica-se somente à criação de agendas.
-- Agendas e agendamentos preexistentes permanecem intactos, inclusive contas legadas
-- que já excedem o limite de usuários atual.
create or replace function public.oricse_validar_cota_agendas()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  limite integer;
  total integer;
begin
  -- Bloqueia concorrência de criação na mesma clínica durante a checagem da cota.
  select greatest(0,coalesce(c.limite_usuarios,0))
    into limite
    from public.clinicas c
   where c.id = new.clinica_id
     and c.excluido_em is null
   for update;

  if not found then
    raise exception 'Clínica não encontrada ou indisponível.'
      using errcode = '23503';
  end if;

  select count(*) into total
    from public.oricse_agendas_online a
   where a.clinica_id = new.clinica_id;

  if total >= limite then
    raise exception 'Limite de % agenda(s) atingido. Solicite agendas adicionais em atendimento@oricse.com.br ou com seu consultor.', limite
      using errcode = '23514';
  end if;
  return new;
end;
$$;

-- A função só pode executar por meio do trigger. A autorização de escrita
-- da tabela segue as políticas de RLS já existentes.
revoke all on function public.oricse_validar_cota_agendas() from public, anon, authenticated;

drop trigger if exists oricse_cota_agendas_insert on public.oricse_agendas_online;
create trigger oricse_cota_agendas_insert
before insert on public.oricse_agendas_online
for each row execute function public.oricse_validar_cota_agendas();
