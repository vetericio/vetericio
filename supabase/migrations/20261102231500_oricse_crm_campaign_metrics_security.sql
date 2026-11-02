-- Internal trigger helper: never expose it as a Data API RPC.
revoke all on function public.oricse_crm_atualizar_metricas_campanha() from public, anon, authenticated;
