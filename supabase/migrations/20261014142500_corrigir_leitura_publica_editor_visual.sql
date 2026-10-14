-- Permite que o site público carregue apenas a configuração publicada.
-- Rascunhos e histórico continuam visíveis somente ao administrador pela
-- política administrativa já existente.
drop policy if exists oricse_config_public_site_read on public.oricse_config;

create policy oricse_config_public_site_read
on public.oricse_config
for select
to anon, authenticated
using (chave in ('site_publico', 'visual_editor_published'));
