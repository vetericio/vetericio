-- Recursos Humanos, jornada, ponto, diárias e comissões: somente Master.
-- Não apagar registros existentes; apenas controlar novas operações por plano.
update public.oricse_planos
set descricao='Operação completa para equipes, internação, estoque e todos os serviços pet.',
    itens=to_jsonb(ARRAY['Até 1.000 animais','3 usuários','Tudo do Essencial','Internação, Banho e Tosa e Hotelzinho','Estoque, Financeiro e gestão de serviços']::text[]),
    updated_at=now()
where codigo='profissional-2026';

update public.oricse_planos
set itens=to_jsonb(ARRAY['Animais ilimitados','5 usuários','Tudo do Profissional','RH, controle de ponto, banco de horas e comissões','CRM avançado, campanhas e automações','Domínio personalizado e personalização sob medida','Fidelidade mínima de 12 meses']::text[]),
    updated_at=now()
where codigo='master-2026';

update public.oricse_plano_funcionalidades pf
set permitido=(p.codigo='master-2026')
from public.oricse_planos p
where p.id=pf.plano_id
  and p.codigo in ('solo-2026','essencial-2026','profissional-2026','master-2026')
  and (pf.funcionalidade_codigo in ('atividade.ponto','equipe.pagamentos')
    or pf.funcionalidade_codigo between 'beneficio.062' and 'beneficio.069');

insert into public.oricse_plano_funcionalidades(plano_id,funcionalidade_codigo,permitido)
select p.id,f.codigo,(p.codigo='master-2026')
from public.oricse_planos p
cross join public.oricse_funcionalidades f
where p.codigo in ('solo-2026','essencial-2026','profissional-2026','master-2026')
  and f.codigo in ('atividade.ponto','equipe.pagamentos')
on conflict (plano_id,funcionalidade_codigo)
do update set permitido=excluded.permitido;
