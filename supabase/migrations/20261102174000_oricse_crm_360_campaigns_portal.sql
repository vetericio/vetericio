-- CRM 360: campanhas segmentadas e avisos seguros do Portal do Tutor.

insert into public.oricse_funcionalidades(codigo,nome,grupo,ordem,ativo)
values ('crm.360','CRM 360','CRM',78,true)
on conflict (codigo) do update set nome=excluded.nome,grupo=excluded.grupo,ordem=excluded.ordem,ativo=true;

insert into public.oricse_plano_funcionalidades(plano_id,funcionalidade_codigo,permitido)
select id,'crm.360',true from public.oricse_planos where codigo='master-equipe'
on conflict (plano_id,funcionalidade_codigo) do update set permitido=excluded.permitido;

insert into public.oricse_permissoes(codigo,nome,grupo,descricao,funcionalidade_codigo,ordem,ativo) values
('crm.campanhas','Publicar campanhas','CRM','Segmentar tutores e criar campanhas de relacionamento.','crm.360',78,true),
('crm.automacoes','Gerenciar automações CRM','CRM','Criar segmentos, tarefas e automações de relacionamento.','crm.360',79,true)
on conflict (codigo) do update set nome=excluded.nome,grupo=excluded.grupo,descricao=excluded.descricao,funcionalidade_codigo=excluded.funcionalidade_codigo,ordem=excluded.ordem,ativo=true;

insert into public.oricse_permissoes_papel(papel,permissao_codigo,permitido)
select papel,permissao_codigo,permitido
from (values
  ('responsavel','crm.campanhas',true),('admin_clinica','crm.campanhas',true),('rt','crm.campanhas',true),
  ('responsavel','crm.automacoes',true),('admin_clinica','crm.automacoes',true),('rt','crm.automacoes',true)
) as p(papel,permissao_codigo,permitido)
on conflict (papel,permissao_codigo) do update set permitido=excluded.permitido;

create table if not exists public.oricse_crm_segmentos (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  nome text not null,
  filtros jsonb not null default '{}'::jsonb,
  ativo boolean not null default true,
  criado_por uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.oricse_crm_campanhas (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  nome text not null,
  assunto text not null default '',
  mensagem text not null,
  canal text not null default 'whatsapp' check (canal in ('whatsapp','email','manual')),
  status text not null default 'rascunho' check (status in ('rascunho','publicada','pausada','cancelada')),
  publico jsonb not null default '{}'::jsonb,
  total_destinatarios integer not null default 0,
  publicado_em timestamptz,
  criado_por uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.oricse_crm_tarefas (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  titulo text not null,
  descricao text,
  status text not null default 'pendente' check (status in ('pendente','concluida','cancelada')),
  prioridade text not null default 'normal' check (prioridade in ('baixa','normal','alta')),
  vencimento timestamptz,
  concluido_em timestamptz,
  criado_por uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.oricse_crm_portal_notificacoes (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  tutor_id uuid references public.tutores(id) on delete set null,
  animal_id uuid references public.oricse_animais(id) on delete set null,
  evento_id uuid references public.oricse_crm_eventos(id) on delete cascade,
  tipo text not null check (tipo in ('resultado_exame','documento_portal','receita_portal')),
  conteudo_id uuid not null,
  link_portal text not null,
  status text not null default 'pendente' check (status in ('pendente','enviado','ignorado','cancelado')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (clinica_id,tipo,conteudo_id)
);

alter table public.oricse_crm_eventos add column if not exists campanha_id uuid references public.oricse_crm_campanhas(id) on delete set null;
alter table public.oricse_crm_eventos drop constraint if exists oricse_crm_eventos_tipo_check;
alter table public.oricse_crm_eventos add constraint oricse_crm_eventos_tipo_check check (tipo in (
  'aniversario','vacina','lembrete_consulta','retorno','pos_cirurgico','inativo',
  'campanha','resultado_exame','documento_portal','receita_portal','cobranca',
  'hotelzinho','banho_tosa','pesquisa_satisfacao'
));

create index if not exists oricse_crm_segmentos_clinica_idx on public.oricse_crm_segmentos(clinica_id,ativo);
create index if not exists oricse_crm_campanhas_clinica_idx on public.oricse_crm_campanhas(clinica_id,criado_em desc);
create index if not exists oricse_crm_tarefas_clinica_idx on public.oricse_crm_tarefas(clinica_id,status,vencimento);
create index if not exists oricse_crm_portal_notificacoes_clinica_idx on public.oricse_crm_portal_notificacoes(clinica_id,status,criado_em desc);
create index if not exists oricse_crm_eventos_campanha_idx on public.oricse_crm_eventos(campanha_id,status);

alter table public.oricse_crm_segmentos enable row level security;
alter table public.oricse_crm_campanhas enable row level security;
alter table public.oricse_crm_tarefas enable row level security;
alter table public.oricse_crm_portal_notificacoes enable row level security;

drop policy if exists crm_segmentos_ler on public.oricse_crm_segmentos;
create policy crm_segmentos_ler on public.oricse_crm_segmentos for select to authenticated using (
  public.oricse_usuario_pode_permissao(clinica_id,'crm.visualizar') or public.oricse_usuario_pode_permissao(clinica_id,'crm.enviar') or public.oricse_usuario_pode_permissao(clinica_id,'crm.gerenciar')
);
drop policy if exists crm_segmentos_gerenciar on public.oricse_crm_segmentos;
create policy crm_segmentos_gerenciar on public.oricse_crm_segmentos for all to authenticated using (
  public.oricse_usuario_pode_permissao(clinica_id,'crm.automacoes') or public.oricse_usuario_pode_permissao(clinica_id,'crm.gerenciar')
) with check (
  public.oricse_usuario_pode_permissao(clinica_id,'crm.automacoes') or public.oricse_usuario_pode_permissao(clinica_id,'crm.gerenciar')
);

drop policy if exists crm_campanhas_ler on public.oricse_crm_campanhas;
create policy crm_campanhas_ler on public.oricse_crm_campanhas for select to authenticated using (
  public.oricse_usuario_pode_permissao(clinica_id,'crm.visualizar') or public.oricse_usuario_pode_permissao(clinica_id,'crm.enviar') or public.oricse_usuario_pode_permissao(clinica_id,'crm.gerenciar')
);
drop policy if exists crm_campanhas_gerenciar on public.oricse_crm_campanhas;
create policy crm_campanhas_gerenciar on public.oricse_crm_campanhas for all to authenticated using (
  public.oricse_usuario_pode_permissao(clinica_id,'crm.campanhas') or public.oricse_usuario_pode_permissao(clinica_id,'crm.gerenciar')
) with check (
  public.oricse_usuario_pode_permissao(clinica_id,'crm.campanhas') or public.oricse_usuario_pode_permissao(clinica_id,'crm.gerenciar')
);

drop policy if exists crm_tarefas_ler on public.oricse_crm_tarefas;
create policy crm_tarefas_ler on public.oricse_crm_tarefas for select to authenticated using (
  public.oricse_usuario_pode_permissao(clinica_id,'crm.visualizar') or public.oricse_usuario_pode_permissao(clinica_id,'crm.enviar') or public.oricse_usuario_pode_permissao(clinica_id,'crm.gerenciar')
);
drop policy if exists crm_tarefas_operar on public.oricse_crm_tarefas;
create policy crm_tarefas_operar on public.oricse_crm_tarefas for all to authenticated using (
  public.oricse_usuario_pode_permissao(clinica_id,'crm.enviar') or public.oricse_usuario_pode_permissao(clinica_id,'crm.gerenciar')
) with check (
  public.oricse_usuario_pode_permissao(clinica_id,'crm.enviar') or public.oricse_usuario_pode_permissao(clinica_id,'crm.gerenciar')
);

drop policy if exists crm_portal_notificacoes_ler on public.oricse_crm_portal_notificacoes;
create policy crm_portal_notificacoes_ler on public.oricse_crm_portal_notificacoes for select to authenticated using (
  public.oricse_usuario_pode_permissao(clinica_id,'crm.visualizar') or public.oricse_usuario_pode_permissao(clinica_id,'crm.enviar') or public.oricse_usuario_pode_permissao(clinica_id,'crm.gerenciar')
);

create or replace function public.oricse_crm_campanha_publicar(p_campanha_id uuid, p_destinatarios jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_campanha public.oricse_crm_campanhas%rowtype;
  v_item jsonb;
  v_tutor public.tutores%rowtype;
  v_canal text;
  v_mensagem text;
  v_total integer := 0;
begin
  select * into v_campanha from public.oricse_crm_campanhas where id=p_campanha_id for update;
  if not found then raise exception 'Campanha não encontrada'; end if;
  if not public.oricse_usuario_pode_permissao(v_campanha.clinica_id,'crm.campanhas')
     and not public.oricse_usuario_pode_permissao(v_campanha.clinica_id,'crm.gerenciar') then
    raise exception 'Sem permissão para publicar campanhas';
  end if;

  for v_item in select value from jsonb_array_elements(coalesce(p_destinatarios,'[]'::jsonb)) loop
    select * into v_tutor from public.tutores where id=(v_item->>'tutor_id')::uuid and clinica_id=v_campanha.clinica_id;
    if not found then continue; end if;
    v_canal := coalesce(nullif(v_item->>'canal',''), case when coalesce(v_tutor.telefone,v_tutor.outro_telefone,'') <> '' then 'whatsapp' when coalesce(v_tutor.email,'') <> '' then 'email' else 'manual' end);
    if v_canal='whatsapp' and coalesce(v_tutor.telefone,v_tutor.outro_telefone,'')='' then
      v_canal := case when coalesce(v_tutor.email,'') <> '' then 'email' else 'manual' end;
    end if;
    v_mensagem := replace(v_campanha.mensagem,'{{tutor}}',coalesce(v_tutor.nome,'Tutor'));
    insert into public.oricse_crm_eventos(clinica_id,tutor_id,destinatario_nome,telefone,email,animal_nome,tipo,titulo,mensagem,canal,agendado_para,status,origem,chave_dedupe,campanha_id,metadados)
    values (v_campanha.clinica_id,v_tutor.id,coalesce(v_tutor.nome,''),coalesce(v_tutor.telefone,v_tutor.outro_telefone,''),coalesce(v_tutor.email,''),'','campanha',v_campanha.assunto,v_mensagem,v_canal,now(),'pendente','manual','campanha:'||v_campanha.id::text||':'||v_tutor.id::text,v_campanha.id,jsonb_build_object('campanha_id',v_campanha.id,'origem','crm_360'))
    on conflict (clinica_id,chave_dedupe) do nothing;
    v_total := v_total + 1;
  end loop;

  update public.oricse_crm_campanhas set status='publicada',total_destinatarios=v_total,publicado_em=now(),atualizado_em=now() where id=v_campanha.id;
  return jsonb_build_object('campanha_id',v_campanha.id,'destinatarios',v_total);
end;
$$;
revoke all on function public.oricse_crm_campanha_publicar(uuid,jsonb) from public;
grant execute on function public.oricse_crm_campanha_publicar(uuid,jsonb) to authenticated;

create or replace function public.oricse_crm_notificar_portal_conteudo()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_tipo text;
  v_tutor public.tutores%rowtype;
  v_animal public.oricse_animais%rowtype;
  v_slug text;
  v_link text;
  v_evento uuid;
  v_secao text;
begin
  if not new.visivel_tutor then return new; end if;
  if tg_table_name='oricse_portal_exames' then v_tipo := 'resultado_exame'; v_secao := 'exames';
  elsif tg_table_name='oricse_portal_documentos' then v_tipo := 'documento_portal'; v_secao := 'documentos';
  else v_tipo := 'receita_portal'; v_secao := 'receitas'; end if;
  select * into v_animal from public.oricse_animais where id=new.animal_id;
  if not found then return new; end if;
  select * into v_tutor from public.tutores where id=v_animal.tutor_id and clinica_id=new.clinica_id;
  if not found then return new; end if;
  select slug into v_slug from public.clinicas where id=new.clinica_id;
  v_link := 'https://oricse.vetericio.workers.dev/pet/' || coalesce(v_slug,new.clinica_id::text) || '/portal?secao=' || v_secao || '&animal=' || new.animal_id::text;
  insert into public.oricse_crm_eventos(clinica_id,tutor_id,destinatario_nome,telefone,email,animal_nome,tipo,titulo,mensagem,canal,agendado_para,status,origem,chave_dedupe,metadados)
  values(new.clinica_id,v_tutor.id,coalesce(v_tutor.nome,''),coalesce(v_tutor.telefone,v_tutor.outro_telefone,''),coalesce(v_tutor.email,''),coalesce(v_animal.nome,''),v_tipo,
    case when v_tipo='resultado_exame' then 'Resultado de exame disponível' when v_tipo='documento_portal' then 'Documento disponível no Portal' else 'Receita disponível no Portal' end,
    'Olá, '||coalesce(v_tutor.nome,'Tutor')||'! Um novo conteúdo de '||coalesce(v_animal.nome,'seu pet')||' está disponível no Portal do Tutor: '||v_link,
    case when coalesce(v_tutor.telefone,v_tutor.outro_telefone,'')<>'' then 'whatsapp' when coalesce(v_tutor.email,'')<>'' then 'email' else 'manual' end,
    now(),'pendente','automatico','portal:'||v_tipo||':'||new.id::text,jsonb_build_object('link_portal',v_link,'conteudo_id',new.id,'secao',v_secao))
  on conflict (clinica_id,chave_dedupe) do update set mensagem=excluded.mensagem,updated_at=now()
  returning id into v_evento;
  insert into public.oricse_crm_portal_notificacoes(clinica_id,tutor_id,animal_id,evento_id,tipo,conteudo_id,link_portal,status)
  values(new.clinica_id,v_tutor.id,new.animal_id,v_evento,v_tipo,new.id,v_link,'pendente')
  on conflict (clinica_id,tipo,conteudo_id) do update set evento_id=excluded.evento_id,link_portal=excluded.link_portal,atualizado_em=now();
  return new;
end;
$$;
revoke all on function public.oricse_crm_notificar_portal_conteudo() from public;

drop trigger if exists oricse_crm_notificar_exame_portal on public.oricse_portal_exames;
create trigger oricse_crm_notificar_exame_portal after insert or update of visivel_tutor,titulo,resultado_resumo on public.oricse_portal_exames for each row execute function public.oricse_crm_notificar_portal_conteudo();
drop trigger if exists oricse_crm_notificar_documento_portal on public.oricse_portal_documentos;
create trigger oricse_crm_notificar_documento_portal after insert or update of visivel_tutor,titulo,observacoes on public.oricse_portal_documentos for each row execute function public.oricse_crm_notificar_portal_conteudo();
drop trigger if exists oricse_crm_notificar_receita_portal on public.oricse_portal_receitas;
create trigger oricse_crm_notificar_receita_portal after insert or update of visivel_tutor on public.oricse_portal_receitas for each row execute function public.oricse_crm_notificar_portal_conteudo();

revoke all on table public.oricse_crm_segmentos, public.oricse_crm_campanhas, public.oricse_crm_tarefas, public.oricse_crm_portal_notificacoes from anon;
grant select,insert,update,delete on table public.oricse_crm_segmentos, public.oricse_crm_campanhas, public.oricse_crm_tarefas, public.oricse_crm_portal_notificacoes to authenticated;
