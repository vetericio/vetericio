-- Conflict protection is enforced atomically in PostgreSQL, not only in the browser.
create or replace function public.oricse_bt_bloquear_conflito() returns trigger
language plpgsql set search_path = public as $$
begin
 if new.status <> 'cancelado' and btrim(new.profissional) <> '' then
   perform pg_advisory_xact_lock(hashtextextended(new.clinica_id::text || ':' || lower(btrim(new.profissional)), 0));
   if exists (
     select 1 from public.oricse_banho_tosa_agendamentos a
     where a.clinica_id = new.clinica_id
       and a.id <> new.id and a.status <> 'cancelado'
       and lower(btrim(a.profissional)) = lower(btrim(new.profissional))
       and a.inicio < new.fim and a.fim > new.inicio
   ) then raise exception 'Profissional já possui agendamento neste horário' using errcode = '23505'; end if;
 end if;
 return new;
end $$;
drop trigger if exists oricse_bt_conflito on public.oricse_banho_tosa_agendamentos;
create trigger oricse_bt_conflito before insert or update of inicio, fim, profissional, status
on public.oricse_banho_tosa_agendamentos for each row execute function public.oricse_bt_bloquear_conflito();
-- Explicit, auditable payments per appointment, never inferred from completed work.
create table if not exists public.oricse_banho_tosa_pagamentos (
 id uuid primary key default gen_random_uuid(),
 clinica_id uuid not null references public.clinicas(id) on delete cascade,
 agendamento_id uuid not null references public.oricse_banho_tosa_agendamentos(id) on delete restrict,
 valor_centavos integer not null check(valor_centavos>0),
 forma text not null check (char_length(btrim(forma)) between 2 and 40),
 registrado_em timestamptz not null default now(),
 registrado_por uuid references auth.users(id) on delete set null
);
create index if not exists bt_pagamentos_clinica_data on public.oricse_banho_tosa_pagamentos(clinica_id,registrado_em desc);
alter table public.oricse_banho_tosa_pagamentos enable row level security;
grant select, insert on public.oricse_banho_tosa_pagamentos to authenticated;
create policy bt_pagamentos_select on public.oricse_banho_tosa_pagamentos for select to authenticated using(public.oricse_usuario_pode_permissao(clinica_id,'caixa.financeiro.visualizar') or public.oricse_usuario_pode_permissao(clinica_id,'hotelzinho.visualizar'));
create policy bt_pagamentos_insert on public.oricse_banho_tosa_pagamentos for insert to authenticated with check(public.oricse_usuario_pode_permissao(clinica_id,'caixa.comandas') or public.oricse_usuario_pode_permissao(clinica_id,'caixa.financeiro.visualizar'));
