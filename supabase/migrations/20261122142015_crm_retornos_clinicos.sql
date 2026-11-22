-- Gestão de clientes: retornos clínicos vinculados ao paciente.
-- A operação é somente via funções de servidor com permissão de clínica;
-- nenhuma autorização de leitura/gravação é concedida ao navegador.
begin;

create table if not exists public.oricse_crm_retornos (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id),
  animal_id uuid not null references public.oricse_animais(id),
  tutor_id uuid not null references public.tutores(id),
  origem text not null check (origem in ('consulta','vacina','vermifugo','exame','cirurgia','medicacao','manual','outro')),
  origem_id uuid,
  titulo text not null check (char_length(btrim(titulo)) between 3 and 180),
  orientacoes text not null default '',
  data_prevista date not null,
  status text not null default 'a_confirmar'
    check (status in ('a_confirmar','contatado','confirmado','reagendar','realizado','cancelado')),
  contato_em timestamptz,
  confirmado_em timestamptz,
  realizado_em timestamptz,
  anotacao_equipe text not null default '',
  criado_por uuid,
  atualizado_por uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_retorno_orientacoes_limite check (char_length(orientacoes) <= 2000),
  constraint crm_retorno_anotacao_limite check (char_length(anotacao_equipe) <= 2000)
);

create unique index if not exists oricse_crm_retorno_origem_unica
 on public.oricse_crm_retornos (clinica_id,origem,origem_id)
 where origem_id is not null;
create index if not exists oricse_crm_retornos_clinica_data
 on public.oricse_crm_retornos (clinica_id,status,data_prevista);
create index if not exists oricse_crm_retornos_animal
 on public.oricse_crm_retornos (clinica_id,animal_id,created_at desc);

alter table public.oricse_crm_retornos enable row level security;
revoke all on public.oricse_crm_retornos from public, anon, authenticated;
grant select, insert, update on public.oricse_crm_retornos to service_role;

-- Exames não têm data de retorno atualmente; só criar lembrete se a
-- equipe informar explicitamente a data.
alter table public.oricse_portal_exames add column if not exists retorno_em date;
alter table public.oricse_portal_exames add column if not exists orientacoes_retorno text;

comment on table public.oricse_crm_retornos is
  'Retornos clínicos auditáveis por clínica; nenhum envio é disparado automaticamente.';
comment on column public.oricse_portal_exames.retorno_em is
  'Data indicada pelo profissional para reavaliação ou resultado do exame; opcional.';
commit;
