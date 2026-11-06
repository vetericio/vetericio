export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      alerts: {
        Row: {
          chave: string
          created_at: string
          detalhe: Json
          id: string
          instagram_account_id: string | null
          mensagem: string
          resolvido: boolean
          resolvido_em: string | null
          severidade: string
          tipo: string
        }
        Insert: {
          chave?: string
          created_at?: string
          detalhe?: Json
          id?: string
          instagram_account_id?: string | null
          mensagem: string
          resolvido?: boolean
          resolvido_em?: string | null
          severidade?: string
          tipo: string
        }
        Update: {
          chave?: string
          created_at?: string
          detalhe?: Json
          id?: string
          instagram_account_id?: string | null
          mensagem?: string
          resolvido?: boolean
          resolvido_em?: string | null
          severidade?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_instagram_account_id_fkey"
            columns: ["instagram_account_id"]
            isOneToOne: false
            referencedRelation: "instagram_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          id: boolean
          modo_autonomia: string
          pausa_geral: boolean
          ultimo_ciclo_coleta: string | null
          ultimo_ciclo_fila: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: boolean
          modo_autonomia?: string
          pausa_geral?: boolean
          ultimo_ciclo_coleta?: string | null
          ultimo_ciclo_fila?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: boolean
          modo_autonomia?: string
          pausa_geral?: boolean
          ultimo_ciclo_coleta?: string | null
          ultimo_ciclo_fila?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      assistant_keys: {
        Row: {
          created_at: string
          id: string
          key_hash: string
          nome: string
          revogada_em: string | null
          ultimo_uso: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          key_hash: string
          nome: string
          revogada_em?: string | null
          ultimo_uso?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          key_hash?: string
          nome?: string
          revogada_em?: string | null
          ultimo_uso?: string | null
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          acao: string
          alvo: string | null
          created_at: string
          detalhes: Json
          id: string
          resultado: string
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          acao: string
          alvo?: string | null
          created_at?: string
          detalhes?: Json
          id?: string
          resultado?: string
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          acao?: string
          alvo?: string | null
          created_at?: string
          detalhes?: Json
          id?: string
          resultado?: string
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      automation_rules: {
        Row: {
          acao: Json
          ativa: boolean
          created_at: string
          gatilho: Json
          id: string
          instagram_account_id: string | null
          nome: string
        }
        Insert: {
          acao?: Json
          ativa?: boolean
          created_at?: string
          gatilho?: Json
          id?: string
          instagram_account_id?: string | null
          nome: string
        }
        Update: {
          acao?: Json
          ativa?: boolean
          created_at?: string
          gatilho?: Json
          id?: string
          instagram_account_id?: string | null
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_rules_instagram_account_id_fkey"
            columns: ["instagram_account_id"]
            isOneToOne: false
            referencedRelation: "instagram_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          contato_resposta: string | null
          created_at: string
          descricao: string | null
          frequencia_semanal: number | null
          hashtags_padrao: string[]
          id: string
          instagram_account_id: string
          limites_alerta: Json
          nome_marca: string
          objetivos: string | null
          publico_alvo: string | null
          temas_proibidos: string | null
          tom_de_voz: string | null
          updated_at: string
        }
        Insert: {
          contato_resposta?: string | null
          created_at?: string
          descricao?: string | null
          frequencia_semanal?: number | null
          hashtags_padrao?: string[]
          id?: string
          instagram_account_id: string
          limites_alerta?: Json
          nome_marca: string
          objetivos?: string | null
          publico_alvo?: string | null
          temas_proibidos?: string | null
          tom_de_voz?: string | null
          updated_at?: string
        }
        Update: {
          contato_resposta?: string | null
          created_at?: string
          descricao?: string | null
          frequencia_semanal?: number | null
          hashtags_padrao?: string[]
          id?: string
          instagram_account_id?: string
          limites_alerta?: Json
          nome_marca?: string
          objetivos?: string | null
          publico_alvo?: string | null
          temas_proibidos?: string | null
          tom_de_voz?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brands_instagram_account_id_fkey"
            columns: ["instagram_account_id"]
            isOneToOne: true
            referencedRelation: "instagram_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          arquivado: boolean
          autor: string | null
          categoria: string
          created_at: string
          id: string
          ig_comment_id: string
          ig_media_id: string | null
          instagram_account_id: string
          like_count: number | null
          motivo_humano: string | null
          oculto: boolean
          parent_ig_comment_id: string | null
          precisa_humano: boolean
          publicado_em: string | null
          respondido: boolean
          respondido_em: string | null
          respondido_por: string | null
          resposta_enviada: string | null
          resposta_sugerida: string | null
          sugestao_por: string
          texto: string | null
        }
        Insert: {
          arquivado?: boolean
          autor?: string | null
          categoria?: string
          created_at?: string
          id?: string
          ig_comment_id: string
          ig_media_id?: string | null
          instagram_account_id: string
          like_count?: number | null
          motivo_humano?: string | null
          oculto?: boolean
          parent_ig_comment_id?: string | null
          precisa_humano?: boolean
          publicado_em?: string | null
          respondido?: boolean
          respondido_em?: string | null
          respondido_por?: string | null
          resposta_enviada?: string | null
          resposta_sugerida?: string | null
          sugestao_por?: string
          texto?: string | null
        }
        Update: {
          arquivado?: boolean
          autor?: string | null
          categoria?: string
          created_at?: string
          id?: string
          ig_comment_id?: string
          ig_media_id?: string | null
          instagram_account_id?: string
          like_count?: number | null
          motivo_humano?: string | null
          oculto?: boolean
          parent_ig_comment_id?: string | null
          precisa_humano?: boolean
          publicado_em?: string | null
          respondido?: boolean
          respondido_em?: string | null
          respondido_por?: string | null
          resposta_enviada?: string | null
          resposta_sugerida?: string | null
          sugestao_por?: string
          texto?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comments_instagram_account_id_fkey"
            columns: ["instagram_account_id"]
            isOneToOne: false
            referencedRelation: "instagram_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      data_deletion_requests: {
        Row: {
          concluida_em: string | null
          confirmation_code: string
          created_at: string
          detalhes: string | null
          id: string
          meta_user_id: string
          status: string
        }
        Insert: {
          concluida_em?: string | null
          confirmation_code: string
          created_at?: string
          detalhes?: string | null
          id?: string
          meta_user_id: string
          status?: string
        }
        Update: {
          concluida_em?: string | null
          confirmation_code?: string
          created_at?: string
          detalhes?: string | null
          id?: string
          meta_user_id?: string
          status?: string
        }
        Relationships: []
      }
      facebook_pages: {
        Row: {
          connection_id: string
          created_at: string
          id: string
          nome: string | null
          origem: string
          updated_at: string
        }
        Insert: {
          connection_id: string
          created_at?: string
          id: string
          nome?: string | null
          origem?: string
          updated_at?: string
        }
        Update: {
          connection_id?: string
          created_at?: string
          id?: string
          nome?: string | null
          origem?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "facebook_pages_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "meta_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      ig_media: {
        Row: {
          caption: string | null
          comments_count: number | null
          ig_media_id: string
          insights: Json
          insights_em: string | null
          insights_erro: string | null
          instagram_account_id: string
          like_count: number | null
          media_product_type: string | null
          media_type: string | null
          permalink: string | null
          post_id: string | null
          publicado_em: string | null
          thumbnail_url: string | null
          updated_at: string
        }
        Insert: {
          caption?: string | null
          comments_count?: number | null
          ig_media_id: string
          insights?: Json
          insights_em?: string | null
          insights_erro?: string | null
          instagram_account_id: string
          like_count?: number | null
          media_product_type?: string | null
          media_type?: string | null
          permalink?: string | null
          post_id?: string | null
          publicado_em?: string | null
          thumbnail_url?: string | null
          updated_at?: string
        }
        Update: {
          caption?: string | null
          comments_count?: number | null
          ig_media_id?: string
          insights?: Json
          insights_em?: string | null
          insights_erro?: string | null
          instagram_account_id?: string
          like_count?: number | null
          media_product_type?: string | null
          media_type?: string | null
          permalink?: string | null
          post_id?: string | null
          publicado_em?: string | null
          thumbnail_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ig_media_instagram_account_id_fkey"
            columns: ["instagram_account_id"]
            isOneToOne: false
            referencedRelation: "instagram_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ig_media_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_accounts: {
        Row: {
          connection_id: string | null
          created_at: string
          foto_url: string | null
          gerenciada: boolean
          id: string
          ig_user_id: string
          nome: string | null
          page_id: string | null
          permissoes_efetivas: string[]
          seguidores: number | null
          status: string
          ultimo_erro: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          connection_id?: string | null
          created_at?: string
          foto_url?: string | null
          gerenciada?: boolean
          id?: string
          ig_user_id: string
          nome?: string | null
          page_id?: string | null
          permissoes_efetivas?: string[]
          seguidores?: number | null
          status?: string
          ultimo_erro?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          connection_id?: string | null
          created_at?: string
          foto_url?: string | null
          gerenciada?: boolean
          id?: string
          ig_user_id?: string
          nome?: string | null
          page_id?: string | null
          permissoes_efetivas?: string[]
          seguidores?: number | null
          status?: string
          ultimo_erro?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instagram_accounts_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "meta_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instagram_accounts_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "facebook_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      media_assets: {
        Row: {
          altura: number | null
          created_at: string
          created_by: string | null
          duracao_s: number | null
          id: string
          instagram_account_id: string | null
          largura: number | null
          mime: string | null
          nome_original: string | null
          public_url: string | null
          storage_path: string
          tamanho_bytes: number | null
          tipo: string
        }
        Insert: {
          altura?: number | null
          created_at?: string
          created_by?: string | null
          duracao_s?: number | null
          id?: string
          instagram_account_id?: string | null
          largura?: number | null
          mime?: string | null
          nome_original?: string | null
          public_url?: string | null
          storage_path: string
          tamanho_bytes?: number | null
          tipo: string
        }
        Update: {
          altura?: number | null
          created_at?: string
          created_by?: string | null
          duracao_s?: number | null
          id?: string
          instagram_account_id?: string | null
          largura?: number | null
          mime?: string | null
          nome_original?: string | null
          public_url?: string | null
          storage_path?: string
          tamanho_bytes?: number | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_assets_instagram_account_id_fkey"
            columns: ["instagram_account_id"]
            isOneToOne: false
            referencedRelation: "instagram_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_connections: {
        Row: {
          connected_by: string | null
          created_at: string
          escopos_concedidos: string[]
          escopos_recusados: string[]
          expira_em: string | null
          id: string
          meta_user_id: string
          meta_user_name: string | null
          login_provider: "facebook" | "instagram"
          status: string
          ultima_verificacao: string | null
          ultimo_erro: string | null
          updated_at: string
        }
        Insert: {
          connected_by?: string | null
          created_at?: string
          escopos_concedidos?: string[]
          escopos_recusados?: string[]
          expira_em?: string | null
          id?: string
          meta_user_id: string
          meta_user_name?: string | null
          login_provider?: "facebook" | "instagram"
          status?: string
          ultima_verificacao?: string | null
          ultimo_erro?: string | null
          updated_at?: string
        }
        Update: {
          connected_by?: string | null
          created_at?: string
          escopos_concedidos?: string[]
          escopos_recusados?: string[]
          expira_em?: string | null
          id?: string
          meta_user_id?: string
          meta_user_name?: string | null
          login_provider?: "facebook" | "instagram"
          status?: string
          ultima_verificacao?: string | null
          ultimo_erro?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      meta_tokens: {
        Row: {
          connection_id: string
          created_at: string
          expira_em: string | null
          id: string
          iv: string
          page_id: string | null
          tipo: string
          token_criptografado: string
        }
        Insert: {
          connection_id: string
          created_at?: string
          expira_em?: string | null
          id?: string
          iv: string
          page_id?: string | null
          tipo: string
          token_criptografado: string
        }
        Update: {
          connection_id?: string
          created_at?: string
          expira_em?: string | null
          id?: string
          iv?: string
          page_id?: string | null
          tipo?: string
          token_criptografado?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_tokens_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "meta_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      metric_snapshots: {
        Row: {
          coletado_em: string
          dia: string | null
          id: string
          ig_media_id: string | null
          instagram_account_id: string
          metrica: string
          origem: string
          periodo: string | null
          post_id: string | null
          valor: number | null
        }
        Insert: {
          coletado_em?: string
          dia?: string | null
          id?: string
          ig_media_id?: string | null
          instagram_account_id: string
          metrica: string
          origem?: string
          periodo?: string | null
          post_id?: string | null
          valor?: number | null
        }
        Update: {
          coletado_em?: string
          dia?: string | null
          id?: string
          ig_media_id?: string | null
          instagram_account_id?: string
          metrica?: string
          origem?: string
          periodo?: string | null
          post_id?: string | null
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "metric_snapshots_instagram_account_id_fkey"
            columns: ["instagram_account_id"]
            isOneToOne: false
            referencedRelation: "instagram_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metric_snapshots_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_clients: {
        Row: {
          client_id: string
          client_name: string | null
          created_at: string
          redirect_uris: string[]
        }
        Insert: {
          client_id: string
          client_name?: string | null
          created_at?: string
          redirect_uris: string[]
        }
        Update: {
          client_id?: string
          client_name?: string | null
          created_at?: string
          redirect_uris?: string[]
        }
        Relationships: []
      }
      oauth_codes: {
        Row: {
          client_id: string
          code_challenge: string
          code_hash: string
          expires_at: string
          redirect_uri: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          client_id: string
          code_challenge: string
          code_hash: string
          expires_at: string
          redirect_uri: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          client_id?: string
          code_challenge?: string
          code_hash?: string
          expires_at?: string
          redirect_uri?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oauth_codes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "oauth_clients"
            referencedColumns: ["client_id"]
          },
        ]
      }
      oauth_states: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          state_hash: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          state_hash: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          state_hash?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      oauth_tokens: {
        Row: {
          access_hash: string
          client_id: string
          created_at: string
          expires_at: string
          id: string
          refresh_expires_at: string | null
          refresh_hash: string | null
          revogado_em: string | null
          ultimo_uso: string | null
          user_id: string
        }
        Insert: {
          access_hash: string
          client_id: string
          created_at?: string
          expires_at: string
          id?: string
          refresh_expires_at?: string | null
          refresh_hash?: string | null
          revogado_em?: string | null
          ultimo_uso?: string | null
          user_id: string
        }
        Update: {
          access_hash?: string
          client_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          refresh_expires_at?: string | null
          refresh_hash?: string | null
          revogado_em?: string | null
          ultimo_uso?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oauth_tokens_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "oauth_clients"
            referencedColumns: ["client_id"]
          },
        ]
      }
      post_events: {
        Row: {
          created_at: string
          detalhe: string | null
          etapa: string
          id: string
          post_id: string
          resultado: string
        }
        Insert: {
          created_at?: string
          detalhe?: string | null
          etapa: string
          id?: string
          post_id: string
          resultado: string
        }
        Update: {
          created_at?: string
          detalhe?: string | null
          etapa?: string
          id?: string
          post_id?: string
          resultado?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_events_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_versions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          legenda: string | null
          media_asset_ids: string[]
          post_id: string
          versao: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          legenda?: string | null
          media_asset_ids?: string[]
          post_id: string
          versao: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          legenda?: string | null
          media_asset_ids?: string[]
          post_id?: string
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "post_versions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          agendado_para: string | null
          alt_text: string | null
          aprovado_em: string | null
          aprovado_por: string | null
          campanha: string | null
          capa_asset_id: string | null
          children_container_ids: string[]
          container_id: string | null
          created_at: string
          created_by: string | null
          etapa: string | null
          id: string
          idempotency_key: string
          ig_media_id: string | null
          instagram_account_id: string
          legenda: string | null
          locked_until: string | null
          media_asset_ids: string[]
          permalink: string | null
          proxima_tentativa: string | null
          publicado_em: string | null
          publish_attempted_at: string | null
          share_to_feed: boolean
          status: string
          tentativas: number
          tipo: string
          titulo: string | null
          ultimo_erro: string | null
          updated_at: string
        }
        Insert: {
          agendado_para?: string | null
          alt_text?: string | null
          aprovado_em?: string | null
          aprovado_por?: string | null
          campanha?: string | null
          capa_asset_id?: string | null
          children_container_ids?: string[]
          container_id?: string | null
          created_at?: string
          created_by?: string | null
          etapa?: string | null
          id?: string
          idempotency_key?: string
          ig_media_id?: string | null
          instagram_account_id: string
          legenda?: string | null
          locked_until?: string | null
          media_asset_ids?: string[]
          permalink?: string | null
          proxima_tentativa?: string | null
          publicado_em?: string | null
          publish_attempted_at?: string | null
          share_to_feed?: boolean
          status?: string
          tentativas?: number
          tipo?: string
          titulo?: string | null
          ultimo_erro?: string | null
          updated_at?: string
        }
        Update: {
          agendado_para?: string | null
          alt_text?: string | null
          aprovado_em?: string | null
          aprovado_por?: string | null
          campanha?: string | null
          capa_asset_id?: string | null
          children_container_ids?: string[]
          container_id?: string | null
          created_at?: string
          created_by?: string | null
          etapa?: string | null
          id?: string
          idempotency_key?: string
          ig_media_id?: string | null
          instagram_account_id?: string
          legenda?: string | null
          locked_until?: string | null
          media_asset_ids?: string[]
          permalink?: string | null
          proxima_tentativa?: string | null
          publicado_em?: string | null
          publish_attempted_at?: string | null
          share_to_feed?: boolean
          status?: string
          tentativas?: number
          tipo?: string
          titulo?: string | null
          ultimo_erro?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_capa_asset_id_fkey"
            columns: ["capa_asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_instagram_account_id_fkey"
            columns: ["instagram_account_id"]
            isOneToOne: false
            referencedRelation: "instagram_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      publish_jobs: {
        Row: {
          created_at: string
          id: string
          locked_at: string | null
          locked_by: string | null
          post_id: string
          proxima_tentativa: string | null
          tentativas: number
          ultimo_erro: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          post_id: string
          proxima_tentativa?: string | null
          tentativas?: number
          ultimo_erro?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          post_id?: string
          proxima_tentativa?: string | null
          tentativas?: number
          ultimo_erro?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "publish_jobs_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      regras_publicacao: {
        Row: {
          ativa: boolean
          campanhas_com_aprovacao: string[]
          dias_semana: number[]
          formatos: string[]
          hora_fim: number
          hora_inicio: number
          instagram_account_id: string
          max_por_dia: number
          max_por_semana: number
          motivo_suspensao: string | null
          palavras_proibidas: string[]
          respostas_automaticas: boolean
          suspender_apos_falhas: number
          suspensa_em: string | null
          updated_at: string
        }
        Insert: {
          ativa?: boolean
          campanhas_com_aprovacao?: string[]
          dias_semana?: number[]
          formatos?: string[]
          hora_fim?: number
          hora_inicio?: number
          instagram_account_id: string
          max_por_dia?: number
          max_por_semana?: number
          motivo_suspensao?: string | null
          palavras_proibidas?: string[]
          respostas_automaticas?: boolean
          suspender_apos_falhas?: number
          suspensa_em?: string | null
          updated_at?: string
        }
        Update: {
          ativa?: boolean
          campanhas_com_aprovacao?: string[]
          dias_semana?: number[]
          formatos?: string[]
          hora_fim?: number
          hora_inicio?: number
          instagram_account_id?: string
          max_por_dia?: number
          max_por_semana?: number
          motivo_suspensao?: string | null
          palavras_proibidas?: string[]
          respostas_automaticas?: boolean
          suspender_apos_falhas?: number
          suspensa_em?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "regras_publicacao_instagram_account_id_fkey"
            columns: ["instagram_account_id"]
            isOneToOne: true
            referencedRelation: "instagram_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          conteudo: Json
          created_at: string
          gerado_em: string
          id: string
          instagram_account_id: string | null
          periodo_fim: string | null
          periodo_inicio: string | null
          tipo: string
        }
        Insert: {
          conteudo?: Json
          created_at?: string
          gerado_em?: string
          id?: string
          instagram_account_id?: string | null
          periodo_fim?: string | null
          periodo_inicio?: string | null
          tipo?: string
        }
        Update: {
          conteudo?: Json
          created_at?: string
          gerado_em?: string
          id?: string
          instagram_account_id?: string | null
          periodo_fim?: string | null
          periodo_inicio?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_instagram_account_id_fkey"
            columns: ["instagram_account_id"]
            isOneToOne: false
            referencedRelation: "instagram_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      call_job: { Args: { _path: string }; Returns: number }
      can_edit: { Args: { _user_id: string }; Returns: boolean }
      claim_due_posts: {
        Args: { _lease_seconds?: number; _limit?: number }
        Returns: {
          agendado_para: string | null
          alt_text: string | null
          aprovado_em: string | null
          aprovado_por: string | null
          campanha: string | null
          capa_asset_id: string | null
          children_container_ids: string[]
          container_id: string | null
          created_at: string
          created_by: string | null
          etapa: string | null
          id: string
          idempotency_key: string
          ig_media_id: string | null
          instagram_account_id: string
          legenda: string | null
          locked_until: string | null
          media_asset_ids: string[]
          permalink: string | null
          proxima_tentativa: string | null
          publicado_em: string | null
          publish_attempted_at: string | null
          share_to_feed: boolean
          status: string
          tentativas: number
          tipo: string
          titulo: string | null
          ultimo_erro: string | null
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "posts"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      has_any_role: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      verify_jobs_token: { Args: { _token: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "editor" | "viewer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "editor", "viewer"],
    },
  },
} as const
