drop policy if exists caixa_geral_insert on public.oricse_caixa_lancamentos;
create policy caixa_geral_insert on public.oricse_caixa_lancamentos
for insert to authenticated
with check (
  public.oricse_usuario_pode_permissao(clinica_id,'caixa.comandas')
  or public.oricse_usuario_pode_permissao(clinica_id,'caixa.financeiro.gerenciar')
);
-- Read-only financial access must never be sufficient to register a receipt.
