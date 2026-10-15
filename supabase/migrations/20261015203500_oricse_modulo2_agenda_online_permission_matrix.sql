-- Agenda online da clínica deve obedecer à permissão de agenda, não apenas ao vínculo.

drop policy if exists agenda_equipe_ler on public.oricse_agendas_online;
create policy agenda_equipe_ler on public.oricse_agendas_online
for select to authenticated
using (public.oricse_usuario_pode_permissao(clinica_id,'recepcao.agenda'));

drop policy if exists agenda_equipe_criar on public.oricse_agendas_online;
create policy agenda_equipe_criar on public.oricse_agendas_online
for insert to authenticated
with check (public.oricse_usuario_pode_permissao(clinica_id,'recepcao.agenda'));

drop policy if exists agenda_equipe_editar on public.oricse_agendas_online;
create policy agenda_equipe_editar on public.oricse_agendas_online
for update to authenticated
using (public.oricse_usuario_pode_permissao(clinica_id,'recepcao.agenda'))
with check (public.oricse_usuario_pode_permissao(clinica_id,'recepcao.agenda'));

drop policy if exists agendamento_equipe_ler on public.oricse_agendamentos_online;
create policy agendamento_equipe_ler on public.oricse_agendamentos_online
for select to authenticated
using (public.oricse_usuario_pode_permissao(clinica_id,'recepcao.agenda'));

drop policy if exists agendamento_equipe_editar on public.oricse_agendamentos_online;
create policy agendamento_equipe_editar on public.oricse_agendamentos_online
for update to authenticated
using (public.oricse_usuario_pode_permissao(clinica_id,'recepcao.agenda'))
with check (public.oricse_usuario_pode_permissao(clinica_id,'recepcao.agenda'));

-- Quem recebeu somente movimentação de estoque precisa conseguir localizar os produtos a movimentar.
drop policy if exists oricse_catalogo_leitura_clinica on public.oricse_catalogo_itens;
create policy oricse_catalogo_leitura_clinica on public.oricse_catalogo_itens
for select to authenticated
using (
  public.oricse_usuario_pode_permissao(clinica_id,'estoque.catalogo.visualizar')
  or public.oricse_usuario_pode_permissao(clinica_id,'estoque.movimentar')
);

drop policy if exists "catalogo leitura da propria clinica" on public.clinica_catalogo_itens;
create policy "catalogo leitura da propria clinica" on public.clinica_catalogo_itens
for select to authenticated
using (
  public.oricse_usuario_pode_permissao(clinica_id,'estoque.catalogo.visualizar')
  or public.oricse_usuario_pode_permissao(clinica_id,'estoque.movimentar')
);
