-- O ambiente interno da ORICSE usa as mesmas operacoes editoriais do produto.
-- A tabela de midias da plataforma ja existe; habilitar escrita SOMENTE ao admin.
alter table public.oricstudio_sistema_midias enable row level security;
revoke all on public.oricstudio_sistema_midias from anon;
grant select, insert, delete on public.oricstudio_sistema_midias to authenticated;

drop policy if exists oricstudio_sistema_midias_inserir_admin on public.oricstudio_sistema_midias;
create policy oricstudio_sistema_midias_inserir_admin
on public.oricstudio_sistema_midias for insert to authenticated
with check (public.oricstudio_eh_admin());

drop policy if exists oricstudio_sistema_midias_excluir_admin on public.oricstudio_sistema_midias;
create policy oricstudio_sistema_midias_excluir_admin
on public.oricstudio_sistema_midias for delete to authenticated
using (public.oricstudio_eh_admin());

comment on table public.oricstudio_sistema_midias is
  'Midias privadas exclusivas da ORICSE no mesmo editor OricStudio oferecido as clinicas.';
