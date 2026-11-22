-- Retornos encaminhados pela ficha entram no CRM sem data pré-definida.
alter table public.oricse_crm_retornos
  alter column data_prevista drop not null;

comment on column public.oricse_crm_retornos.data_prevista is
  'Data prevista do retorno. Nula quando o encaminhamento está aguardando marcação pela equipe no CRM.';
