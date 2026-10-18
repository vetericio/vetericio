-- Versão antiga (4 parâmetros) substituída pela função com área (5 parâmetros).
-- Não altera tabelas nem registros financeiros.
drop function if exists public.oricse_salvar_preco_portal(uuid,text,text,integer);
