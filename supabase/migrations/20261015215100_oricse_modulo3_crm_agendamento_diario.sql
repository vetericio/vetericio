select cron.schedule(
  'oricse-crm-diario',
  '10 11 * * *',
  'select public.oricse_crm_processar_todas();'
);
