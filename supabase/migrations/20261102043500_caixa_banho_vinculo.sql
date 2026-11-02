alter table public.oricse_caixa_lancamentos add column if not exists agendamento_banho_tosa_id uuid references public.oricse_banho_tosa_agendamentos(id) on delete restrict;
update public.oricse_caixa_lancamentos c set agendamento_banho_tosa_id=p.agendamento_id
from public.oricse_banho_tosa_pagamentos p where c.origem_tipo='banho_tosa_pagamento' and c.origem_id=p.id and c.clinica_id=p.clinica_id and c.agendamento_banho_tosa_id is null;
create index if not exists caixa_banho_atendimento_idx on public.oricse_caixa_lancamentos(clinica_id,agendamento_banho_tosa_id);
