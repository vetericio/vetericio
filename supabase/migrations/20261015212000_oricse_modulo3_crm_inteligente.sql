-- Oricse Módulo 3: CRM inteligente centralizado por clínica.

insert into public.oricse_funcionalidades(codigo,nome,grupo,ordem,ativo)
values ('crm.inteligente','CRM inteligente','CRM',75,true)
on conflict (codigo) do update set
  nome=excluded.nome,
  grupo=excluded.grupo,
  ordem=excluded.ordem,
  ativo=true;

insert into public.oricse_plano_funcionalidades(plano_id,funcionalidade_codigo,permitido)
select p.id,'crm.inteligente',true
from public.oricse_planos p
where p.codigo='master-equipe'
on conflict (plano_id,funcionalidade_codigo) do update set permitido=excluded.permitido;

insert into public.oricse_permissoes(codigo,nome,grupo,descricao,funcionalidade_codigo,ordem,ativo) values
('crm.visualizar','Ver CRM e lembretes','CRM','Consultar fila de relacionamento e histórico de contatos.','crm.inteligente',75,true),
('crm.enviar','Operar contatos do CRM','CRM','Criar, editar e concluir contatos e lembretes do CRM.','crm.inteligente',76,true),
('crm.gerenciar','Configurar CRM','CRM','Editar regras, prazos e modelos de mensagens do CRM.','crm.inteligente',77,true)
on conflict (codigo) do update set
  nome=excluded.nome,
  grupo=excluded.grupo,
  descricao=excluded.descricao,
  funcionalidade_codigo=excluded.funcionalidade_codigo,
  ordem=excluded.ordem,
  ativo=true;

with papeis(papel) as (
  values ('responsavel'),('admin_clinica'),('usuario'),('rt'),('veterinario'),('auxiliar_estagiario'),('recepcao')
), permissoes(codigo) as (
  values ('crm.visualizar'),('crm.enviar'),('crm.gerenciar')
)
insert into public.oricse_permissoes_papel(papel,permissao_codigo,permitido)
select p.papel, pe.codigo,
  case
    when p.papel in ('responsavel','admin_clinica','rt') then true
    when p.papel='recepcao' and pe.codigo in ('crm.visualizar','crm.enviar') then true
    when p.papel='veterinario' and pe.codigo='crm.visualizar' then true
    else false
  end
from papeis p cross join permissoes pe
on conflict (papel,permissao_codigo) do nothing;

create table if not exists public.oricse_crm_config (
  clinica_id uuid primary key references public.clinicas(id) on delete cascade,
  ativo boolean not null default true,
  canal_padrao text not null default 'whatsapp' check (canal_padrao in ('whatsapp','email','manual')),
  dias_antecedencia_agenda integer not null default 1 check (dias_antecedencia_agenda between 0 and 30),
  dias_pos_cirurgico integer not null default 1 check (dias_pos_cirurgico between 0 and 30),
  dias_inatividade integer not null default 180 check (dias_inatividade between 30 and 3650),
  gerar_aniversarios boolean not null default true,
  gerar_reforcos boolean not null default true,
  gerar_agendamentos boolean not null default true,
  gerar_pos_cirurgico boolean not null default true,
  gerar_inativos boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.oricse_crm_modelos (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  tipo text not null check (tipo in ('aniversario','vacina','lembrete_consulta','retorno','pos_cirurgico','inativo')),
  nome text not null,
  assunto text not null default '',
  mensagem text not null,
  canal text not null default 'whatsapp' check (canal in ('whatsapp','email','manual')),
  ativo boolean not null default true,
  criado_por uuid references auth.users(id) on delete set null,
  atualizado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinica_id,tipo)
);

create unique index if not exists tutores_clinica_id_id_unique on public.tutores(clinica_id,id);

create table if not exists public.oricse_crm_eventos (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  tutor_id uuid null,
  tutor_ref_local text null,
  destinatario_nome text not null default '',
  telefone text not null default '',
  email text not null default '',
  animal_nome text not null default '',
  tipo text not null check (tipo in ('aniversario','vacina','lembrete_consulta','retorno','pos_cirurgico','inativo')),
  titulo text not null,
  mensagem text not null,
  canal text not null default 'whatsapp' check (canal in ('whatsapp','email','manual')),
  agendado_para timestamptz not null,
  status text not null default 'pendente' check (status in ('pendente','enviado','ignorado','cancelado')),
  origem text not null default 'automatico' check (origem in ('automatico','manual','importado')),
  chave_dedupe text,
  metadados jsonb not null default '{}'::jsonb,
  criado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  enviado_em timestamptz,
  unique (clinica_id,chave_dedupe),
  constraint oricse_crm_eventos_tutor_mesma_clinica_fkey
    foreign key (clinica_id,tutor_id) references public.tutores(clinica_id,id) on delete set null
);

create index if not exists oricse_crm_eventos_clinica_status_data_idx
  on public.oricse_crm_eventos(clinica_id,status,agendado_para);
create index if not exists oricse_crm_modelos_clinica_idx
  on public.oricse_crm_modelos(clinica_id,tipo);

alter table public.oricse_crm_config enable row level security;
alter table public.oricse_crm_modelos enable row level security;
alter table public.oricse_crm_eventos enable row level security;

drop policy if exists crm_config_ler on public.oricse_crm_config;
create policy crm_config_ler on public.oricse_crm_config for select to authenticated
using (
  public.oricse_usuario_pode_permissao(clinica_id,'crm.visualizar')
  or public.oricse_usuario_pode_permissao(clinica_id,'crm.enviar')
  or public.oricse_usuario_pode_permissao(clinica_id,'crm.gerenciar')
);

drop policy if exists crm_config_gerenciar on public.oricse_crm_config;
create policy crm_config_gerenciar on public.oricse_crm_config for all to authenticated
using (public.oricse_usuario_pode_permissao(clinica_id,'crm.gerenciar'))
with check (public.oricse_usuario_pode_permissao(clinica_id,'crm.gerenciar'));

drop policy if exists crm_modelos_ler on public.oricse_crm_modelos;
create policy crm_modelos_ler on public.oricse_crm_modelos for select to authenticated
using (
  public.oricse_usuario_pode_permissao(clinica_id,'crm.visualizar')
  or public.oricse_usuario_pode_permissao(clinica_id,'crm.enviar')
  or public.oricse_usuario_pode_permissao(clinica_id,'crm.gerenciar')
);

drop policy if exists crm_modelos_gerenciar on public.oricse_crm_modelos;
create policy crm_modelos_gerenciar on public.oricse_crm_modelos for all to authenticated
using (public.oricse_usuario_pode_permissao(clinica_id,'crm.gerenciar'))
with check (public.oricse_usuario_pode_permissao(clinica_id,'crm.gerenciar'));

drop policy if exists crm_eventos_ler on public.oricse_crm_eventos;
create policy crm_eventos_ler on public.oricse_crm_eventos for select to authenticated
using (
  public.oricse_usuario_pode_permissao(clinica_id,'crm.visualizar')
  or public.oricse_usuario_pode_permissao(clinica_id,'crm.enviar')
  or public.oricse_usuario_pode_permissao(clinica_id,'crm.gerenciar')
);

drop policy if exists crm_eventos_operar on public.oricse_crm_eventos;
create policy crm_eventos_operar on public.oricse_crm_eventos for all to authenticated
using (
  public.oricse_usuario_pode_permissao(clinica_id,'crm.enviar')
  or public.oricse_usuario_pode_permissao(clinica_id,'crm.gerenciar')
)
with check (
  public.oricse_usuario_pode_permissao(clinica_id,'crm.enviar')
  or public.oricse_usuario_pode_permissao(clinica_id,'crm.gerenciar')
);

insert into public.oricse_crm_config(clinica_id)
select id from public.clinicas
on conflict (clinica_id) do nothing;

insert into public.oricse_crm_modelos(clinica_id,tipo,nome,assunto,mensagem,canal)
select c.id, m.tipo, m.nome, m.assunto, m.mensagem, m.canal
from public.clinicas c
cross join (values
  ('aniversario','Aniversário','Feliz aniversário!','Olá, {{tutor}}! 🎉 A equipe da {{clinica}} deseja um feliz aniversário. Que seu novo ciclo seja cheio de saúde e momentos especiais!','whatsapp'),
  ('vacina','Vacina / reforço','Lembrete de {{animal}}','Olá, {{tutor}}! 💚 Passando para lembrar que {{animal}} tem {{servico}} previsto para {{data}}. Podemos ajudar a agendar.','whatsapp'),
  ('lembrete_consulta','Lembrete de consulta','Lembrete de consulta','Olá, {{tutor}}! Lembrando que {{animal}} tem {{servico}} agendado para {{data}} às {{hora}} na {{clinica}}.','whatsapp'),
  ('retorno','Retorno','Lembrete de retorno','Olá, {{tutor}}! O retorno de {{animal}} está marcado para {{data}} às {{hora}}. Se precisar ajustar o horário, fale com a {{clinica}}.','whatsapp'),
  ('pos_cirurgico','Pós-cirúrgico','Como {{animal}} está?','Olá, {{tutor}}! 💚 Como {{animal}} está após o procedimento? Se notar qualquer alteração ou tiver dúvidas, entre em contato com a {{clinica}}.','whatsapp'),
  ('inativo','Cliente inativo','Sentimos sua falta','Olá, {{tutor}}! Faz um tempinho que não vemos você e {{animal}}. Se precisar de consulta, vacina ou orientação, a equipe da {{clinica}} está à disposição.','whatsapp')
) as m(tipo,nome,assunto,mensagem,canal)
on conflict (clinica_id,tipo) do nothing;

revoke all on table public.oricse_crm_config from anon;
revoke all on table public.oricse_crm_modelos from anon;
revoke all on table public.oricse_crm_eventos from anon;
grant select,insert,update,delete on table public.oricse_crm_config to authenticated;
grant select,insert,update,delete on table public.oricse_crm_modelos to authenticated;
grant select,insert,update,delete on table public.oricse_crm_eventos to authenticated;
