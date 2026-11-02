-- A cobrança de banho e tosa é registrada somente no caixa geral.
-- Impede lançamentos acima do saldo e vinculação a outra clínica, inclusive concorrentes.
create or replace function public.oricse_validar_caixa_banho()
returns trigger language plpgsql set search_path = public as $$
declare base_centavos bigint; extras_centavos bigint; recebido_centavos bigint; clinica_agendamento uuid;
begin
 if new.setor <> 'Banho e tosa' or new.agendamento_banho_tosa_id is null then return new; end if;
 if new.tipo <> 'entrada' or new.status <> 'pago' then
   raise exception 'Recebimentos do Banho e Tosa devem ser entradas pagas';
 end if;
 if new.origem_tipo <> 'banho_tosa_pagamento' then
   raise exception 'Origem de pagamento de Banho e Tosa inválida';
 end if;
 -- Serialize pagamentos concorrentes por agendamento.
 select clinica_id,valor_centavos into clinica_agendamento,base_centavos
 from public.oricse_banho_tosa_agendamentos
 where id=new.agendamento_banho_tosa_id for update;
 if not found or clinica_agendamento<>new.clinica_id then
   raise exception 'Atendimento não pertence à clínica selecionada';
 end if;
 select coalesce(sum(round(quantidade*valor_unitario_centavos)),0)::bigint into extras_centavos
 from public.oricse_banho_tosa_extras
 where clinica_id=new.clinica_id and agendamento_id=new.agendamento_banho_tosa_id;
 select coalesce(sum(valor_centavos),0)::bigint into recebido_centavos
 from public.oricse_caixa_lancamentos
 where clinica_id=new.clinica_id
 and agendamento_banho_tosa_id=new.agendamento_banho_tosa_id
 and setor='Banho e tosa' and tipo='entrada' and status='pago'
 and id<>new.id;
 if recebido_centavos+new.valor_centavos>base_centavos+extras_centavos then
   raise exception 'O recebimento ultrapassa o saldo do atendimento';
 end if;
 return new;
end $$;
drop trigger if exists oricse_caixa_validar_banho on public.oricse_caixa_lancamentos;
create trigger oricse_caixa_validar_banho before insert or update
on public.oricse_caixa_lancamentos for each row
execute function public.oricse_validar_caixa_banho();
