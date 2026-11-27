create table public.oricse_fechamentos_comissao (
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  funcionario_id uuid not null,
  mes date not null check (extract(day from mes)=1),
  itens jsonb not null check (jsonb_typeof(itens)='array' and jsonb_array_length(itens)>0),
  valor_centavos bigint not null,
  fechado_em timestamptz not null default now(),
  fechado_por uuid not null default auth.uid(),
  primary key (clinica_id,funcionario_id,mes)
);
alter table public.oricse_fechamentos_comissao enable row level security;
revoke all on public.oricse_fechamentos_comissao from public,anon,authenticated;
grant select on public.oricse_fechamentos_comissao to authenticated;
grant select, insert on public.oricse_fechamentos_comissao to service_role;
create policy fechamento_comissao_leitura on public.oricse_fechamentos_comissao for select to authenticated
using (public.oricse_usuario_pode_permissao(clinica_id,'equipe.pagamentos.visualizar')
    or public.oricse_usuario_pode_permissao(clinica_id,'equipe.pagamentos.gerenciar'));

-- The server validates authorization and takes a snapshot from the same source as Jornada.
