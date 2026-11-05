-- Não permitir contratar menos contas que as já conectadas à clínica.
create or replace function public.oricstudio_validar_cota_solicitacao()
returns trigger language plpgsql security definer set search_path=''
as $
declare conectadas integer;
begin
  select count(*) into conectadas from public.oricstudio_meta_contas
    where clinica_id=new.clinica_id and status in ('ativa','reautenticar','incompleta');
  if new.quantidade_contas < conectadas then
    raise exception 'Desconecte as contas excedentes antes de contratar um plano menor.';
  end if;
  return new;
end;
$;
revoke all on function public.oricstudio_validar_cota_solicitacao() from public,anon,authenticated;
drop trigger if exists oricstudio_cota_solicitacao_trigger on public.oricstudio_solicitacoes;
create trigger oricstudio_cota_solicitacao_trigger
before insert on public.oricstudio_solicitacoes
for each row execute function public.oricstudio_validar_cota_solicitacao();

