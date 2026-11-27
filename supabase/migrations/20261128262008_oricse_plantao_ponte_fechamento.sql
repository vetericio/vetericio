-- Ponte aditiva para o fechamento: permanece durante rollback do Worker.
-- Não altera administração avulsa, Pendências, caixa ou prontuário.
create schema if not exists private;

create function private.oricse_plantao_nao_gravar_apos_fechamento()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  -- Serializa inclusive a inserção do Worker antigo com o novo fechamento.
  perform 1 from public.oricse_dados_modulos
    where clinica_id=new.clinica_id and chave='estado_sistema' for update;
  if exists (select 1 from public.oricse_fechamentos_plantao
    where clinica_id=new.clinica_id and turno_chave=new.turno_chave) then
    raise exception 'Este plantão já foi arquivado. Atualize para o turno atual.'
      using errcode='40001';
  end if;
  return new;
end;
$$;
revoke all on function private.oricse_plantao_nao_gravar_apos_fechamento() from public,anon,authenticated,service_role;
create trigger oricse_plantao_nao_gravar_apos_fechamento
before insert on public.oricse_painel_plantao_eventos
for each row execute function private.oricse_plantao_nao_gravar_apos_fechamento();

-- RLS e grants de oricse_dados_modulos continuam autorizando a escrita.
-- A trigger só examina a trilha privada da própria linha; nunca devolve seus dados.
-- SECURITY DEFINER evita exigir SELECT na tabela de arquivo para usuários autenticados.
create function private.oricse_plantao_guardar_fechamento_na_transicao()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  turno_anterior jsonb;
  turno_recebido jsonb;
  chave_turno text;
  arquivo_anterior jsonb;
  arquivo_recebido jsonb;
begin
  -- OLD é a única identidade consultada na tabela privada. O resultado não
  -- depende de um ID recebido em dados/NEW, e nenhuma linha de outra clínica é atualizada.
  if tg_op = 'DELETE' then
    if old.chave = 'estado_sistema' and exists (
      select 1 from public.oricse_fechamentos_plantao where clinica_id=old.clinica_id
    ) then
      raise exception 'O estado de uma internação com plantão arquivado não pode ser removido.'
        using errcode='40001';
    end if;
    return old;
  end if;
  if old.chave <> 'estado_sistema' then return new; end if;
  if new.clinica_id is distinct from old.clinica_id or new.chave is distinct from old.chave then
    if exists (select 1 from public.oricse_fechamentos_plantao where clinica_id=old.clinica_id) then
      raise exception 'O estado de uma internação com plantão arquivado não pode ser movido.'
        using errcode='40001';
    end if;
    return new;
  end if;
  if old.dados->>'veterico-registros-v1' is not distinct from new.dados->>'veterico-registros-v1'
    and old.dados->>'veterico-plantoes-v1' is not distinct from new.dados->>'veterico-plantoes-v1'
    and old.dados->>'veterico-plantao-v1' is not distinct from new.dados->>'veterico-plantao-v1' then
    return new;
  end if;
  -- Worker antigo + schema novo continua operando até o primeiro fechamento seguro
  -- nesta clínica. Um snapshot de módulos não pode desfazer esse fechamento depois.
  if not exists (select 1 from public.oricse_fechamentos_plantao where clinica_id=old.clinica_id)
    then return new; end if;
  turno_anterior := (old.dados->>'veterico-plantao-v1')::jsonb;
  turno_recebido := (new.dados->>'veterico-plantao-v1')::jsonb;
  if turno_recebido ? 'dia' and turno_recebido ? 'turno' then
    chave_turno := coalesce(nullif(turno_recebido->>'id',''),
      'legado:'||(turno_recebido->>'dia')||':'||(turno_recebido->>'turno')||':'||
      coalesce(turno_recebido->>'escolhidoEm',turno_recebido->>'dia'));
    if exists (select 1 from public.oricse_fechamentos_plantao
      where clinica_id=old.clinica_id and turno_chave=chave_turno) then
      raise exception 'Este plantão já foi arquivado. Atualize antes de gravar a nova versão.'
        using errcode='40001';
    end if;
  end if;
  if (turno_anterior ? 'dia') and (turno_anterior is distinct from turno_recebido)
    and (turno_recebido is null or (turno_recebido ? 'finalizadoEm' and not (turno_recebido ? 'turnoChave'))) then
    raise exception 'O encerramento antigo não preserva as internações. Atualize para o fechamento seguro.'
      using errcode='40001';
  end if;
  -- Enquanto ainda está entre turnos, bloqueia uma segunda parte atrasada do
  -- fechamento legado. Em turno novo ativo, a exclusão individual não muda.
  if (turno_anterior ? 'turnoChave')
    and jsonb_array_length(coalesce((old.dados->>'veterico-registros-v1')::jsonb,'[]'::jsonb)) > 0
    and jsonb_array_length(coalesce((new.dados->>'veterico-registros-v1')::jsonb,'[]'::jsonb)) = 0 then
    raise exception 'A lista de internação protegida não pode ser esvaziada pelo gravador antigo.'
      using errcode='40001';
  end if;
  arquivo_anterior := coalesce((old.dados->>'veterico-plantoes-v1')::jsonb,'[]'::jsonb);
  arquivo_recebido := coalesce((new.dados->>'veterico-plantoes-v1')::jsonb,'[]'::jsonb);
  if exists (
    select 1 from jsonb_array_elements(arquivo_anterior) as anterior(p)
    where (p ? 'turnoChave') and not exists (
      select 1 from jsonb_array_elements(arquivo_recebido) as recebeu(q) where q=p
    )
  ) then
    raise exception 'Já há fechamentos arquivados. Atualize antes de gravar.'
      using errcode='40001';
  end if;
  return new;
end;
$$;
revoke all on function private.oricse_plantao_guardar_fechamento_na_transicao() from public,anon,authenticated,service_role;
create trigger oricse_plantao_guardar_fechamento_na_transicao
before update of dados, clinica_id, chave or delete on public.oricse_dados_modulos for each row
execute function private.oricse_plantao_guardar_fechamento_na_transicao();
