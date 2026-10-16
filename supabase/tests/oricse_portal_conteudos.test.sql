begin;

create extension if not exists pgtap with schema extensions;
select plan(9);

update public.clinicas set plano='Master (Equipe)',limite_usuarios=5 where slug='oricse-clinica-testes-isolamento';

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,created_at,updated_at)
values
('6f4a64b8-0df8-4b66-aad4-68e8fd7a2701','00000000-0000-0000-0000-000000000000','authenticated','authenticated','portal-test-a@test.invalid','!disabled!',now(),now()),
('6f4a64b8-0df8-4b66-aad4-68e8fd7a2702','00000000-0000-0000-0000-000000000000','authenticated','authenticated','portal-test-b@test.invalid','!disabled!',now(),now());

insert into public.tutores(id,clinica_id,nome,cpf,telefone,dados)
select '7f4a64b8-0df8-4b66-aad4-68e8fd7a2701',id,'Tutor Portal A','11144477735','31999992701','{}'::jsonb from public.clinicas where slug='oricse-clinica-testes-isolamento';
insert into public.tutores(id,clinica_id,nome,cpf,telefone,dados)
select '7f4a64b8-0df8-4b66-aad4-68e8fd7a2702',id,'Tutor Portal B','52998224725','31999992702','{}'::jsonb from public.clinicas where slug='oricse-clinica-testes-isolamento';

insert into public.oricse_portal_tutores(clinica_id,tutor_id,auth_user_id,usuario,usuario_chave)
select id,'7f4a64b8-0df8-4b66-aad4-68e8fd7a2701','6f4a64b8-0df8-4b66-aad4-68e8fd7a2701','@portal.a','portal.a' from public.clinicas where slug='oricse-clinica-testes-isolamento';
insert into public.oricse_portal_tutores(clinica_id,tutor_id,auth_user_id,usuario,usuario_chave)
select id,'7f4a64b8-0df8-4b66-aad4-68e8fd7a2702','6f4a64b8-0df8-4b66-aad4-68e8fd7a2702','@portal.b','portal.b' from public.clinicas where slug='oricse-clinica-testes-isolamento';

insert into public.oricse_animais(id,clinica_id,tutor_id,nome,especie)
select '8f4a64b8-0df8-4b66-aad4-68e8fd7a2701',id,'7f4a64b8-0df8-4b66-aad4-68e8fd7a2701','Pet Portal A','Cão' from public.clinicas where slug='oricse-clinica-testes-isolamento';
insert into public.oricse_animais(id,clinica_id,tutor_id,nome,especie)
select '8f4a64b8-0df8-4b66-aad4-68e8fd7a2702',id,'7f4a64b8-0df8-4b66-aad4-68e8fd7a2702','Pet Portal B','Gato' from public.clinicas where slug='oricse-clinica-testes-isolamento';

insert into public.drive_arquivos(id,clinica_id,categoria,nome,mime_type,tamanho_bytes,drive_file_id,visibilidade,entidade_tipo,entidade_id,metadata)
select '9f4a64b8-0df8-4b66-aad4-68e8fd7a2701',id,'exames','hemograma.pdf','application/pdf',100,'fake-exame-portal','tutor','exame','af4a64b8-0df8-4b66-aad4-68e8fd7a2701','{}'::jsonb from public.clinicas where slug='oricse-clinica-testes-isolamento';

insert into public.oricse_portal_exames(id,clinica_id,animal_id,titulo,tipo,realizado_em,drive_arquivo_id,visivel_tutor)
select 'af4a64b8-0df8-4b66-aad4-68e8fd7a2701',id,'8f4a64b8-0df8-4b66-aad4-68e8fd7a2701','Hemograma A','Hemograma',current_date,'9f4a64b8-0df8-4b66-aad4-68e8fd7a2701',true from public.clinicas where slug='oricse-clinica-testes-isolamento';
insert into public.oricse_portal_exames(id,clinica_id,animal_id,titulo,tipo,realizado_em,visivel_tutor)
select 'af4a64b8-0df8-4b66-aad4-68e8fd7a2702',id,'8f4a64b8-0df8-4b66-aad4-68e8fd7a2701','Hemograma oculto','Hemograma',current_date,false from public.clinicas where slug='oricse-clinica-testes-isolamento';
insert into public.oricse_portal_exames(id,clinica_id,animal_id,titulo,tipo,realizado_em,visivel_tutor)
select 'af4a64b8-0df8-4b66-aad4-68e8fd7a2799',id,'8f4a64b8-0df8-4b66-aad4-68e8fd7a2702','Hemograma B','Hemograma',current_date,true from public.clinicas where slug='oricse-clinica-testes-isolamento';

insert into public.oricse_portal_receitas(id,clinica_id,tutor_id,animal_id,tipo,titulo,visivel_tutor,motivo_ocultacao)
select 'bf4a64b8-0df8-4b66-aad4-68e8fd7a2701',id,'7f4a64b8-0df8-4b66-aad4-68e8fd7a2701','8f4a64b8-0df8-4b66-aad4-68e8fd7a2701','normal','Receita A',true,null from public.clinicas where slug='oricse-clinica-testes-isolamento';
insert into public.oricse_portal_receitas(id,clinica_id,tutor_id,animal_id,tipo,titulo,visivel_tutor,motivo_ocultacao)
select 'bf4a64b8-0df8-4b66-aad4-68e8fd7a2702',id,'7f4a64b8-0df8-4b66-aad4-68e8fd7a2701','8f4a64b8-0df8-4b66-aad4-68e8fd7a2701','normal','Receita A oculta',false,'uso_interno' from public.clinicas where slug='oricse-clinica-testes-isolamento';
insert into public.oricse_portal_receitas(id,clinica_id,tutor_id,animal_id,tipo,titulo,visivel_tutor)
select 'bf4a64b8-0df8-4b66-aad4-68e8fd7a2799',id,'7f4a64b8-0df8-4b66-aad4-68e8fd7a2702','8f4a64b8-0df8-4b66-aad4-68e8fd7a2702','normal','Receita B',true from public.clinicas where slug='oricse-clinica-testes-isolamento';

insert into public.oricse_portal_comandas(id,clinica_id,tutor_id,animal_id,numero,status,origem,aberta_em,finalizada_em,itens,pagamentos,total,total_pago,saldo,visivel_tutor)
select 'cf4a64b8-0df8-4b66-aad4-68e8fd7a2701',id,'7f4a64b8-0df8-4b66-aad4-68e8fd7a2701','8f4a64b8-0df8-4b66-aad4-68e8fd7a2701',99701,'Aberta','Teste',now(),null,'[]','[]',100,0,100,true from public.clinicas where slug='oricse-clinica-testes-isolamento';
insert into public.oricse_portal_comandas(id,clinica_id,tutor_id,animal_id,numero,status,origem,aberta_em,finalizada_em,itens,pagamentos,total,total_pago,saldo,visivel_tutor)
select 'cf4a64b8-0df8-4b66-aad4-68e8fd7a2702',id,'7f4a64b8-0df8-4b66-aad4-68e8fd7a2701','8f4a64b8-0df8-4b66-aad4-68e8fd7a2701',99702,'Finalizada','Teste',now()-interval '1 day',now(),'[]','[]',80,80,0,true from public.clinicas where slug='oricse-clinica-testes-isolamento';
insert into public.oricse_portal_comandas(id,clinica_id,tutor_id,animal_id,numero,status,origem,aberta_em,itens,pagamentos,total,total_pago,saldo,visivel_tutor)
select 'cf4a64b8-0df8-4b66-aad4-68e8fd7a2799',id,'7f4a64b8-0df8-4b66-aad4-68e8fd7a2702','8f4a64b8-0df8-4b66-aad4-68e8fd7a2702',99799,'Aberta','Teste',now(),'[]','[]',50,0,50,true from public.clinicas where slug='oricse-clinica-testes-isolamento';

select set_config('request.jwt.claim.sub','6f4a64b8-0df8-4b66-aad4-68e8fd7a2701',true);
set local role authenticated;
select is((select count(*)::bigint from public.oricse_portal_exames where id in ('af4a64b8-0df8-4b66-aad4-68e8fd7a2701','af4a64b8-0df8-4b66-aad4-68e8fd7a2702','af4a64b8-0df8-4b66-aad4-68e8fd7a2799')),1::bigint,'Tutor vê somente exame próprio e visível');
select ok(exists(select 1 from public.oricse_portal_exames where id='af4a64b8-0df8-4b66-aad4-68e8fd7a2701' and drive_arquivo_id is not null),'Exame visível mantém vínculo com PDF');
select is((select count(*)::bigint from public.oricse_portal_receitas where id in ('bf4a64b8-0df8-4b66-aad4-68e8fd7a2701','bf4a64b8-0df8-4b66-aad4-68e8fd7a2702','bf4a64b8-0df8-4b66-aad4-68e8fd7a2799')),1::bigint,'Tutor vê somente receita própria e visível');
select ok(not exists(select 1 from public.oricse_portal_receitas where id='bf4a64b8-0df8-4b66-aad4-68e8fd7a2702'),'Receita oculta não aparece para tutor');
select is((select count(*)::bigint from public.oricse_portal_comandas where numero in (99701,99702,99799)),2::bigint,'Tutor vê somente as próprias comandas');
select ok(exists(select 1 from public.oricse_portal_comandas where numero=99701 and status='Aberta'),'Comanda aberta aparece');
select ok(exists(select 1 from public.oricse_portal_comandas where numero=99702 and status='Finalizada'),'Comanda finalizada aparece');
select ok(not exists(select 1 from public.oricse_portal_comandas where numero=99799),'Comanda de outro tutor não aparece');
select ok(public.oricse_portal_pode_acessar_clinica((select id from public.clinicas where slug='oricse-clinica-testes-isolamento')),'Portal permanece permitido no plano Master');
select * from finish();
rollback;
