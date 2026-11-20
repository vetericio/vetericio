-- Prévia leve e vinculada à referência da logo. O arquivo original permanece no Drive.
alter table public.clinicas
  add column logo_previa jsonb,
  add constraint clinicas_logo_previa_png check (
    logo_previa is null or (
      jsonb_typeof(logo_previa) = 'object'
      and logo_previa - 'origem' - 'imagem' = '{}'::jsonb
      and jsonb_typeof(logo_previa->'origem') = 'string'
      and length(logo_previa->>'origem') between 1 and 2048
      and jsonb_typeof(logo_previa->'imagem') = 'string'
      and length(logo_previa->>'imagem') <= 120000
      and (logo_previa->>'imagem') ~ '^data:image/png;base64,[A-Za-z0-9+/]+={0,2}$'
    ) is true
  );
