-- Proteção explícita da tabela privada de assinaturas.
alter table public.oricse_assinaturas enable row level security;
revoke all on table public.oricse_assinaturas from anon, authenticated;
revoke execute on function public.oricse_assinatura_status_clinica(uuid) from public, anon, authenticated;
revoke execute on function public.oricse_acesso_administrativo_liberado(uuid) from public, anon, authenticated;
revoke execute on function public.oricse_vencimento_assinatura(date,integer,text,integer) from public, anon, authenticated;
revoke execute on function public.oricse_vencimento_assinatura_v2(date,integer,text,integer,boolean) from public, anon, authenticated;
revoke execute on function public.oricse_meu_status_assinatura() from public, anon;
grant execute on function public.oricse_meu_status_assinatura() to authenticated;
revoke execute on function public.oricse_portal_reservar_pagamento_agenda(uuid,uuid,timestamptz,text) from public, anon;
grant execute on function public.oricse_portal_reservar_pagamento_agenda(uuid,uuid,timestamptz,text) to authenticated;