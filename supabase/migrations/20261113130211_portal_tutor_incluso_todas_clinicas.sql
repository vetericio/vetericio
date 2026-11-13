-- O portal básico acompanha a clínica em todos os planos do catálogo.
insert into public.oricse_plano_funcionalidades (plano_id, funcionalidade_codigo, permitido)
select p.id, f.codigo, true
from public.oricse_planos p
cross join public.oricse_funcionalidades f
where (p.ativo or p.codigo in ('solo-2026', 'essencial-2026', 'profissional-2026', 'master-2026'))
  and f.codigo in (
    'portal_tutor.acesso', 'acao.portal_tutor.gerenciar',
    'beneficio.071', 'beneficio.072', 'beneficio.073', 'beneficio.074', 'beneficio.075'
  )
on conflict (plano_id, funcionalidade_codigo) do update
set permitido = excluded.permitido;
