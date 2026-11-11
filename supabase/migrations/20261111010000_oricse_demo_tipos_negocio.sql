-- Expande as categorias aceitas para solicitações de demonstração.
-- Preserva categorias anteriores somente para formulários abertos em versões antigas.
-- Nenhuma tabela, RLS, outra função ou dado existente é alterado.
do $migration$
declare
  definition text;
  old_list text := $old$array['Clínica veterinária','Hospital veterinário','Consultório veterinário','Pet shop','Banho e tosa','Hotelzinho/creche','Outro']$old$;
  new_list text := $new$array['Clínica/hospital veterinário','Consultório veterinário','Veterinário particular','Pet shop','Banho e tosa','Hotelzinho/creche','Casa de ração','ONG','Outro','Clínica veterinária','Hospital veterinário']$new$;
begin
  definition := pg_catalog.pg_get_functiondef('public.oricse_solicitar_demonstracao(jsonb)'::regprocedure);
  if pg_catalog.strpos(definition, old_list) = 0 then
    if pg_catalog.strpos(definition, new_list) > 0 then
      return; -- migration idempotente
    end if;
    raise exception 'Lista atual de tipos diverge da versao esperada; abortando sem modificar';
  end if;
  execute pg_catalog.replace(definition, old_list, new_list);
end
$migration$;
