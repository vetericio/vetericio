begin;

create extension if not exists pgtap with schema extensions;
select plan(15);

update public.clinicas set plano='Master (Equipe)',limite_usuarios=5 where slug='oricse-clinica-testes-isolamento';

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,created_at,updated_at) values
('6f4a64b8-0df8-4b66-aad4-68e8fd7a2501','00000000-0000-0000-0000-000000000000','authenticated','authenticated','m5-tutor-a@test.invalid','!disabled!',now(),now()),
('6f4a64b8-0df8-4b66-aad4-68e8fd7a2502','00000000-0000-0000-0000-000000000000','authenticated','authenticated','m5-tutor-b@test.invalid','!disabled!',now(),now());

insert into public.tutores(id,clinica_id,nome,cpf,telefone,email,dados)
select '7f4a64b8-0df8-4b66-aad4-68e8fd7a2501',id,'Tutor M5 A','11144477735','31999990001','a@test.invalid','{}'::jsonb from public.clinicas where slug='oricse-clinica-testes-isolamento';
insert into public.tutores(id,clinica_id,nome,cpf,telefone,email,dados)
select '7f4a64b8-0df8-4b66-aad4-68e8fd7a2502',id,'Tutor M5 B','52998224725','31999990002','b@test.invalid','{}'::jsonb from public.clinicas where slug='oricse-clinica-testes-isolamento';

insert into public.oricse_portal_tutores(clinica_id,tutor_id,auth_user_id,usuario,usuario_chave)
select id,'7f4a64b8-0df8-4b66-aad4-68e8fd7a2501','6f4a64b8-0df8-4b66-aad4-68e8fd7a2501','@m5.a','m5.a' from public.clinicas where slug='oricse-clinica-testes-isolamento';
insert into public.oricse_portal_tutores(clinica_id,tutor_id,auth_user_id,usuario,usuario_chave)
select id,'7f4a64b8-0df8-4b66-aad4-68e8fd7a2502','6f4a64b8-0df8-4b66-aad4-68e8fd7a2502','@m5.b','m5.b' from public.clinicas where slug='oricse-clinica-testes-isolamento';

insert into public.oricse_animais(id,clinica_id,tutor_id,nome,especie,raca,sexo)
select '8f4a64b8-0df8-4b66-aad4-68e8fd7a2501',id,'7f4a64b8-0df8-4b66-aad4-68e8fd7a2501','Luna M5','Cão','SRD','Fêmea' from public.clinicas where slug='oricse-clinica-testes-isolamento';
insert into public.oricse_animais(id,clinica_id,tutor_id,nome,especie,raca,sexo)
select '8f4a64b8-0df8-4b66-aad4-68e8fd7a2502',id,'7f4a64b8-0df8-4b66-aad4-68e8fd7a2502','Max M5','Gato','SRD','Macho' from public.clinicas where slug='oricse-clinica-testes-isolamento';

insert into public.oricse_portal_comandas(id,clinica_id,tutor_id,animal_id,numero,status,origem,aberta_em,itens,pagamentos,total,total_pago,saldo)
select 'af4a64b8-0df8-4b66-aad4-68e8fd7a2501',id,'7f4a64b8-0df8-4b66-aad4-68e8fd7a2501','8f4a64b8-0df8-4b66-aad4-68e8fd7a2501',501,'Aberta','Recepção',now(),'[{"id":"1","descricao":"Consulta","quantidade":1,"valorUnitario":100}]'::jsonb,'[]'::jsonb,100,0,100 from public.clinicas where slug='oricse-clinica-testes-isolamento';
insert into public.oricse_portal_comandas(id,clinica_id,tutor_id,animal_id,numero,status,origem,aberta_em,itens,pagamentos,total,total_pago,saldo)
select 'af4a64b8-0df8-4b66-aad4-68e8fd7a2502',id,'7f4a64b8-0df8-4b66-aad4-68e8fd7a2502','8f4a64b8-0df8-4b66-aad4-68e8fd7a2502',502,'Aberta','Recepção',now(),'[]'::jsonb,'[]'::jsonb,50,0,50 from public.clinicas where slug='oricse-clinica-testes-isolamento';

insert into public.oricse_agendas_online(id,clinica_id,nome,responsavel,inicio,fim,dias_semana,intervalo_min,portal_ativo,modalidade,antecedencia_horas,timezone,tipo)
select '9f4a64b8-0df8-4b66-aad4-68e8fd7a2501',id,'Agenda M5','Dra. Teste','08:00','12:00',array[0,1,2,3,4,5,6],30,true,'livre',0,'America/Sao_Paulo','Consulta' from public.clinicas where slug='oricse-clinica-testes-isolamento';
insert into public.oricse_agendas_online(id,clinica_id,nome,responsavel,inicio,fim,dias_semana,intervalo_min,portal_ativo,modalidade,antecedencia_horas,timezone,tipo)
select '9f4a64b8-0df8-4b66-aad4-68e8fd7a2502',id,'Agenda Pagamento M5','Dra. Teste','08:00','12:00',array[0,1,2,3,4,5,6],30,true,'pagamento',0,'America/Sao_Paulo','Consulta' from public.clinicas where slug='oricse-clinica-testes-isolamento';

select set_config('request.jwt.claim.sub','6f4a64b8-0df8-4b66-aad4-68e8fd7a2501',true);
set local role authenticated;

select is((select count(*)::bigint from public.oricse_animais where nome like '%M5'),1::bigint,'Tutor enxerga somente um animal próprio');
select ok(exists(select 1 from public.oricse_animais where id='8f4a64b8-0df8-4b66-aad4-68e8fd7a2501'),'Tutor vê o próprio animal');
select ok(not exists(select 1 from public.oricse_animais where id='8f4a64b8-0df8-4b66-aad4-68e8fd7a2502'),'Tutor não vê animal de outro tutor');
select is((select tutor_nome from public.oricse_portal_meu_contexto()),'Tutor M5 A','Contexto identifica o tutor correto');
select is((select count(*)::bigint from public.oricse_portal_comandas where numero in (501,502)),1::bigint,'Tutor enxerga somente uma comanda própria');
select ok(exists(select 1 from public.oricse_portal_comandas where numero=501),'Tutor vê a própria comanda');
select ok(not exists(select 1 from public.oricse_portal_comandas where numero=502),'Tutor não vê comanda de outro tutor');
select ok(exists(select 1 from public.oricse_portal_horarios_disponiveis('9f4a64b8-0df8-4b66-aad4-68e8fd7a2501',current_date+10)),'Portal gera horários reais disponíveis');

select lives_ok(
  $$select * from public.oricse_portal_criar_agendamento(
    '9f4a64b8-0df8-4b66-aad4-68e8fd7a2501',
    '8f4a64b8-0df8-4b66-aad4-68e8fd7a2501',
    (select inicio from public.oricse_portal_horarios_disponiveis('9f4a64b8-0df8-4b66-aad4-68e8fd7a2501',current_date+10) order by inicio limit 1),
    'pgtap módulo 5'
  )$$,
  'Tutor agenda o próprio animal'
);
select is((select estado from public.oricse_agendamentos_online where observacoes='pgtap módulo 5'),'confirmado','Agenda livre confirma o agendamento');
select throws_ok(
  $$select * from public.oricse_portal_criar_agendamento(
    '9f4a64b8-0df8-4b66-aad4-68e8fd7a2501','8f4a64b8-0df8-4b66-aad4-68e8fd7a2502',
    (current_date+10)::timestamp at time zone 'America/Sao_Paulo' + interval '09 hours',null
  )$$,
  '42501',
  'Tutor não agenda animal de outro tutor'
);
select throws_ok(
  $$select * from public.oricse_portal_criar_agendamento(
    '9f4a64b8-0df8-4b66-aad4-68e8fd7a2502','8f4a64b8-0df8-4b66-aad4-68e8fd7a2501',
    (current_date+10)::timestamp at time zone 'America/Sao_Paulo' + interval '10 hours',null
  )$$,
  '42501',
  'Agenda com pagamento continua bloqueada'
);

reset role;
update public.clinicas set plano='Essencial',limite_usuarios=1 where slug='oricse-clinica-testes-isolamento';
set local role authenticated;
select ok(not exists(select 1 from public.oricse_portal_meu_contexto()),'Downgrade do plano bloqueia contexto do portal');
select is((select count(*)::bigint from public.oricse_animais where id='8f4a64b8-0df8-4b66-aad4-68e8fd7a2501'),0::bigint,'Downgrade do plano bloqueia leitura direta do animal');
select ok(not public.oricse_portal_pode_acessar_clinica((select id from public.clinicas where slug='oricse-clinica-testes-isolamento')),'Helper do portal nega clínica sem recurso contratado');

select * from finish();
rollback;
