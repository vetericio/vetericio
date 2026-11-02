-- CRM 360: campanhas segmentadas e links seguros para conteúdos do Portal do Tutor.

insert into public.oricse_funcionalidades(codigo,nome,grupo,ordem,ativo)
values ('crm.360','CRM 360','CRM',78,true)
on conflict (codigo) do update set nome=excluded.nome,grupo=excluded.grupo,ordem=excluded.ordem,ativo=true;

insert into public.oricse_plano_funcionalidades(plano_id,funcionalidade_codigo,permitido)
select id,'crm.360',true from public.oricse_planos where codigo='master-equipe'
on conflict (plano_id,funcionalidade_codigo) do update set permitido=excluded.permitido;

insert into public.oricse_permissoes(codigo,nome,grupo,descricao,funcionalidade_codigo,ordem,ativo) values
('crm.campanhas','Publicar campanhas','CRM','Segmentar tutores e publicar campanhas.','crm.360',78,true),
('crm.automacoes','Gerenciar automações CRM','CRM','Gerenciar segmentos e automações de relacionamento.','crm.360',79,true)
on conflict (codigo) do update set nome=excluded.nome,grupo=excluded.grupo,descricao=excluded.descricao,funcionalidade_codigo=excluded.funcionalidade_codigo,ordem=excluded.ordem,ativo=true;

insert into public.oricse_permissoes_papel(papel,permissao_codigo,permitido)
select papel,permissao_codigo,permitido from (values
('responsavel','crm.campanhas',true),('admin_clinica','crm.campanhas',true),('rt','crm.campanhas',true),
('responsavel','crm.automacoes',true),('admin_clinica','crm.automacoes',true),('rt','crm.automacoes',true)
) p(papel,permissao_codigo,permitido)
on conflict (papel,permissao_codigo) do update set permitido=excluded.permitido;

create table if not exists public.oricse_crm_segmentos (
  id uuid primary key default gen_random_uuid(), clinica_id uuid not null references public.clinicas(id) on delete cascade,
  nome text not null, descricao text not null default '', cor text not null default '#6F293B',
  regras jsonb not null default '{}'::jsonb, ativo boolean not null default true,
  criado_por uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.oricse_crm_campanhas (
  id uuid primary key default gen_random_uuid(), clinica_id uuid not null references public.clinicas(id) on delete cascade,
  segmento_id uuid references public.oricse_crm_segmentos(id) on delete set null,
  nome text not null, objetivo text not null default 'relacionamento', assunto text not null default '', mensagem text not null,
  canal text not null default 'whatsapp' check (canal in ('whatsapp','email','manual')),
  status text not null default 'rascunho', agendada_para timestamptz, audiencia_estimada integer not null default 0,
  enviados integer not null default 0, metadados jsonb not null default '{}'::jsonb,
  criado_por uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.oricse_crm_tarefas (
  id uuid primary key default gen_random_uuid(), clinica_id uuid not null references public.clinicas(id) on delete cascade,
  tutor_id uuid references public.tutores(id) on delete set null, animal_id uuid references public.oricse_animais(id) on delete set null,
  campanha_id uuid references public.oricse_crm_campanhas(id) on delete set null,
  titulo text not null, descricao text not null default '', prioridade text not null default 'normal',
  status text not null default 'aberta', vencimento_em timestamptz, responsavel_id uuid references auth.users(id) on delete set null,
  criado_por uuid references auth.users(id) on delete set null, concluida_em timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.oricse_crm_portal_notificacoes (
  id uuid primary key default gen_random_uuid(), clinica_id uuid not null references public.clinicas(id) on delete cascade,
  tutor_id uuid not null references public.tutores(id) on delete cascade, animal_id uuid not null references public.oricse_animais(id) on delete cascade,
  evento_id uuid references public.oricse_crm_eventos(id) on delete set null,
  origem_tipo text not null, origem_id uuid not null, titulo text not null, portal_url text not null,
  created_at timestamptz not null default now(), unique(origem_tipo,origem_id)
);
alter table public.oricse_crm_eventos add column if not exists campanha_id uuid references public.oricse_crm_campanhas(id) on delete set null;
alter table public.oricse_crm_eventos drop constraint if exists oricse_crm_eventos_tipo_check;
alter table public.oricse_crm_eventos add constraint oricse_crm_eventos_tipo_check check (tipo in (
'aniversario','vacina','lembrete_consulta','retorno','pos_cirurgico','inativo','campanha','resultado_exame','documento_portal','receita_portal','cobranca','hotelzinho','banho_tosa','pesquisa_satisfacao'
));
create index if not exists oricse_crm_campanhas_clinica_idx on public.oricse_crm_campanhas(clinica_id,created_at desc);
create index if not exists oricse_crm_tarefas_clinica_idx on public.oricse_crm_tarefas(clinica_id,status,vencimento_em);
create index if not exists oricse_crm_eventos_campanha_idx on public.oricse_crm_eventos(campanha_id,status);

alter table public.oricse_crm_segmentos enable row level security;
alter table public.oricse_crm_campanhas enable row level security;
alter table public.oricse_crm_tarefas enable row level security;
alter table public.oricse_crm_portal_notificacoes enable row level security;
drop policy if exists crm_segmentos_ler on public.oricse_crm_segmentos;
create policy crm_segmentos_ler on public.oricse_crm_segmentos for select to authenticated using (public.oricse_usuario_pode_permissao(clinica_id,'crm.visualizar') or public.oricse_usuario_pode_permissao(clinica_id,'crm.enviar') or public.oricse_usuario_pode_permissao(clinica_id,'crm.gerenciar'));
drop policy if exists crm_segmentos_gerenciar on public.oricse_crm_segmentos;
create policy crm_segmentos_gerenciar on public.oricse_crm_segmentos for all to authenticated using (public.oricse_usuario_pode_permissao(clinica_id,'crm.automacoes') or public.oricse_usuario_pode_permissao(clinica_id,'crm.gerenciar')) with check (public.oricse_usuario_pode_permissao(clinica_id,'crm.automacoes') or public.oricse_usuario_pode_permissao(clinica_id,'crm.gerenciar'));
drop policy if exists crm_campanhas_ler on public.oricse_crm_campanhas;
create policy crm_campanhas_ler on public.oricse_crm_campanhas for select to authenticated using (public.oricse_usuario_pode_permissao(clinica_id,'crm.visualizar') or public.oricse_usuario_pode_permissao(clinica_id,'crm.enviar') or public.oricse_usuario_pode_permissao(clinica_id,'crm.gerenciar'));
drop policy if exists crm_campanhas_operar on public.oricse_crm_campanhas;
create policy crm_campanhas_operar on public.oricse_crm_campanhas for all to authenticated using (public.oricse_usuario_pode_permissao(clinica_id,'crm.campanhas') or public.oricse_usuario_pode_permissao(clinica_id,'crm.gerenciar')) with check (public.oricse_usuario_pode_permissao(clinica_id,'crm.campanhas') or public.oricse_usuario_pode_permissao(clinica_id,'crm.gerenciar'));
drop policy if exists crm_tarefas_ler on public.oricse_crm_tarefas;
create policy crm_tarefas_ler on public.oricse_crm_tarefas for select to authenticated using (public.oricse_usuario_pode_permissao(clinica_id,'crm.visualizar') or public.oricse_usuario_pode_permissao(clinica_id,'crm.enviar') or public.oricse_usuario_pode_permissao(clinica_id,'crm.gerenciar'));
drop policy if exists crm_tarefas_operar on public.oricse_crm_tarefas;
create policy crm_tarefas_operar on public.oricse_crm_tarefas for all to authenticated using (public.oricse_usuario_pode_permissao(clinica_id,'crm.enviar') or public.oricse_usuario_pode_permissao(clinica_id,'crm.gerenciar')) with check (public.oricse_usuario_pode_permissao(clinica_id,'crm.enviar') or public.oricse_usuario_pode_permissao(clinica_id,'crm.gerenciar'));
drop policy if exists crm_portal_notificacoes_ler on public.oricse_crm_portal_notificacoes;
create policy crm_portal_notificacoes_ler on public.oricse_crm_portal_notificacoes for select to authenticated using (public.oricse_usuario_pode_permissao(clinica_id,'crm.visualizar') or public.oricse_usuario_pode_permissao(clinica_id,'crm.enviar') or public.oricse_usuario_pode_permissao(clinica_id,'crm.gerenciar'));

create or replace function public.oricse_crm_campanha_publicar(p_campanha_id uuid,p_destinatarios jsonb)
returns integer language plpgsql security definer set search_path=''
as $$
declare
  v_campanha public.oricse_crm_campanhas%rowtype; v_item jsonb; v_tutor_id uuid; v_animal_id uuid;
  v_nome text; v_animal text; v_telefone text; v_email text; v_canal text; v_titulo text; v_mensagem text; v_count integer:=0;
begin
  select * into v_campanha from public.oricse_crm_campanhas where id=p_campanha_id;
  if not found then raise exception 'Campanha não encontrada.' using errcode='P0002'; end if;
  if not (public.oricse_usuario_pode_permissao(v_campanha.clinica_id,'crm.campanhas') or public.oricse_usuario_pode_permissao(v_campanha.clinica_id,'crm.gerenciar')) then raise exception 'Sem permissão para publicar campanhas desta clínica.' using errcode='42501'; end if;
  if jsonb_typeof(coalesce(p_destinatarios,'[]'::jsonb)) <> 'array' then raise exception 'Destinatários inválidos.' using errcode='22023'; end if;
  for v_item in select value from jsonb_array_elements(p_destinatarios) loop
    begin v_tutor_id:=nullif(v_item->>'tutor_id','')::uuid; v_animal_id:=nullif(v_item->>'animal_id','')::uuid; exception when invalid_text_representation then continue; end;
    v_nome:=coalesce(nullif(v_item->>'nome',''),'Tutor'); v_animal:=coalesce(v_item->>'animal_nome',''); v_telefone:=coalesce(v_item->>'telefone',''); v_email:=coalesce(v_item->>'email',''); v_canal:=v_campanha.canal;
    if v_canal='whatsapp' and v_telefone='' then v_canal:=case when v_email<>'' then 'email' else 'manual' end;
    elsif v_canal='email' and v_email='' then v_canal:=case when v_telefone<>'' then 'whatsapp' else 'manual' end; end if;
    v_titulo:=replace(replace(v_campanha.assunto,'{{tutor}}',v_nome),'{{animal}}',v_animal);
    v_mensagem:=replace(replace(replace(v_campanha.mensagem,'{{tutor}}',v_nome),'{{animal}}',v_animal),'{{clinica}}',coalesce((select nome from public.clinicas where id=v_campanha.clinica_id),'Clínica'));
    insert into public.oricse_crm_eventos(clinica_id,campanha_id,tutor_id,tutor_ref_local,destinatario_nome,telefone,email,animal_nome,tipo,titulo,mensagem,canal,agendado_para,status,origem,chave_dedupe,metadados)
    values(v_campanha.clinica_id,v_campanha.id,v_tutor_id,v_tutor_id::text,v_nome,v_telefone,v_email,v_animal,'campanha',coalesce(nullif(v_titulo,''),v_campanha.nome),v_mensagem,v_canal,coalesce(v_campanha.agendada_para,now()),'pendente','manual','campanha:'||v_campanha.id::text||':'||v_tutor_id::text,jsonb_build_object('campanha_id',v_campanha.id,'objetivo',v_campanha.objetivo))
    on conflict(clinica_id,chave_dedupe) do nothing;
    if found then v_count:=v_count+1; end if;
  end loop;
  update public.oricse_crm_campanhas set status=case when agendada_para is not null and agendada_para>now() then 'agendada' else 'pronta' end,audiencia_estimada=jsonb_array_length(p_destinatarios),updated_at=now() where id=v_campanha.id;
  return v_count;
end; $$;
revoke all on function public.oricse_crm_campanha_publicar(uuid,jsonb) from public;
grant execute on function public.oricse_crm_campanha_publicar(uuid,jsonb) to authenticated;

create or replace function public.oricse_crm_notificar_portal_conteudo()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_tipo text; v_secao text; v_evento_tipo text; v_tutor public.tutores%rowtype; v_animal_nome text; v_clinica_slug text; v_titulo text; v_url text; v_evento_id uuid; v_canal text;
begin
  if not new.visivel_tutor then return new; end if;
  if tg_op='UPDATE' and old.visivel_tutor is not distinct from new.visivel_tutor and old.titulo is not distinct from new.titulo and old.drive_arquivo_id is not distinct from new.drive_arquivo_id then return new; end if;
  v_tipo:=case tg_table_name when 'oricse_portal_exames' then 'exame' when 'oricse_portal_documentos' then 'documento' else 'receita' end;
  v_secao:=case v_tipo when 'exame' then 'exames' when 'documento' then 'documentos' else 'receitas' end;
  v_evento_tipo:=case v_tipo when 'exame' then 'resultado_exame' when 'documento' then 'documento_portal' else 'receita_portal' end;
  select t.* into v_tutor from public.tutores t join public.oricse_animais a on a.tutor_id=t.id and a.clinica_id=t.clinica_id where a.id=new.animal_id and a.clinica_id=new.clinica_id;
  if not found then return new; end if;
  select a.nome,c.slug into v_animal_nome,v_clinica_slug from public.oricse_animais a join public.clinicas c on c.id=a.clinica_id where a.id=new.animal_id and a.clinica_id=new.clinica_id;
  v_titulo:=new.titulo; v_url:='https://oricse.vetericio.workers.dev/pet/'||coalesce(v_clinica_slug,'')||'/portal?secao='||v_secao||'&animal='||new.animal_id::text;
  v_canal:=case when coalesce(v_tutor.telefone,v_tutor.outro_telefone,'')<>'' then 'whatsapp' when coalesce(v_tutor.email,'')<>'' then 'email' else 'manual' end;
  insert into public.oricse_crm_eventos(clinica_id,tutor_id,tutor_ref_local,destinatario_nome,telefone,email,animal_nome,tipo,titulo,mensagem,canal,agendado_para,status,origem,chave_dedupe,metadados)
  values(new.clinica_id,v_tutor.id,v_tutor.id::text,v_tutor.nome,coalesce(v_tutor.telefone,v_tutor.outro_telefone,''),coalesce(v_tutor.email,''),coalesce(v_animal_nome,'seu pet'),v_evento_tipo,'Novo conteúdo no Portal do Tutor','Olá, '||v_tutor.nome||'! O '||case when v_tipo='exame' then 'resultado de ' else '' end||v_titulo||' de '||coalesce(v_animal_nome,'seu pet')||' já está disponível no Portal do Tutor. Acesse com segurança: '||v_url,v_canal,now(),'pendente','automatico','portal:'||v_tipo||':'||new.id::text,jsonb_build_object('portal_url',v_url,'origem_tipo',v_tipo,'origem_id',new.id))
  on conflict(clinica_id,chave_dedupe) do update set titulo=excluded.titulo,mensagem=excluded.mensagem,telefone=excluded.telefone,email=excluded.email,canal=excluded.canal,updated_at=now() returning id into v_evento_id;
  insert into public.oricse_crm_portal_notificacoes(clinica_id,tutor_id,animal_id,evento_id,origem_tipo,origem_id,titulo,portal_url) values(new.clinica_id,v_tutor.id,new.animal_id,v_evento_id,v_tipo,new.id,v_titulo,v_url) on conflict(origem_tipo,origem_id) do update set evento_id=excluded.evento_id,titulo=excluded.titulo,portal_url=excluded.portal_url;
  return new;
end; $$;
revoke all on function public.oricse_crm_notificar_portal_conteudo() from public;
drop trigger if exists oricse_crm_notificar_exame_portal on public.oricse_portal_exames;
create trigger oricse_crm_notificar_exame_portal after insert or update on public.oricse_portal_exames for each row execute function public.oricse_crm_notificar_portal_conteudo();
drop trigger if exists oricse_crm_notificar_documento_portal on public.oricse_portal_documentos;
create trigger oricse_crm_notificar_documento_portal after insert or update on public.oricse_portal_documentos for each row execute function public.oricse_crm_notificar_portal_conteudo();
drop trigger if exists oricse_crm_notificar_receita_portal on public.oricse_portal_receitas;
create trigger oricse_crm_notificar_receita_portal after insert or update on public.oricse_portal_receitas for each row execute function public.oricse_crm_notificar_portal_conteudo();

revoke all on table public.oricse_crm_segmentos,public.oricse_crm_campanhas,public.oricse_crm_tarefas,public.oricse_crm_portal_notificacoes from anon;
grant select,insert,update,delete on table public.oricse_crm_segmentos,public.oricse_crm_campanhas,public.oricse_crm_tarefas,public.oricse_crm_portal_notificacoes to authenticated;
