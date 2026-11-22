-- Gestão de clientes: retornos clínicos vinculados ao paciente.
-- A operação é somente via funções de servidor com permissão de clínica;
-- nenhuma autorização de leitura/gravação é concedida ao navegador.
begin;

create table if not exists public.oricse_crm_retornos (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id),
  animal_id uuid not null references public.oricse_animais(id),
  tutor_id uuid not null references public.tutores(id),
  origem text not null check (origem in ('consulta','vacina','vermifugo','exame','cirurgia','medicacao','manual','outro')),
  origem_id uuid,
  titulo text not null check (char_length(btrim(titulo)) between 3 and 180),
  orientacoes text not null default '',
  data_prevista date not null,
  status text not null default 'a_confirmar'
    check (status in ('a_confirmar','contatado','confirmado','reagendar','realizado','cancelado')),
  contato_em timestamptz,
  confirmado_em timestamptz,
  realizado_em timestamptz,
  anotacao_equipe text not null default '',
  criado_por uuid,
  atualizado_por uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_retorno_orientacoes_limite check (char_length(orientacoes) <= 2000),
  constraint crm_retorno_anotacao_limite check (char_length(anotacao_equipe) <= 2000)
);

create unique index if not exists oricse_crm_retorno_origem_unica
 on public.oricse_crm_retornos (clinica_id,origem,origem_id);
create index if not exists oricse_crm_retornos_clinica_data
 on public.oricse_crm_retornos (clinica_id,status,data_prevista);
create index if not exists oricse_crm_retornos_animal
 on public.oricse_crm_retornos (clinica_id,animal_id,created_at desc);

alter table public.oricse_crm_retornos enable row level security;
revoke all on public.oricse_crm_retornos from public, anon, authenticated;
grant select, insert, update on public.oricse_crm_retornos to service_role;

-- Exames não têm data de retorno atualmente; só criar lembrete se a
-- equipe informar explicitamente a data.
alter table public.oricse_portal_exames add column if not exists retorno_em date;
alter table public.oricse_portal_exames add column if not exists orientacoes_retorno text;

comment on table public.oricse_crm_retornos is
  'Retornos clínicos auditáveis por clínica; nenhum envio é disparado automaticamente.';
comment on column public.oricse_portal_exames.retorno_em is
  'Data indicada pelo profissional para reavaliação ou resultado do exame; opcional.';

-- O publicador antigo confiava no contato, na clínica e na autorização
-- declarados pelo navegador. Revalidar todos os campos no banco.
create or replace function public.oricse_crm_campanha_publicar(
  p_campanha_id uuid, p_destinatarios jsonb
) returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_campanha public.oricse_crm_campanhas%rowtype;
  v_tutor public.tutores%rowtype;
  v_item jsonb;
  v_tutor_id uuid;
  v_animal_id uuid;
  v_animal text;
  v_telefone text;
  v_email text;
  v_canal text;
  v_titulo text;
  v_mensagem text;
  v_count integer := 0;
begin
  if (select auth.uid()) is null then
    raise exception 'É necessário estar autenticado.' using errcode = '42501';
  end if;
  select * into v_campanha from public.oricse_crm_campanhas
    where id = p_campanha_id;
  if not found then raise exception 'Campanha não encontrada.'; end if;
  if not (
    public.oricse_usuario_pode_permissao(v_campanha.clinica_id,'crm.campanhas')
    or public.oricse_usuario_pode_permissao(v_campanha.clinica_id,'crm.gerenciar')
  ) then
    raise exception 'Sem permissão para publicar campanhas desta clínica.' using errcode='42501';
  end if;
  if v_campanha.status <> 'rascunho' then
    raise exception 'Esta campanha já foi publicada. Crie outra para um novo envio.';
  end if;
  if jsonb_typeof(p_destinatarios) <> 'array'
     or jsonb_array_length(p_destinatarios) > 5000 then
    raise exception 'Destinatários inválidos ou acima do limite.';
  end if;

  for v_item in select value from jsonb_array_elements(p_destinatarios)
  loop
    begin
      v_tutor_id := nullif(v_item->>'tutor_id','')::uuid;
      v_animal_id := nullif(v_item->>'animal_id','')::uuid;
    exception when invalid_text_representation then
      continue;
    end;
    if v_tutor_id is null then continue; end if;
    -- Nunca confiar no texto nem no telefone enviados pelo navegador.
    select * into v_tutor from public.tutores
      where id=v_tutor_id and clinica_id=v_campanha.clinica_id;
    if not found or lower(coalesce(v_tutor.dados->>'autorizaMarketing','false')) <> 'true'
    then continue; end if;

    v_telefone := case
      when lower(coalesce(v_tutor.dados->>'autorizaWhatsapp','false')) = 'true'
        then coalesce(v_tutor.telefone,v_tutor.outro_telefone,'')
      else '' end;
    v_email := case
      when lower(coalesce(v_tutor.dados->>'autorizaEmail','false')) = 'true'
        then coalesce(v_tutor.email,'')
      else '' end;
    if v_telefone='' and v_email='' then continue; end if;
    if v_campanha.canal='whatsapp' and v_telefone<>'' then
      v_canal := 'whatsapp';
    elsif v_campanha.canal='email' and v_email<>'' then
      v_canal := 'email';
    elsif v_telefone<>'' then
      v_canal := 'whatsapp';
    else
      v_canal := 'email';
    end if;
    v_animal := '';
    if v_animal_id is not null then
      select coalesce(nome,'') into v_animal from public.oricse_animais
        where id=v_animal_id and clinica_id=v_campanha.clinica_id
          and tutor_id=v_tutor.id;
      v_animal := coalesce(v_animal,'');
    end if;
    v_titulo := replace(replace(v_campanha.assunto,'{{tutor}}',v_tutor.nome),'{{animal}}',v_animal);
    v_mensagem := replace(replace(replace(v_campanha.mensagem,'{{tutor}}',v_tutor.nome),
      '{{animal}}',v_animal),'{{clinica}}',
      coalesce((select nome from public.clinicas where id=v_campanha.clinica_id),'Clínica'));

    insert into public.oricse_crm_eventos (
      clinica_id,campanha_id,tutor_id,tutor_ref_local,destinatario_nome,telefone,email,animal_nome,
      tipo,titulo,mensagem,canal,agendado_para,status,origem,chave_dedupe,metadados
    ) values (
      v_campanha.clinica_id,v_campanha.id,v_tutor.id,v_tutor.id::text,v_tutor.nome,
      v_telefone,v_email,v_animal,'campanha',
      coalesce(nullif(v_titulo,''),v_campanha.nome),v_mensagem,v_canal,
      coalesce(v_campanha.agendada_para,now()),'pendente','manual',
      'campanha:'||v_campanha.id::text||':'||v_tutor.id::text,
      jsonb_build_object('campanha_id',v_campanha.id,'objetivo',v_campanha.objetivo)
    ) on conflict (clinica_id,chave_dedupe) do nothing;
    if found then v_count := v_count + 1; end if;
  end loop;

  update public.oricse_crm_campanhas
    set status=case when agendada_para is not null and agendada_para>now()
      then 'agendada' else 'pronta' end,
      audiencia_estimada=v_count, updated_at=now()
    where id=v_campanha.id;
  return v_count;
end;
$$;
commit;
