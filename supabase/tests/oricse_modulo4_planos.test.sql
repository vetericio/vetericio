begin;

create extension if not exists pgtap with schema extensions;
select plan(15);

select is(
  (select count(*)::bigint
   from public.oricse_planos p
   cross join public.oricse_funcionalidades f
   left join public.oricse_plano_funcionalidades pf
     on pf.plano_id=p.id and pf.funcionalidade_codigo=f.codigo
   where p.ativo and f.ativo and pf.plano_id is null),
  0::bigint,
  'Todo plano ativo possui decisão para toda funcionalidade ativa'
);

update public.clinicas
set plano='Plus (Clínica)', limite_usuarios=1
where slug='oricse-clinica-testes-isolamento';

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,created_at,updated_at) values
('6f4a64b8-0df8-4b66-aad4-68e8fd7a2401','00000000-0000-0000-0000-000000000000','authenticated','authenticated','m4-rt@test.invalid','!disabled!',now(),now()),
('6f4a64b8-0df8-4b66-aad4-68e8fd7a2402','00000000-0000-0000-0000-000000000000','authenticated','authenticated','m4-extra@test.invalid','!disabled!',now(),now());

insert into public.clinica_usuarios(clinica_id,user_id,papel,ativo)
select id,'6f4a64b8-0df8-4b66-aad4-68e8fd7a2401','rt',true
from public.clinicas where slug='oricse-clinica-testes-isolamento';

select set_config('request.jwt.claim.sub','6f4a64b8-0df8-4b66-aad4-68e8fd7a2401',true);
set local role authenticated;
select ok(public.oricse_plano_permite((select id from public.clinicas where slug='oricse-clinica-testes-isolamento'),'consultorio.atendimentos'),'Plus libera consultório');
select ok(not public.oricse_plano_permite((select id from public.clinicas where slug='oricse-clinica-testes-isolamento'),'internacao.painel'),'Plus bloqueia internação');
select ok(not public.oricse_plano_permite((select id from public.clinicas where slug='oricse-clinica-testes-isolamento'),'crm.inteligente'),'Plus bloqueia CRM quando matriz está desligada');
select ok(public.oricse_usuario_pode_permissao((select id from public.clinicas where slug='oricse-clinica-testes-isolamento'),'consultorio.atendimentos'),'Cargo RT acessa recurso permitido pelo plano');
select ok(not public.oricse_usuario_pode_permissao((select id from public.clinicas where slug='oricse-clinica-testes-isolamento'),'internacao.painel'),'Cargo RT não fura bloqueio do plano');
reset role;

insert into public.oricse_clinica_funcionalidade_excecoes(clinica_id,funcionalidade_codigo,permitido,motivo)
select id,'internacao.painel',true,'pgtap módulo 4' from public.clinicas where slug='oricse-clinica-testes-isolamento';
insert into public.oricse_clinica_funcionalidade_excecoes(clinica_id,funcionalidade_codigo,permitido,motivo)
select id,'consultorio.atendimentos',false,'pgtap módulo 4' from public.clinicas where slug='oricse-clinica-testes-isolamento';

set local role authenticated;
select ok(public.oricse_plano_permite((select id from public.clinicas where slug='oricse-clinica-testes-isolamento'),'internacao.painel'),'Exceção pode liberar recurso para uma clínica');
select ok(not public.oricse_plano_permite((select id from public.clinicas where slug='oricse-clinica-testes-isolamento'),'consultorio.atendimentos'),'Exceção pode bloquear recurso para uma clínica');
select ok(public.oricse_usuario_pode_permissao((select id from public.clinicas where slug='oricse-clinica-testes-isolamento'),'internacao.painel'),'Permissão do RT volta a funcionar após liberação excepcional');
select ok(not public.oricse_usuario_pode_permissao((select id from public.clinicas where slug='oricse-clinica-testes-isolamento'),'consultorio.atendimentos'),'Cargo não fura bloqueio excepcional da clínica');
select is(
  (select origem from public.oricse_funcionalidades_efetivas((select id from public.clinicas where slug='oricse-clinica-testes-isolamento')) where codigo='internacao.painel'),
  'excecao',
  'Matriz efetiva informa quando acesso vem de exceção'
);
select is(
  public.oricse_limite_usuarios_clinica((select id from public.clinicas where slug='oricse-clinica-testes-isolamento')),
  1,
  'Limite efetivo de usuários respeita configuração da clínica'
);
reset role;

select throws_ok(
  $$insert into public.clinica_usuarios(clinica_id,user_id,papel,ativo)
    select id,'6f4a64b8-0df8-4b66-aad4-68e8fd7a2402','recepcao',true
    from public.clinicas where slug='oricse-clinica-testes-isolamento'$$,
  '23514',
  'Segundo usuário ativo é bloqueado ao atingir o limite do plano'
);

select is(
  (select count(*)::bigint from public.clinica_usuarios
   where clinica_id=(select id from public.clinicas where slug='oricse-clinica-testes-isolamento') and ativo=true),
  1::bigint,
  'Falha de limite não cria vínculo excedente'
);

select ok(
  not exists(
    select 1
    from public.oricse_clinica_funcionalidade_excecoes e
    where e.clinica_id=(select id from public.clinicas where slug='vetericio')
      and e.motivo='pgtap módulo 4'
  ),
  'Exceções permanecem isoladas por clínica'
);

select * from finish();
rollback;
