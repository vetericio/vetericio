begin;

create extension if not exists pgtap with schema extensions;
select plan(13);

select ok(exists(select 1 from public.oricse_funcionalidades where codigo='crm.inteligente'),'Funcionalidade CRM existe');
select is((select count(*)::bigint from public.oricse_permissoes where codigo like 'crm.%'),3::bigint,'CRM possui três permissões granulares');
select ok(exists(select 1 from cron.job where jobname='oricse-crm-diario' and active),'Cron diário do CRM está ativo');

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,created_at,updated_at)
values('6f4a64b8-0df8-4b66-aad4-68e8fd7a2301','00000000-0000-0000-0000-000000000000','authenticated','authenticated','m3-rt@test.invalid','!disabled!',now(),now());

insert into public.clinica_usuarios(clinica_id,user_id,papel,ativo)
select id,'6f4a64b8-0df8-4b66-aad4-68e8fd7a2301','rt',true
from public.clinicas where slug='oricse-clinica-testes-isolamento';

select set_config('request.jwt.claim.sub','6f4a64b8-0df8-4b66-aad4-68e8fd7a2301',true);
set local role authenticated;

select ok(public.oricse_usuario_pode_permissao((select id from public.clinicas where slug='oricse-clinica-testes-isolamento'),'crm.visualizar'),'RT visualiza CRM');
select ok(public.oricse_usuario_pode_permissao((select id from public.clinicas where slug='oricse-clinica-testes-isolamento'),'crm.enviar'),'RT opera CRM');
select ok(public.oricse_usuario_pode_permissao((select id from public.clinicas where slug='oricse-clinica-testes-isolamento'),'crm.gerenciar'),'RT configura CRM');

update public.oricse_crm_config set gerar_inativos=true,dias_inatividade=180
where clinica_id=(select id from public.clinicas where slug='oricse-clinica-testes-isolamento');

insert into public.oricse_crm_fontes(clinica_id,tutores,animais,prontuario,agendas,sincronizado_por)
select id,
 '[{"id":"m3-t1","nome":"Aniversário","telefone":"31999999999","nascimento":"1980-10-15","autorizaLembretes":true,"autorizaWhatsapp":true},{"id":"m3-t2","nome":"Retorno","telefone":"31988888888","autorizaLembretes":true,"autorizaWhatsapp":true},{"id":"m3-t3","nome":"Cirurgia","telefone":"31977777777","autorizaLembretes":true,"autorizaWhatsapp":true},{"id":"m3-t4","nome":"Inativo","telefone":"31966666666","criadoEm":"2025-01-01","autorizaLembretes":true,"autorizaWhatsapp":true,"autorizaMarketing":true}]'::jsonb,
 '[{"id":"m3-a1","tutorId":"m3-t1","nome":"Pet Vacina"},{"id":"m3-a2","tutorId":"m3-t2","nome":"Pet Retorno"},{"id":"m3-a3","tutorId":"m3-t3","nome":"Pet Cirurgia"},{"id":"m3-a4","tutorId":"m3-t4","nome":"Pet Inativo"}]'::jsonb,
 '[{"id":"m3-r1","animalId":"m3-a1","tipo":"Vacinas","titulo":"V10","proximaDose":"2026-10-16"}]'::jsonb,
 '[{"id":"m3-ag","eventos":[{"id":"m3-e-ret","data":"2026-10-16","hora":"14:00","tipo":"Retorno","tutorId":"m3-t2","animalId":"m3-a2"},{"id":"m3-e-cir","data":"2026-10-14","hora":"10:00","tipo":"Cirurgia","tutorId":"m3-t3","animalId":"m3-a3"}]}]'::jsonb,
 '6f4a64b8-0df8-4b66-aad4-68e8fd7a2301'::uuid
from public.clinicas where slug='oricse-clinica-testes-isolamento'
on conflict (clinica_id) do update set tutores=excluded.tutores,animais=excluded.animais,prontuario=excluded.prontuario,agendas=excluded.agendas,sincronizado_por=excluded.sincronizado_por,sincronizado_em=now(),updated_at=now();

select ok(public.oricse_crm_processar_clinica((select id from public.clinicas where slug='oricse-clinica-testes-isolamento')) >= 5,'Processador gera eventos automáticos');
select ok(exists(select 1 from public.oricse_crm_eventos where tipo='aniversario' and chave_dedupe like 'aniversario:m3-t1:%'),'Gera aniversário');
select ok(exists(select 1 from public.oricse_crm_eventos where tipo='vacina' and chave_dedupe like 'vacina:m3-r1:%'),'Gera vacina/reforço');
select ok(exists(select 1 from public.oricse_crm_eventos where tipo='retorno' and chave_dedupe like 'retorno:m3-e-ret:%'),'Gera retorno');
select ok(exists(select 1 from public.oricse_crm_eventos where tipo='pos_cirurgico' and chave_dedupe like 'pos_cirurgico:m3-e-cir:%'),'Gera pós-cirúrgico');
select ok(exists(select 1 from public.oricse_crm_eventos where tipo='inativo' and chave_dedupe like 'inativo:m3-t4:%'),'Gera recuperação de inativo');
select ok(exists(select 1 from public.oricse_crm_fila_envio),'Prepara fila para integração de envio');

select * from finish();
rollback;
