-- CRM premium: status operacionais independentes e métricas vivas por campanha.
alter table public.oricse_crm_campanhas
  drop constraint if exists oricse_crm_campanhas_status_check;
alter table public.oricse_crm_campanhas
  add constraint oricse_crm_campanhas_status_check
  check (status in ('rascunho','pronta','agendada','pausada','encerrada'));

create or replace function public.oricse_crm_atualizar_metricas_campanha()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campanha_id uuid;
begin
  if tg_op = 'delete' then
    v_campanha_id := old.campanha_id;
  else
    v_campanha_id := new.campanha_id;
  end if;

  if v_campanha_id is not null then
    update public.oricse_crm_campanhas as campanha
       set enviados = (
             select count(*)
               from public.oricse_crm_eventos as evento
              where evento.campanha_id = v_campanha_id
                and evento.status = 'enviado'
           ),
           updated_at = now()
     where campanha.id = v_campanha_id;
  end if;

  if tg_op = 'delete' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.oricse_crm_atualizar_metricas_campanha() from public;

drop trigger if exists oricse_crm_campanha_metricas_eventos on public.oricse_crm_eventos;
create trigger oricse_crm_campanha_metricas_eventos
after insert or update or delete on public.oricse_crm_eventos
for each row execute function public.oricse_crm_atualizar_metricas_campanha();

update public.oricse_crm_campanhas as campanha
   set enviados = (
         select count(*)
           from public.oricse_crm_eventos as evento
          where evento.campanha_id = campanha.id
            and evento.status = 'enviado'
       ),
       updated_at = now();