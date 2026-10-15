begin;

create extension if not exists pgtap with schema extensions;
select plan(13);

-- A suíte cria três usuários simultâneos; amplia o limite apenas dentro da transação.
update public.clinicas
set plano='Master (Equipe)', limite_usuarios=5
where slug='oricse-clinica-testes-isolamento';

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,created_at,updated_at) values
('6f4a64b8-0df8-4b66-aad4-68e8fd7a2101','00000000-0000-0000-0000-000000000000','authenticated','authenticated','m2-rec@test.invalid','!disabled!',now(),now()),
('6f4a64b8-0df8-4b66-aad4-68e8fd7a2102','00000000-0000-0000-0000-000000000000','authenticated','authenticated','m2-vet@test.invalid','!disabled!',now(),now()),
('6f4a64b8-0df8-4b66-aad4-68e8fd7a2103','00000000-0000-0000-0000-000000000000','authenticated','authenticated','m2-rt@test.invalid','!disabled!',now(),now());

insert into public.clinica_usuarios(clinica_id,user_id,papel,ativo)
select id,'6f4a64b8-0df8-4b66-aad4-68e8fd7a2101','recepcao',true from public.clinicas where slug='oricse-clinica-testes-isolamento';
insert into public.clinica_usuarios(clinica_id,user_id,papel,ativo)
select id,'6f4a64b8-0df8-4b66-aad4-68e8fd7a2102','veterinario',true from public.clinicas where slug='oricse-clinica-testes-isolamento';
insert into public.clinica_usuarios(clinica_id,user_id,papel,ativo)
select id,'6f4a64b8-0df8-4b66-aad4-68e8fd7a2103','rt',true from public.clinicas where slug='oricse-clinica-testes-isolamento';

select set_config('request.jwt.claim.sub','6f4a64b8-0df8-4b66-aad4-68e8fd7a2101',true);
set local role authenticated;
select ok(public.oricse_usuario_pode_permissao((select id from public.clinicas where slug='oricse-clinica-testes-isolamento'),'recepcao.cadastros.criar'),'Recepção pode cadastrar');
select ok(public.oricse_usuario_pode_permissao((select id from public.clinicas where slug='oricse-clinica-testes-isolamento'),'recepcao.cadastros.editar'),'Recepção pode editar cadastro');
select ok(not public.oricse_usuario_pode_permissao((select id from public.clinicas where slug='oricse-clinica-testes-isolamento'),'recepcao.cadastros.excluir'),'Recepção não exclui cadastro por padrão');
select ok(public.oricse_usuario_pode_permissao((select id from public.clinicas where slug='oricse-clinica-testes-isolamento'),'caixa.financeiro.visualizar'),'Recepção vê financeiro');
select ok(not public.oricse_usuario_pode_permissao((select id from public.clinicas where slug='oricse-clinica-testes-isolamento'),'consultorio.atendimentos'),'Recepção não acessa consultório por padrão');
select ok(not public.oricse_usuario_pode_permissao((select id from public.clinicas where slug='vetericio'),'recepcao.agenda'),'Permissão não atravessa clínicas');

reset role;
select set_config('request.jwt.claim.sub','6f4a64b8-0df8-4b66-aad4-68e8fd7a2102',true);
set local role authenticated;
select ok(public.oricse_usuario_pode_permissao((select id from public.clinicas where slug='oricse-clinica-testes-isolamento'),'consultorio.atendimentos'),'Veterinário acessa consultório');
select ok(not public.oricse_usuario_pode_permissao((select id from public.clinicas where slug='oricse-clinica-testes-isolamento'),'caixa.financeiro.visualizar'),'Veterinário não vê financeiro por padrão');
select ok(not public.oricse_usuario_pode_permissao((select id from public.clinicas where slug='oricse-clinica-testes-isolamento'),'administracao.site'),'Veterinário não configura site');

reset role;
select set_config('request.jwt.claim.sub','6f4a64b8-0df8-4b66-aad4-68e8fd7a2103',true);
set local role authenticated;
select ok(public.oricse_pode_visualizar_pagamentos((select id from public.clinicas where slug='oricse-clinica-testes-isolamento')),'RT visualiza pagamentos da equipe');
select ok(public.oricse_pode_gerenciar_pagamentos((select id from public.clinicas where slug='oricse-clinica-testes-isolamento')),'RT gerencia pagamentos da equipe');
select ok(public.oricse_usuario_pode_permissao((select id from public.clinicas where slug='oricse-clinica-testes-isolamento'),'administracao.permissoes'),'RT gerencia permissões');
select ok(public.oricse_usuario_pode_permissao((select id from public.clinicas where slug='oricse-clinica-testes-isolamento'),'administracao.site'),'RT configura site');

select * from finish();
rollback;
