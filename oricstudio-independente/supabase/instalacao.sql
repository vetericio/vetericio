-- Instalação completa do banco do Gestor de Contas Instagram num projeto Supabase próprio.
-- Como usar: Supabase → SQL Editor → New query → cole este arquivo inteiro → Run. Rode uma única vez.
-- Gerado a partir de drizzle/migrations 0000 a 0004 do Gestor original. O endereço do site não fica
-- fixo aqui: ele é lido do Vault (segredo site_url), gravado no passo final do guia docs/migrar-supabase.md.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;


-- ===== 0000_fundacao_gestor_instagram =====

CREATE TYPE public.app_role AS ENUM ('admin','editor','viewer');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.can_edit(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','editor'))
$$;

CREATE POLICY "own roles or admin" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- updated_at helper
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- OAuth states
CREATE TABLE public.oauth_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  state_hash text NOT NULL UNIQUE,
  provider text NOT NULL DEFAULT 'facebook' CHECK(provider IN ('facebook','instagram')),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.oauth_states TO service_role;
ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;

-- Meta connections
CREATE TABLE public.meta_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_user_id text NOT NULL UNIQUE,
  meta_user_name text,
  login_provider text NOT NULL DEFAULT 'facebook' CHECK(login_provider IN ('facebook','instagram')),
  connected_by uuid,
  status text NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa','token_expirado','permissao_insuficiente','revogada','erro','desconectada')),
  escopos_concedidos text[] NOT NULL DEFAULT '{}',
  escopos_recusados text[] NOT NULL DEFAULT '{}',
  expira_em timestamptz,
  ultima_verificacao timestamptz,
  ultimo_erro text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.meta_connections TO authenticated;
GRANT ALL ON public.meta_connections TO service_role;
ALTER TABLE public.meta_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read connections" ON public.meta_connections FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE TRIGGER t_meta_connections BEFORE UPDATE ON public.meta_connections FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Tokens: service role only
CREATE TABLE public.meta_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.meta_connections(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('user','page')),
  page_id text,
  token_criptografado text NOT NULL,
  iv text NOT NULL,
  expira_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connection_id, tipo, page_id)
);
REVOKE ALL ON public.meta_tokens FROM anon, authenticated;
GRANT ALL ON public.meta_tokens TO service_role;
ALTER TABLE public.meta_tokens ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.facebook_pages (
  id text PRIMARY KEY,
  nome text,
  connection_id uuid NOT NULL REFERENCES public.meta_connections(id) ON DELETE CASCADE,
  origem text NOT NULL DEFAULT 'me_accounts',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.facebook_pages TO authenticated;
GRANT ALL ON public.facebook_pages TO service_role;
ALTER TABLE public.facebook_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read pages" ON public.facebook_pages FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));

CREATE TABLE public.instagram_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ig_user_id text NOT NULL UNIQUE,
  username text,
  nome text,
  foto_url text,
  seguidores integer,
  page_id text REFERENCES public.facebook_pages(id) ON DELETE SET NULL,
  connection_id uuid REFERENCES public.meta_connections(id) ON DELETE SET NULL,
  gerenciada boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'ativa',
  permissoes_efetivas text[] NOT NULL DEFAULT '{}',
  ultimo_erro text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.instagram_accounts TO authenticated;
GRANT ALL ON public.instagram_accounts TO service_role;
ALTER TABLE public.instagram_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read ig" ON public.instagram_accounts FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY "admin update ig" ON public.instagram_accounts FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER t_ig BEFORE UPDATE ON public.instagram_accounts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instagram_account_id uuid NOT NULL UNIQUE REFERENCES public.instagram_accounts(id) ON DELETE CASCADE,
  nome_marca text NOT NULL,
  descricao text,
  publico_alvo text,
  tom_de_voz text,
  objetivos text,
  frequencia_semanal integer CHECK (frequencia_semanal BETWEEN 0 AND 50),
  temas_proibidos text,
  hashtags_padrao text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brands TO authenticated;
GRANT ALL ON public.brands TO service_role;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read brands" ON public.brands FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY "editors write brands" ON public.brands FOR ALL TO authenticated USING (public.can_edit(auth.uid())) WITH CHECK (public.can_edit(auth.uid()));
CREATE TRIGGER t_brands BEFORE UPDATE ON public.brands FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Future phases
CREATE TABLE public.media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instagram_account_id uuid REFERENCES public.instagram_accounts(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('imagem','video')),
  largura integer, altura integer, duracao_s numeric,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instagram_account_id uuid NOT NULL REFERENCES public.instagram_accounts(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','aguardando_aprovacao','agendado','processando','publicado','falhou','resultado_desconhecido')),
  tipo text NOT NULL DEFAULT 'feed',
  legenda text,
  media_asset_ids uuid[] NOT NULL DEFAULT '{}',
  agendado_para timestamptz,
  publicado_em timestamptz,
  ig_media_id text,
  idempotency_key text NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.publish_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  tentativas integer NOT NULL DEFAULT 0,
  locked_at timestamptz,
  locked_by text,
  proxima_tentativa timestamptz,
  ultimo_erro text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.post_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  versao integer NOT NULL,
  legenda text,
  media_asset_ids uuid[] NOT NULL DEFAULT '{}',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, versao)
);

CREATE TABLE public.metric_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instagram_account_id uuid NOT NULL REFERENCES public.instagram_accounts(id) ON DELETE CASCADE,
  post_id uuid REFERENCES public.posts(id) ON DELETE CASCADE,
  metrica text NOT NULL,
  valor numeric,
  periodo text,
  coletado_em timestamptz NOT NULL DEFAULT now(),
  origem text NOT NULL DEFAULT 'graph_api'
);

CREATE TABLE public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instagram_account_id uuid NOT NULL REFERENCES public.instagram_accounts(id) ON DELETE CASCADE,
  ig_comment_id text NOT NULL UNIQUE,
  ig_media_id text,
  autor text,
  texto text,
  publicado_em timestamptz,
  respondido boolean NOT NULL DEFAULT false,
  oculto boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.automation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instagram_account_id uuid REFERENCES public.instagram_accounts(id) ON DELETE CASCADE,
  nome text NOT NULL,
  gatilho jsonb NOT NULL DEFAULT '{}',
  acao jsonb NOT NULL DEFAULT '{}',
  ativa boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instagram_account_id uuid REFERENCES public.instagram_accounts(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  severidade text NOT NULL DEFAULT 'info',
  mensagem text NOT NULL,
  resolvido boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instagram_account_id uuid REFERENCES public.instagram_accounts(id) ON DELETE CASCADE,
  periodo_inicio date, periodo_fim date,
  conteudo jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['media_assets','posts','publish_jobs','post_versions','metric_snapshots','comments','automation_rules','alerts','reports'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "members read" ON public.%I FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()))', t);
    EXECUTE format('CREATE POLICY "editors write" ON public.%I FOR ALL TO authenticated USING (public.can_edit(auth.uid())) WITH CHECK (public.can_edit(auth.uid()))', t);
  END LOOP;
END $$;

-- Settings (singleton)
CREATE TABLE public.app_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  pausa_geral boolean NOT NULL DEFAULT false,
  modo_autonomia text NOT NULL DEFAULT 'assistido' CHECK (modo_autonomia IN ('assistido','automatico_regras','gestao_ampliada')),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.app_settings (id) VALUES (true);
GRANT SELECT, UPDATE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read settings" ON public.app_settings FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY "admin update settings" ON public.app_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Audit log
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  user_email text,
  acao text NOT NULL,
  alvo text,
  resultado text NOT NULL DEFAULT 'sucesso',
  detalhes jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_created_idx ON public.audit_log (created_at DESC);
GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read audit" ON public.audit_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- Data deletion requests (public status lookup by code via server)
CREATE TABLE public.data_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  confirmation_code text NOT NULL UNIQUE,
  meta_user_id text NOT NULL,
  status text NOT NULL DEFAULT 'recebida' CHECK (status IN ('recebida','concluida','erro')),
  detalhes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  concluida_em timestamptz
);
GRANT ALL ON public.data_deletion_requests TO service_role;
ALTER TABLE public.data_deletion_requests ENABLE ROW LEVEL SECURITY;


-- ===== 0001_fase2_publicacao =====
-- Fase 2: publicação e agendamento.
-- Aplicada no banco do Lovable Cloud via SQL; este arquivo é o registro versionado.

-- Posts: estado da fila e da publicação na Meta
ALTER TABLE public.posts
  ALTER COLUMN tipo SET DEFAULT 'imagem',
  ADD COLUMN IF NOT EXISTS titulo text,
  ADD COLUMN IF NOT EXISTS campanha text,
  ADD COLUMN IF NOT EXISTS alt_text text,
  ADD COLUMN IF NOT EXISTS capa_asset_id uuid REFERENCES public.media_assets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS share_to_feed boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS container_id text,
  ADD COLUMN IF NOT EXISTS children_container_ids text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS etapa text,
  ADD COLUMN IF NOT EXISTS tentativas integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS proxima_tentativa timestamptz,
  ADD COLUMN IF NOT EXISTS locked_until timestamptz,
  ADD COLUMN IF NOT EXISTS publish_attempted_at timestamptz,
  ADD COLUMN IF NOT EXISTS ultimo_erro text,
  ADD COLUMN IF NOT EXISTS permalink text,
  ADD COLUMN IF NOT EXISTS aprovado_por uuid,
  ADD COLUMN IF NOT EXISTS aprovado_em timestamptz;

UPDATE public.posts SET tipo = 'imagem' WHERE tipo = 'feed';
ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_tipo_check;
ALTER TABLE public.posts ADD CONSTRAINT posts_tipo_check CHECK (tipo IN ('imagem','carrossel','reels','story'));

CREATE INDEX IF NOT EXISTS posts_fila_idx ON public.posts (status, agendado_para);
CREATE INDEX IF NOT EXISTS posts_conta_idx ON public.posts (instagram_account_id, agendado_para);

DROP TRIGGER IF EXISTS t_posts ON public.posts;
CREATE TRIGGER t_posts BEFORE UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Mídias: arquivo público no Storage
ALTER TABLE public.media_assets
  ADD COLUMN IF NOT EXISTS public_url text,
  ADD COLUMN IF NOT EXISTS mime text,
  ADD COLUMN IF NOT EXISTS tamanho_bytes bigint,
  ADD COLUMN IF NOT EXISTS nome_original text;

-- Registro de cada passo da publicação (tentativas, erros, confirmações)
CREATE TABLE IF NOT EXISTS public.post_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  etapa text NOT NULL,
  resultado text NOT NULL,
  detalhe text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS post_events_post_idx ON public.post_events (post_id, created_at DESC);
GRANT SELECT ON public.post_events TO authenticated;
GRANT ALL ON public.post_events TO service_role;
ALTER TABLE public.post_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "members read" ON public.post_events;
CREATE POLICY "members read" ON public.post_events FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));

-- Escrita em posts, versões, jobs e mídias só pelo servidor (que valida papel, aprovação e pausa)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['posts','post_versions','publish_jobs','media_assets'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "editors write" ON public.%I', t);
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON public.%I FROM authenticated', t);
  END LOOP;
END $$;

-- Reserva atômica dos posts vencidos (sem duplicidade entre execuções simultâneas)
CREATE OR REPLACE FUNCTION public.claim_due_posts(_limit integer DEFAULT 3, _lease_seconds integer DEFAULT 120)
RETURNS SETOF public.posts LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.posts p
     SET locked_until = now() + make_interval(secs => _lease_seconds),
         status = CASE WHEN p.status = 'agendado' THEN 'processando' ELSE p.status END
   WHERE p.id IN (
     SELECT id FROM public.posts
      WHERE status IN ('agendado','processando','resultado_desconhecido')
        AND agendado_para <= now()
        AND (proxima_tentativa IS NULL OR proxima_tentativa <= now())
        AND (locked_until IS NULL OR locked_until < now())
      ORDER BY agendado_para
      LIMIT _limit
      FOR UPDATE SKIP LOCKED)
  RETURNING p.*;
$$;
REVOKE ALL ON FUNCTION public.claim_due_posts(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_due_posts(integer, integer) TO service_role;

-- Storage público para as mídias (a Meta busca os arquivos por URL pública)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('midia', 'midia', true, 314572800, ARRAY['image/jpeg','video/mp4','video/quicktime'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "midia editors upload" ON storage.objects;
CREATE POLICY "midia editors upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'midia' AND public.can_edit(auth.uid()));

-- Token dos jobs agendados: gerado e guardado no Vault, nunca sai do banco em texto
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'jobs_token') THEN
    PERFORM vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'jobs_token', 'Bearer dos jobs pg_cron');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.verify_jobs_token(_token text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, vault AS $$
  SELECT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'jobs_token' AND decrypted_secret = _token);
$$;
REVOKE ALL ON FUNCTION public.verify_jobs_token(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_jobs_token(text) TO service_role;

-- Agendador no servidor: fila a cada minuto, verificação de conexões todo dia às 9h (Brasília)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.call_job(_path text)
RETURNS bigint LANGUAGE sql SECURITY DEFINER SET search_path = public, vault, net AS $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'site_url') || _path,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'jobs_token')),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000);
$$;
REVOKE ALL ON FUNCTION public.call_job(text) FROM PUBLIC, anon, authenticated;

SELECT cron.schedule('fila-publicacao', '* * * * *', $$SELECT public.call_job('/api/public/jobs/publish-queue')$$);
SELECT cron.schedule('verificacao-conexoes', '0 12 * * *', $$SELECT public.call_job('/api/public/jobs/meta-connection-check')$$);

-- Chaves do assistente local (só o hash SHA-256 fica no banco; a chave fica no computador do dono)
CREATE TABLE IF NOT EXISTS public.assistant_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  ultimo_uso timestamptz,
  revogada_em timestamptz
);
REVOKE ALL ON public.assistant_keys FROM anon, authenticated;
GRANT ALL ON public.assistant_keys TO service_role;
ALTER TABLE public.assistant_keys ENABLE ROW LEVEL SECURITY;
GRANT SELECT (id, nome, created_at, ultimo_uso, revogada_em) ON public.assistant_keys TO authenticated;
CREATE POLICY "admin read keys" ON public.assistant_keys FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));


-- ===== 0002_metricas_comunidade_alertas =====
-- Fases 5, 7 e 8: métricas, relatórios, calendário, alertas, regras de automação e comentários.
-- Aplicada no banco do Lovable Cloud via SQL; este arquivo é o registro versionado.

-- Mídias da conta (inclusive as publicadas fora do sistema), com as últimas métricas
CREATE TABLE IF NOT EXISTS public.ig_media (
  ig_media_id text PRIMARY KEY,
  instagram_account_id uuid NOT NULL REFERENCES public.instagram_accounts(id) ON DELETE CASCADE,
  post_id uuid REFERENCES public.posts(id) ON DELETE SET NULL,
  media_type text,
  media_product_type text,
  caption text,
  permalink text,
  thumbnail_url text,
  publicado_em timestamptz,
  like_count integer,
  comments_count integer,
  insights jsonb NOT NULL DEFAULT '{}',
  insights_em timestamptz,
  insights_erro text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ig_media_conta_idx ON public.ig_media (instagram_account_id, publicado_em DESC);

-- Séries históricas: métricas diárias da conta e evolução de cada mídia
ALTER TABLE public.metric_snapshots
  ADD COLUMN IF NOT EXISTS ig_media_id text,
  ADD COLUMN IF NOT EXISTS dia date;
CREATE UNIQUE INDEX IF NOT EXISTS metric_snapshots_conta_dia_uidx
  ON public.metric_snapshots (instagram_account_id, metrica, dia) WHERE ig_media_id IS NULL AND dia IS NOT NULL;
CREATE INDEX IF NOT EXISTS metric_snapshots_media_idx ON public.metric_snapshots (ig_media_id, coletado_em);

-- Relatórios
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'semanal',
  ADD COLUMN IF NOT EXISTS gerado_em timestamptz NOT NULL DEFAULT now();
CREATE UNIQUE INDEX IF NOT EXISTS reports_unico_idx
  ON public.reports (tipo, periodo_inicio, coalesce(instagram_account_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- Alertas sem duplicidade: um alerta aberto por (conta, tipo, chave)
ALTER TABLE public.alerts
  ADD COLUMN IF NOT EXISTS chave text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS resolvido_em timestamptz,
  ADD COLUMN IF NOT EXISTS detalhe jsonb NOT NULL DEFAULT '{}';
CREATE UNIQUE INDEX IF NOT EXISTS alerts_aberto_uidx
  ON public.alerts (coalesce(instagram_account_id, '00000000-0000-0000-0000-000000000000'::uuid), tipo, chave) WHERE NOT resolvido;

-- Limites de alerta e contato usado nas respostas a comentários, por marca
ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS contato_resposta text,
  ADD COLUMN IF NOT EXISTS limites_alerta jsonb NOT NULL DEFAULT '{}';

-- Batimento do agendador (para alertar se a fila parar)
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS ultimo_ciclo_fila timestamptz,
  ADD COLUMN IF NOT EXISTS ultimo_ciclo_coleta timestamptz;

-- Regras do modo automático, por conta
CREATE TABLE IF NOT EXISTS public.regras_publicacao (
  instagram_account_id uuid PRIMARY KEY REFERENCES public.instagram_accounts(id) ON DELETE CASCADE,
  ativa boolean NOT NULL DEFAULT true,
  formatos text[] NOT NULL DEFAULT '{imagem,carrossel,reels,story}',
  max_por_dia integer NOT NULL DEFAULT 3 CHECK (max_por_dia BETWEEN 0 AND 50),
  max_por_semana integer NOT NULL DEFAULT 10 CHECK (max_por_semana BETWEEN 0 AND 200),
  hora_inicio integer NOT NULL DEFAULT 8 CHECK (hora_inicio BETWEEN 0 AND 23),
  hora_fim integer NOT NULL DEFAULT 22 CHECK (hora_fim BETWEEN 1 AND 24),
  dias_semana integer[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}',
  palavras_proibidas text[] NOT NULL DEFAULT '{}',
  campanhas_com_aprovacao text[] NOT NULL DEFAULT '{}',
  suspender_apos_falhas integer NOT NULL DEFAULT 3 CHECK (suspender_apos_falhas BETWEEN 1 AND 20),
  suspensa_em timestamptz,
  motivo_suspensao text,
  respostas_automaticas boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Comentários: classificação, sugestão e resposta
ALTER TABLE public.comments
  ADD COLUMN IF NOT EXISTS parent_ig_comment_id text,
  ADD COLUMN IF NOT EXISTS like_count integer,
  ADD COLUMN IF NOT EXISTS categoria text NOT NULL DEFAULT 'outro',
  ADD COLUMN IF NOT EXISTS precisa_humano boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS motivo_humano text,
  ADD COLUMN IF NOT EXISTS resposta_sugerida text,
  ADD COLUMN IF NOT EXISTS resposta_enviada text,
  ADD COLUMN IF NOT EXISTS respondido_em timestamptz,
  ADD COLUMN IF NOT EXISTS respondido_por text,
  ADD COLUMN IF NOT EXISTS arquivado boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS comments_conta_idx ON public.comments (instagram_account_id, publicado_em DESC);

-- Leitura para membros; escrita só pelo servidor
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ig_media','regras_publicacao'] LOOP
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "members read" ON public.%I', t);
    EXECUTE format('CREATE POLICY "members read" ON public.%I FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()))', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['metric_snapshots','comments','alerts','reports','automation_rules'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "editors write" ON public.%I', t);
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON public.%I FROM authenticated', t);
  END LOOP;
END $$;

INSERT INTO public.regras_publicacao (instagram_account_id)
SELECT id FROM public.instagram_accounts ON CONFLICT DO NOTHING;

-- Origem da sugestão de resposta: 'modelo' (automática) ou 'assistente' (escrita pelo assistente com contexto)
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS sugestao_por text NOT NULL DEFAULT 'modelo';


-- ===== 0003_conector_mcp =====
-- Conector MCP (Claude) com OAuth 2.1 + PKCE. Só hashes de códigos e tokens ficam no banco.

CREATE TABLE IF NOT EXISTS public.oauth_clients (
  client_id text PRIMARY KEY,
  client_name text,
  redirect_uris text[] NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.oauth_codes (
  code_hash text PRIMARY KEY,
  client_id text NOT NULL REFERENCES public.oauth_clients(client_id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  redirect_uri text NOT NULL,
  code_challenge text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.oauth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL REFERENCES public.oauth_clients(client_id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  access_hash text NOT NULL UNIQUE,
  refresh_hash text UNIQUE,
  expires_at timestamptz NOT NULL,
  refresh_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  ultimo_uso timestamptz,
  revogado_em timestamptz
);
CREATE INDEX IF NOT EXISTS oauth_tokens_user_idx ON public.oauth_tokens (user_id);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['oauth_clients','oauth_codes','oauth_tokens'] LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- Painel: o admin vê as conexões ativas (sem hashes) para revogar
GRANT SELECT (id, client_id, user_id, created_at, ultimo_uso, revogado_em, expires_at, refresh_expires_at) ON public.oauth_tokens TO authenticated;
GRANT SELECT (client_id, client_name, created_at) ON public.oauth_clients TO authenticated;
DROP POLICY IF EXISTS "admin read tokens" ON public.oauth_tokens;
CREATE POLICY "admin read tokens" ON public.oauth_tokens FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "admin read clients" ON public.oauth_clients;
CREATE POLICY "admin read clients" ON public.oauth_clients FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- Biblioteca de mídias: leitura liberada para membros (escrita continua só pelo servidor)
DROP POLICY IF EXISTS "members read" ON public.media_assets;
CREATE POLICY "members read" ON public.media_assets FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));


-- ===== 0004_agendador_metricas_relatorios =====
-- Registra os jobs de métricas e relatórios (já criados em produção em 25/10/2026) e torna a criação
-- repetível. Instalações novas: troque o endereço em public.call_job (migração 0001) pelo do seu site.
DO $$
BEGIN
  PERFORM cron.unschedule(jobname) FROM cron.job WHERE jobname IN ('coleta-metricas', 'relatorios');
END $$;
SELECT cron.schedule('coleta-metricas', '5 * * * *', $$SELECT public.call_job('/api/public/jobs/collect-metrics')$$);
SELECT cron.schedule('relatorios', '10 12 * * *', $$SELECT public.call_job('/api/public/jobs/reports')$$);

