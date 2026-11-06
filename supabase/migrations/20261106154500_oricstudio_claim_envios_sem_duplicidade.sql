-- Evita repetir a revisão de um envio de resultado desconhecido.
-- O resultado precisa ser confirmado manualmente antes de qualquer outra tentativa.
-- Reaproveita a mesma reserva atômica do motor original, com licença por clínica.
begin;
create or replace function public.oricstudio_claim_envios(p_limite integer default 5)
returns setof public.oricstudio_envios
language plpgsql security definer set search_path=''
as $$
begin
 return query
  update public.oricstudio_envios e set
    status='processando',bloqueado_ate=now()+interval '2 minutes',atualizado_em=now()
   where e.id in (
     select j.id from public.oricstudio_envios j
       left join public.clinicas c on c.id=j.clinica_id
       left join public.oricstudio_licencas l on l.clinica_id=j.clinica_id
       left join public.oricstudio_meta_contas a on a.id=j.conta_id
     where j.status in ('agendado','processando','aguardando_meta')
       and j.aprovado_por is not null
       and j.planejado_para<=now()
       and (j.proxima_tentativa is null or j.proxima_tentativa<=now())
       and (j.bloqueado_ate is null or j.bloqueado_ate<now())
       and a.status='ativa'
       and (
         j.clinica_id is null
         or (
          c.status='ativa' and c.excluido_em is null
          and l.status='ativo' and (l.expira_em is null or l.expira_em>now())
         )
       )
      order by j.planejado_para
      limit least(greatest(p_limite,1),20)
      for update of j skip locked
   )
  returning e.*;
end $$;
revoke all on function public.oricstudio_claim_envios(integer) from public,anon,authenticated;
grant execute on function public.oricstudio_claim_envios(integer) to service_role;
commit;
