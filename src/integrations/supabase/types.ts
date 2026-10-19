export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: XX }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      app_users: {
        Row: {
          created_at: string
          email: string | null
          role: string
          user_id: string
          username: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          role?: string
          user_id: string
          username?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          role?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      clinica_catalogo_itens: {
        Row: {
          aliquota_iss: number | null
          ativo: boolean
          categoria: string | null
          clinica_id: string
          cnae: string | null
          codigo_tributacao: string | null
          comissao: number | null
          created_at: string
          descricao_prefeitura: string | null
          estoque_atual: number | null
          estoque_minimo: number | null
          fornecedor: string | null
          id: string
          nome: string
          preco: number
          tipo: string
          updated_at: string
        }
        Insert: {
          aliquota_iss?: number | null
          ativo?: boolean
          categoria?: string | null
          clinica_id: string
          cnae?: string | null
          codigo_tributacao?: string | null
          comissao?: number | null
          created_at?: string
          descricao_prefeitura?: string | null
          estoque_atual?: number | null
          estoque_minimo?: number | null
          fornecedor?: string | null
          id?: string
          nome: string
          preco?: number
          tipo: string
          updated_at?: string
        }
        Update: {
          aliquota_iss?: number | null
          ativo?: boolean
          categoria?: string | null
          clinica_id?: string
          cnae?: string | null
          codigo_tributacao?: string | null
          comissao?: number | null
          created_at?: string
          descricao_prefeitura?: string | null
          estoque_atual?: number | null
          estoque_minimo?: number | null
          fornecedor?: string | null
          id?: string
          nome?: string
          preco?: number
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinica_catalogo_itens_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      clinica_drive_config: {
        Row: {
          clinica_id: string
          modo: string
          root_folder_id: string | null
          root_folder_url: string | null
          status: string
          updated_at: string
          verificado_em: string | null
        }
        Insert: {
          clinica_id: string
          modo?: string
          root_folder_id?: string | null
          root_folder_url?: string | null
          status?: string
          updated_at?: string
          verificado_em?: string | null
        }
        Update: {
          clinica_id?: string
          modo?: string
          root_folder_id?: string | null
          root_folder_url?: string | null
          status?: string
          updated_at?: string
          verificado_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clinica_drive_config_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: true
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      clinica_usuarios: {
        Row: {
          ativo: boolean
          clinica_id: string
          created_at: string
          papel: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          clinica_id: string
          created_at?: string
          papel?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          clinica_id?: string
          created_at?: string
          papel?: string
          user_id?: string
        }
        Relationships: []
      }
      clinicas: {
        Row: {
          acesso_ate: string | null
          created_at: string
          dominio: string | null
          duracao_padrao_atendimento_min: number
          duracoes_atendimento_min: Json
          id: string
          limite_usuarios: number
          logo_url: string | null
          nome: string
          observacoes: string | null
          plano: string
          proximo_pagamento_em: string | null
          slug: string | null
          status: string
          status_financeiro: string
          tipo_publico: string
          ultimo_pagamento_em: string | null
          updated_at: string
        }
        Insert: {
          acesso_ate?: string | null
          created_at?: string
          dominio?: string | null
          duracao_padrao_atendimento_min?: number
          duracoes_atendimento_min?: Json
          id?: string
          limite_usuarios?: number
          logo_url?: string | null
          nome: string
          observacoes?: string | null
          plano?: string
          proximo_pagamento_em?: string | null
          slug?: string | null
          status?: string
          status_financeiro?: string
          tipo_publico?: string
          ultimo_pagamento_em?: string | null
          updated_at?: string
        }
        Update: {
          acesso_ate?: string | null
          created_at?: string
          dominio?: string | null
          duracao_padrao_atendimento_min?: number
          duracoes_atendimento_min?: Json
          id?: string
          limite_usuarios?: number
          logo_url?: string | null
          nome?: string
          observacoes?: string | null
          plano?: string
          proximo_pagamento_em?: string | null
          slug?: string | null
          status?: string
          status_financeiro?: string
          tipo_publico?: string
          ultimo_pagamento_em?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      drive_arquivos: {
        Row: {
          categoria: string
          clinica_id: string
          created_at: string
          drive_file_id: string
          drive_folder_id: string | null
          entidade_id: string | null
          entidade_tipo: string | null
          enviado_por: string | null
          id: string
          metadata: Json
          mime_type: string | null
          nome: string
          tamanho_bytes: number | null
          visibilidade: string
        }
        Insert: {
          categoria: string
          clinica_id: string
          created_at?: string
          drive_file_id: string
          drive_folder_id?: string | null
          entidade_id?: string | null
          entidade_tipo?: string | null
          enviado_por?: string | null
          id?: string
          metadata?: Json
          mime_type?: string | null
          nome: string
          tamanho_bytes?: number | null
          visibilidade?: string
        }
        Update: {
          categoria?: string
          clinica_id?: string
          created_at?: string
          drive_file_id?: string
          drive_folder_id?: string | null
          entidade_id?: string | null
          entidade_tipo?: string | null
          enviado_por?: string | null
          id?: string
          metadata?: Json
          mime_type?: string | null
          nome?: string
          tamanho_bytes?: number | null
          visibilidade?: string
        }
        Relationships: [
          {
            foreignKeyName: "drive_arquivos_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      drive_plataforma_config: {
        Row: {
          clinicas_folder_id: string
          id: number
          provider: string
          root_folder_id: string
          updated_at: string
        }
        Insert: {
          clinicas_folder_id: string
          id?: number
          provider?: string
          root_folder_id: string
          updated_at?: string
        }
        Update: {
          clinicas_folder_id?: string
          id?: number
          provider?: string
          root_folder_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      fv_members: {
        Row: {
          added_at: string
          email: string
        }
        Insert: {
          added_at?: string
          email: string
        }
        Update: {
          added_at?: string
          email?: string
        }
        Relationships: []
      }
      fv_state: {
        Row: {
          data: Json
          id: number
          updated_at: string
          version: number
        }
        Insert: {
          data?: Json
          id?: number
          updated_at?: string
          version?: number
        }
        Update: {
          data?: Json
          id?: number
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      leinventario_registros: {
        Row: {
          area: string
          bipado_em: string
          codigo_material: string
          lote: string
          sequencial: number
          usuario: string
        }
        Insert: {
          area: string
          bipado_em?: string
          codigo_material: string
          lote: string
          sequencial?: number
          usuario: string
        }
        Update: {
          area?: string
          bipado_em?: string
          codigo_material?: string
          lote?: string
          sequencial?: number
          usuario?: string
        }
        Relationships: []
      }
      oricse_agendamentos_online: {
        Row: {
          agenda_id: string
          animal_id: string | null
          animal_referencia: string
          clinica_id: string
          criado_em: string
          dados: Json
          estado: string
          fim: string
          id: string
          inicio: string
          observacoes: string | null
          origem: string
          pagamento_confirmado_em: string | null
          tipo: string
          tutor_auth_id: string | null
          tutor_id: string | null
          updated_at: string
        }
        Insert: {
          agenda_id: string
          animal_id?: string | null
          animal_referencia: string
          clinica_id: string
          criado_em?: string
          dados?: Json
          estado?: string
          fim: string
          id?: string
          inicio: string
          observacoes?: string | null
          origem?: string
          pagamento_confirmado_em?: string | null
          tipo?: string
          tutor_auth_id?: string | null
          tutor_id?: string | null
          updated_at?: string
        }
        Update: {
          agenda_id?: string
          animal_id?: string | null
          animal_referencia?: string
          clinica_id?: string
          criado_em?: string
          dados?: Json
          estado?: string
          fim?: string
          id?: string
          inicio?: string
          observacoes?: string | null
          origem?: string
          pagamento_confirmado_em?: string | null
          tipo?: string
          tutor_auth_id?: string | null
          tutor_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "oricse_agendamento_agenda_mesma_clinica_fkey"
            columns: ["clinica_id", "agenda_id"]
            isOneToOne: false
            referencedRelation: "oricse_agendas_online"
            referencedColumns: ["clinica_id", "id"]
          },
          {
            foreignKeyName: "oricse_agendamento_animal_mesma_clinica_fkey"
            columns: ["clinica_id", "animal_id"]
            isOneToOne: false
            referencedRelation: "oricse_animais"
            referencedColumns: ["clinica_id", "id"]
          },
          {
            foreignKeyName: "oricse_agendamento_tutor_mesma_clinica_fkey"
            columns: ["clinica_id", "tutor_id"]
            isOneToOne: false
            referencedRelation: "tutores"
            referencedColumns: ["clinica_id", "id"]
          },
          {
            foreignKeyName: "oricse_agendamentos_online_agenda_id_fkey"
            columns: ["agenda_id"]
            isOneToOne: false
            referencedRelation: "oricse_agendas_online"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oricse_agendamentos_online_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      oricse_agendas_online: {
        Row: {
          antecedencia_horas: number
          clinica_id: string
          cor: string
          created_at: string
          dias_semana: number[]
          fim: string
          id: string
          inicio: string
          intervalo_min: number
          modalidade: string
          nome: string
          pagamento_descricao: string | null
          pagamento_modo_valor: string | null
          pagamento_valor: number | null
          portal_ativo: boolean
          responsavel: string
          timezone: string
          tipo: string
          updated_at: string
        }
        Insert: {
          antecedencia_horas?: number
          clinica_id: string
          cor?: string
          created_at?: string
          dias_semana?: number[]
          fim?: string
          id?: string
          inicio?: string
          intervalo_min?: number
          modalidade?: string
          nome: string
          pagamento_descricao?: string | null
          pagamento_modo_valor?: string | null
          pagamento_valor?: number | null
          portal_ativo?: boolean
          responsavel?: string
          timezone?: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          antecedencia_horas?: number
          clinica_id?: string
          cor?: string
          created_at?: string
          dias_semana?: number[]
          fim?: string
          id?: string
          inicio?: string
          intervalo_min?: number
          modalidade?: string
          nome?: string
          pagamento_descricao?: string | null
          pagamento_modo_valor?: string | null
          pagamento_valor?: number | null
          portal_ativo?: boolean
          responsavel?: string
          timezone?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "oricse_agendas_online_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      oricse_animais: {
        Row: {
          clinica_id: string
          created_at: string
          dados: Json
          especie: string
          foto_url: string | null
          id: string
          nascimento: string | null
          nome: string
          peso_kg: number | null
          raca: string
          sexo: string
          tutor_id: string
          updated_at: string
        }
        Insert: {
          clinica_id: string
          created_at?: string
          dados?: Json
          especie?: string
          foto_url?: string | null
          id?: string
          nascimento?: string | null
          nome: string
          peso_kg?: number | null
          raca?: string
          sexo?: string
          tutor_id: string
          updated_at?: string
        }
        Update: {
          clinica_id?: string
          created_at?: string
          dados?: Json
          especie?: string
          foto_url?: string | null
          id?: string
          nascimento?: string | null
          nome?: string
          peso_kg?: number | null
          raca?: string
          sexo?: string
          tutor_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "oricse_animais_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oricse_animais_tutor_mesma_clinica_fkey"
            columns: ["clinica_id", "tutor_id"]
            isOneToOne: false
            referencedRelation: "tutores"
            referencedColumns: ["clinica_id", "id"]
          },
        ]
      }
      oricse_animal_pesos: {
        Row: {
          animal_id: string
          clinica_id: string
          created_at: string
          data: string
          id: string
          peso: number
        }
        Insert: {
          animal_id: string
          clinica_id: string
          created_at?: string
          data?: string
          id?: string
          peso: number
        }
        Update: {
          animal_id?: string
          clinica_id?: string
          created_at?: string
          data?: string
          id?: string
          peso?: number
        }
        Relationships: [
          {
            foreignKeyName: "oricse_animal_pesos_clinica_id_animal_id_fkey"
            columns: ["clinica_id", "animal_id"]
            isOneToOne: false
            referencedRelation: "oricse_animais"
            referencedColumns: ["clinica_id", "id"]
          },
        ]
      }
      oricse_animal_registros_extra: {
        Row: {
          animal_id: string
          clinica_id: string
          created_at: string
          data: string
          detalhe: string
          id: string
          tipo: string
          titulo: string
        }
        Insert: {
          animal_id: string
          clinica_id: string
          created_at?: string
          data?: string
          detalhe?: string
          id?: string
          tipo: string
          titulo: string
        }
        Update: {
          animal_id?: string
          clinica_id?: string
          created_at?: string
          data?: string
          detalhe?: string
          id?: string
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "oricse_animal_registros_extra_clinica_id_animal_id_fkey"
            columns: ["clinica_id", "animal_id"]
            isOneToOne: false
            referencedRelation: "oricse_animais"
            referencedColumns: ["clinica_id", "id"]
          },
        ]
      }
      oricse_catalogo_itens: {
        Row: {
          ativo: boolean
          categoria: string
          clinica_id: string
          created_at: string
          criado_por: string | null
          estoque_atual: number | null
          estoque_minimo: number | null
          id: string
          nome: string
          tipo: string
          updated_at: string
          valor: number
        }
        Insert: {
          ativo?: boolean
          categoria?: string
          clinica_id: string
          created_at?: string
          criado_por?: string | null
          estoque_atual?: number | null
          estoque_minimo?: number | null
          id?: string
          nome: string
          tipo: string
          updated_at?: string
          valor: number
        }
        Update: {
          ativo?: boolean
          categoria?: string
          clinica_id?: string
          created_at?: string
          criado_por?: string | null
          estoque_atual?: number | null
          estoque_minimo?: number | null
          id?: string
          nome?: string
          tipo?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "oricse_catalogo_itens_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      oricse_clinica_ativa_usuario: {
        Row: {
          clinica_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          clinica_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          clinica_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oricse_clinica_ativa_usuario_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      oricse_clinica_autorizacoes: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          clinica_id: string
          decisao: string
          funcionalidade_codigo: string
          motivo: string | null
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          clinica_id: string
          decisao: string
          funcionalidade_codigo: string
          motivo?: string | null
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          clinica_id?: string
          decisao?: string
          funcionalidade_codigo?: string
          motivo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "oricse_clinica_autorizacoes_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oricse_clinica_autorizacoes_funcionalidade_codigo_fkey"
            columns: ["funcionalidade_codigo"]
            isOneToOne: false
            referencedRelation: "oricse_funcionalidades"
            referencedColumns: ["codigo"]
          },
        ]
      }
      oricse_clinica_funcionalidade_excecoes: {
        Row: {
          clinica_id: string
          created_at: string
          criado_por: string | null
          expira_em: string | null
          funcionalidade_codigo: string
          id: string
          motivo: string
          permitido: boolean
          updated_at: string
        }
        Insert: {
          clinica_id: string
          created_at?: string
          criado_por?: string | null
          expira_em?: string | null
          funcionalidade_codigo: string
          id?: string
          motivo?: string
          permitido: boolean
          updated_at?: string
        }
        Update: {
          clinica_id?: string
          created_at?: string
          criado_por?: string | null
          expira_em?: string | null
          funcionalidade_codigo?: string
          id?: string
          motivo?: string
          permitido?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "oricse_clinica_funcionalidade_exceco_funcionalidade_codigo_fkey"
            columns: ["funcionalidade_codigo"]
            isOneToOne: false
            referencedRelation: "oricse_funcionalidades"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "oricse_clinica_funcionalidade_excecoes_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      oricse_cobrancas_tutores: {
        Row: {
          agenda_id: string | null
          agendamento_id: string | null
          animal_id: string | null
          aprovado_em: string | null
          checkout_url: string | null
          clinica_id: string
          created_at: string
          dados_provedor: Json
          descricao: string
          id: string
          mercado_pago_payment_id: string | null
          mercado_pago_preference_id: string | null
          modo_valor: string
          status: string
          taxa_mercado_pago_fixa: number
          taxa_mercado_pago_percentual: number
          taxa_oricse_percentual: number
          tutor_id: string
          updated_at: string
          valor_clinica_previsto: number
          valor_cobrado: number
          valor_mercado_pago_previsto: number
          valor_oricse_previsto: number
          valor_referencia: number
          webhook_recebido_em: string | null
        }
        Insert: {
          agenda_id?: string | null
          agendamento_id?: string | null
          animal_id?: string | null
          aprovado_em?: string | null
          checkout_url?: string | null
          clinica_id: string
          created_at?: string
          dados_provedor?: Json
          descricao: string
          id?: string
          mercado_pago_payment_id?: string | null
          mercado_pago_preference_id?: string | null
          modo_valor: string
          status?: string
          taxa_mercado_pago_fixa?: number
          taxa_mercado_pago_percentual: number
          taxa_oricse_percentual: number
          tutor_id: string
          updated_at?: string
          valor_clinica_previsto?: number
          valor_cobrado: number
          valor_mercado_pago_previsto?: number
          valor_oricse_previsto?: number
          valor_referencia: number
          webhook_recebido_em?: string | null
        }
        Update: {
          agenda_id?: string | null
          agendamento_id?: string | null
          animal_id?: string | null
          aprovado_em?: string | null
          checkout_url?: string | null
          clinica_id?: string
          created_at?: string
          dados_provedor?: Json
          descricao?: string
          id?: string
          mercado_pago_payment_id?: string | null
          mercado_pago_preference_id?: string | null
          modo_valor?: string
          status?: string
          taxa_mercado_pago_fixa?: number
          taxa_mercado_pago_percentual?: number
          taxa_oricse_percentual?: number
          tutor_id?: string
          updated_at?: string
          valor_clinica_previsto?: number
          valor_cobrado?: number
          valor_mercado_pago_previsto?: number
          valor_oricse_previsto?: number
          valor_referencia?: number
          webhook_recebido_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "oricse_cobrancas_tutores_clinica_id_animal_id_fkey"
            columns: ["clinica_id", "animal_id"]
            isOneToOne: false
            referencedRelation: "oricse_animais"
            referencedColumns: ["clinica_id", "id"]
          },
          {
            foreignKeyName: "oricse_cobrancas_tutores_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oricse_cobrancas_tutores_clinica_id_tutor_id_fkey"
            columns: ["clinica_id", "tutor_id"]
            isOneToOne: false
            referencedRelation: "tutores"
            referencedColumns: ["clinica_id", "id"]
          },
        ]
      }
      oricse_codigo_promocional_usos: {
        Row: {
          codigo_id: string
          contratacao_id: string | null
          created_at: string
          documento_normalizado: string | null
          id: string
        }
        Insert: {
          codigo_id: string
          contratacao_id?: string | null
          created_at?: string
          documento_normalizado?: string | null
          id?: string
        }
        Update: {
          codigo_id?: string
          contratacao_id?: string | null
          created_at?: string
          documento_normalizado?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oricse_codigo_promocional_usos_codigo_id_fkey"
            columns: ["codigo_id"]
            isOneToOne: false
            referencedRelation: "oricse_codigos_promocionais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oricse_codigo_promocional_usos_contratacao_id_fkey"
            columns: ["contratacao_id"]
            isOneToOne: false
            referencedRelation: "oricse_contratacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      oricse_codigos_promocionais: {
        Row: {
          ativo: boolean
          codigo: string
          created_at: string
          duracao: string
          id: string
          limite_por_documento: number | null
          limite_usos: number | null
          planos: string[]
          somente_primeira_assinatura: boolean
          tipo_desconto: string
          updated_at: string
          valido_ate: string | null
          valido_de: string | null
          valor: number
        }
        Insert: {
          ativo?: boolean
          codigo: string
          created_at?: string
          duracao?: string
          id?: string
          limite_por_documento?: number | null
          limite_usos?: number | null
          planos?: string[]
          somente_primeira_assinatura?: boolean
          tipo_desconto: string
          updated_at?: string
          valido_ate?: string | null
          valido_de?: string | null
          valor: number
        }
        Update: {
          ativo?: boolean
          codigo?: string
          created_at?: string
          duracao?: string
          id?: string
          limite_por_documento?: number | null
          limite_usos?: number | null
          planos?: string[]
          somente_primeira_assinatura?: boolean
          tipo_desconto?: string
          updated_at?: string
          valido_ate?: string | null
          valido_de?: string | null
          valor?: number
        }
        Relationships: []
      }
      oricse_config: {
        Row: {
          chave: string
          updated_at: string
          valor: Json
        }
        Insert: {
          chave: string
          updated_at?: string
          valor?: Json
        }
        Update: {
          chave?: string
          updated_at?: string
          valor?: Json
        }
        Relationships: []
      }
      oricse_contratacoes: {
        Row: {
          aceitou_privacidade: boolean
          aceitou_termos: boolean
          adicional_perfis_ciclo: number
          adicional_perfis_mensal: number
          ciclo: string
          clinica_bairro: string | null
          clinica_cep: string | null
          clinica_cidade: string | null
          clinica_complemento: string | null
          clinica_email: string | null
          clinica_endereco: string | null
          clinica_nome: string
          clinica_numero: string | null
          clinica_telefone: string | null
          clinica_uf: string | null
          cnpj: string | null
          created_at: string
          dados: Json
          documento_teste: string | null
          dominio: string | null
          id: string
          observacoes: string | null
          pagamento_aprovado_em: string | null
          pagamento_id: string | null
          pagamento_provedor: string | null
          perfis_extras: number
          perfis_inclusos: number
          plano_codigo: string
          plano_nome: string
          promo_codigo: string | null
          promo_desconto: number | null
          promo_duracao: string | null
          promo_valor_final: number | null
          promo_valor_original: number | null
          quantidade_usuarios: number
          razao_social: string | null
          responsavel_bairro: string | null
          responsavel_cep: string | null
          responsavel_cidade: string | null
          responsavel_complemento: string | null
          responsavel_cpf: string | null
          responsavel_crmv: string | null
          responsavel_crmv_uf: string | null
          responsavel_email: string
          responsavel_endereco: string | null
          responsavel_nome: string
          responsavel_numero: string | null
          responsavel_telefone: string | null
          responsavel_uf: string | null
          slug_desejado: string | null
          status: string
          tipo_operacao: string | null
          trial_ends_at: string | null
          trial_started_at: string | null
          updated_at: string
          valor_base: number
          valor_exibido: string | null
          valor_total: number
        }
        Insert: {
          aceitou_privacidade?: boolean
          aceitou_termos?: boolean
          adicional_perfis_ciclo?: number
          adicional_perfis_mensal?: number
          ciclo: string
          clinica_bairro?: string | null
          clinica_cep?: string | null
          clinica_cidade?: string | null
          clinica_complemento?: string | null
          clinica_email?: string | null
          clinica_endereco?: string | null
          clinica_nome: string
          clinica_numero?: string | null
          clinica_telefone?: string | null
          clinica_uf?: string | null
          cnpj?: string | null
          created_at?: string
          dados?: Json
          documento_teste?: string | null
          dominio?: string | null
          id?: string
          observacoes?: string | null
          pagamento_aprovado_em?: string | null
          pagamento_id?: string | null
          pagamento_provedor?: string | null
          perfis_extras?: number
          perfis_inclusos?: number
          plano_codigo: string
          plano_nome: string
          promo_codigo?: string | null
          promo_desconto?: number | null
          promo_duracao?: string | null
          promo_valor_final?: number | null
          promo_valor_original?: number | null
          quantidade_usuarios?: number
          razao_social?: string | null
          responsavel_bairro?: string | null
          responsavel_cep?: string | null
          responsavel_cidade?: string | null
          responsavel_complemento?: string | null
          responsavel_cpf?: string | null
          responsavel_crmv?: string | null
          responsavel_crmv_uf?: string | null
          responsavel_email: string
          responsavel_endereco?: string | null
          responsavel_nome: string
          responsavel_numero?: string | null
          responsavel_telefone?: string | null
          responsavel_uf?: string | null
          slug_desejado?: string | null
          status: string
          tipo_operacao?: string | null
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
          valor_base?: number
          valor_exibido?: string | null
          valor_total?: number
        }
        Update: {
          aceitou_privacidade?: boolean
          aceitou_termos?: boolean
          adicional_perfis_ciclo?: number
          adicional_perfis_mensal?: number
          ciclo?: string
          clinica_bairro?: string | null
          clinica_cep?: string | null
          clinica_cidade?: string | null
          clinica_complemento?: string | null
          clinica_email?: string | null
          clinica_endereco?: string | null
          clinica_nome?: string
          clinica_numero?: string | null
          clinica_telefone?: string | null
          clinica_uf?: string | null
          cnpj?: string | null
          created_at?: string
          dados?: Json
          documento_teste?: string | null
          dominio?: string | null
          id?: string
          observacoes?: string | null
          pagamento_aprovado_em?: string | null
          pagamento_id?: string | null
          pagamento_provedor?: string | null
          perfis_extras?: number
          perfis_inclusos?: number
          plano_codigo?: string
          plano_nome?: string
          promo_codigo?: string | null
          promo_desconto?: number | null
          promo_duracao?: string | null
          promo_valor_final?: number | null
          promo_valor_original?: number | null
          quantidade_usuarios?: number
          razao_social?: string | null
          responsavel_bairro?: string | null
          responsavel_cep?: string | null
          responsavel_cidade?: string | null
          responsavel_complemento?: string | null
          responsavel_cpf?: string | null
          responsavel_crmv?: string | null
          responsavel_crmv_uf?: string | null
          responsavel_email?: string
          responsavel_endereco?: string | null
          responsavel_nome?: string
          responsavel_numero?: string | null
          responsavel_telefone?: string | null
          responsavel_uf?: string | null
          slug_desejado?: string | null
          status?: string
          tipo_operacao?: string | null
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
          valor_base?: number
          valor_exibido?: string | null
          valor_total?: number
        }
        Relationships: []
      }
      oricse_crm_config: {
        Row: {
          ativo: boolean
          canal_padrao: string
          clinica_id: string
          created_at: string
          dias_antecedencia_agenda: number
          dias_inatividade: number
          dias_pos_cirurgico: number
          gerar_agendamentos: boolean
          gerar_aniversarios: boolean
          gerar_inativos: boolean
          gerar_pos_cirurgico: boolean
          gerar_reforcos: boolean
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          canal_padrao?: string
          clinica_id: string
          created_at?: string
          dias_antecedencia_agenda?: number
          dias_inatividade?: number
          dias_pos_cirurgico?: number
          gerar_agendamentos?: boolean
          gerar_aniversarios?: boolean
          gerar_inativos?: boolean
          gerar_pos_cirurgico?: boolean
          gerar_reforcos?: boolean
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          canal_padrao?: string
          clinica_id?: string
          created_at?: string
          dias_antecedencia_agenda?: number
          dias_inatividade?: number
          dias_pos_cirurgico?: number
          gerar_agendamentos?: boolean
          gerar_aniversarios?: boolean
          gerar_inativos?: boolean
          gerar_pos_cirurgico?: boolean
          gerar_reforcos?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "oricse_crm_config_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: true
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      oricse_crm_eventos: {
        Row: {
          agendado_para: string
          animal_nome: string
          canal: string
          chave_dedupe: string | null
          clinica_id: string
          created_at: string
          criado_por: string | null
          destinatario_nome: string
          email: string
          enviado_em: string | null
          id: string
          mensagem: string
          metadados: Json
          origem: string
          status: string
          telefone: string
          tipo: string
          titulo: string
          tutor_id: string | null
          tutor_ref_local: string | null
          updated_at: string
        }
        Insert: {
          agendado_para: string
          animal_nome?: string
          canal?: string
          chave_dedupe?: string | null
          clinica_id: string
          created_at?: string
          criado_por?: string | null
          destinatario_nome?: string
          email?: string
          enviado_em?: string | null
          id?: string
          mensagem: string
          metadados?: Json
          origem?: string
          status?: string
          telefone?: string
          tipo: string
          titulo: string
          tutor_id?: string | null
          tutor_ref_local?: string | null
          updated_at?: string
        }
        Update: {
          agendado_para?: string
          animal_nome?: string
          canal?: string
          chave_dedupe?: string | null
          clinica_id?: string
          created_at?: string
          criado_por?: string | null
          destinatario_nome?: string
          email?: string
          enviado_em?: string | null
          id?: string
          mensagem?: string
          metadados?: Json
          origem?: string
          status?: string
          telefone?: string
          tipo?: string
          titulo?: string
          tutor_id?: string | null
          tutor_ref_local?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "oricse_crm_eventos_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oricse_crm_eventos_tutor_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "tutores"
            referencedColumns: ["id"]
          },
        ]
      }
      oricse_crm_fila_envio: {
        Row: {
          canal: string
          clinica_id: string
          created_at: string
          evento_id: string
          id: string
          processado_em: string | null
          provider: string
          status: string
          tentativas: number
          ultimo_erro: string
          updated_at: string
        }
        Insert: {
          canal: string
          clinica_id: string
          created_at?: string
          evento_id: string
          id?: string
          processado_em?: string | null
          provider?: string
          status?: string
          tentativas?: number
          ultimo_erro?: string
          updated_at?: string
        }
        Update: {
          canal?: string
          clinica_id?: string
          created_at?: string
          evento_id?: string
          id?: string
          processado_em?: string | null
          provider?: string
          status?: string
          tentativas?: number
          ultimo_erro?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "oricse_crm_fila_envio_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oricse_crm_fila_envio_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: true
            referencedRelation: "oricse_crm_eventos"
            referencedColumns: ["id"]
          },
        ]
      }
      oricse_crm_fontes: {
        Row: {
          agendas: Json
          animais: Json
          clinica_id: string
          prontuario: Json
          sincronizado_em: string
          sincronizado_por: string | null
          tutores: Json
          updated_at: string
        }
        Insert: {
          agendas?: Json
          animais?: Json
          clinica_id: string
          prontuario?: Json
          sincronizado_em?: string
          sincronizado_por?: string | null
          tutores?: Json
          updated_at?: string
        }
        Update: {
          agendas?: Json
          animais?: Json
          clinica_id?: string
          prontuario?: Json
          sincronizado_em?: string
          sincronizado_por?: string | null
          tutores?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "oricse_crm_fontes_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: true
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      oricse_crm_modelos: {
        Row: {
          assunto: string
          ativo: boolean
          atualizado_por: string | null
          canal: string
          clinica_id: string
          created_at: string
          criado_por: string | null
          id: string
          mensagem: string
          nome: string
          tipo: string
          updated_at: string
        }
        Insert: {
          assunto?: string
          ativo?: boolean
          atualizado_por?: string | null
          canal?: string
          clinica_id: string
          created_at?: string
          criado_por?: string | null
          id?: string
          mensagem: string
          nome: string
          tipo: string
          updated_at?: string
        }
        Update: {
          assunto?: string
          ativo?: boolean
          atualizado_por?: string | null
          canal?: string
          clinica_id?: string
          created_at?: string
          criado_por?: string | null
          id?: string
          mensagem?: string
          nome?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "oricse_crm_modelos_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      oricse_dados_modulos: {
        Row: {
          atualizado_em: string
          atualizado_por: string
          chave: string
          clinica_id: string
          dados: Json
        }
        Insert: {
          atualizado_em?: string
          atualizado_por: string
          chave: string
          clinica_id: string
          dados?: Json
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string
          chave?: string
          clinica_id?: string
          dados?: Json
        }
        Relationships: []
      }
      oricse_drive_backup_outbox: {
        Row: {
          clinica_id: string | null
          copiado_em: string | null
          criado_em: string
          dados: Json | null
          erro_ultimo: string | null
          id: string
          lease_ate: string | null
          operacao: string
          origem_tabela: string
          proxima_tentativa_em: string
          registro_chave: string
          tentativas: number
        }
        Insert: {
          clinica_id?: string | null
          copiado_em?: string | null
          criado_em?: string
          dados?: Json | null
          erro_ultimo?: string | null
          id?: string
          lease_ate?: string | null
          operacao: string
          origem_tabela: string
          proxima_tentativa_em?: string
          registro_chave: string
          tentativas?: number
        }
        Update: {
          clinica_id?: string | null
          copiado_em?: string | null
          criado_em?: string
          dados?: Json | null
          erro_ultimo?: string | null
          id?: string
          lease_ate?: string | null
          operacao?: string
          origem_tabela?: string
          proxima_tentativa_em?: string
          registro_chave?: string
          tentativas?: number
        }
        Relationships: []
      }
      oricse_fila_espera: {
        Row: {
          animal_id: string
          chamado_em: string | null
          chegada_em: string
          clinica_id: string
          id: string
          motivo: string
          status: string
          tutor_id: string
        }
        Insert: {
          animal_id: string
          chamado_em?: string | null
          chegada_em?: string
          clinica_id: string
          id?: string
          motivo?: string
          status?: string
          tutor_id: string
        }
        Update: {
          animal_id?: string
          chamado_em?: string | null
          chegada_em?: string
          clinica_id?: string
          id?: string
          motivo?: string
          status?: string
          tutor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oricse_fila_espera_clinica_id_animal_id_fkey"
            columns: ["clinica_id", "animal_id"]
            isOneToOne: false
            referencedRelation: "oricse_animais"
            referencedColumns: ["clinica_id", "id"]
          },
          {
            foreignKeyName: "oricse_fila_espera_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oricse_fila_espera_clinica_id_tutor_id_fkey"
            columns: ["clinica_id", "tutor_id"]
            isOneToOne: false
            referencedRelation: "tutores"
            referencedColumns: ["clinica_id", "id"]
          },
        ]
      }
      oricse_funcionalidades: {
        Row: {
          ativo: boolean
          codigo: string
          grupo: string
          nome: string
          ordem: number
        }
        Insert: {
          ativo?: boolean
          codigo: string
          grupo: string
          nome: string
          ordem?: number
        }
        Update: {
          ativo?: boolean
          codigo?: string
          grupo?: string
          nome?: string
          ordem?: number
        }
        Relationships: []
      }
      oricse_jornada_config: {
        Row: {
          atualizado_em: string
          clinica_id: string
          funcionario_id: string
          modalidade: string
          valor_unitario: number
        }
        Insert: {
          atualizado_em?: string
          clinica_id: string
          funcionario_id: string
          modalidade: string
          valor_unitario: number
        }
        Update: {
          atualizado_em?: string
          clinica_id?: string
          funcionario_id?: string
          modalidade?: string
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "oricse_jornada_config_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      oricse_jornada_registros: {
        Row: {
          clinica_id: string
          criado_em: string
          data: string
          estado: string
          finalizado_em: string | null
          funcionario_id: string
          id: string
          iniciado_em: string
          modalidade: string
          segundos_trabalhados: number
          ultimo_inicio_em: string | null
          valor_unitario: number
        }
        Insert: {
          clinica_id: string
          criado_em?: string
          data?: string
          estado: string
          finalizado_em?: string | null
          funcionario_id: string
          id?: string
          iniciado_em?: string
          modalidade: string
          segundos_trabalhados?: number
          ultimo_inicio_em?: string | null
          valor_unitario: number
        }
        Update: {
          clinica_id?: string
          criado_em?: string
          data?: string
          estado?: string
          finalizado_em?: string | null
          funcionario_id?: string
          id?: string
          iniciado_em?: string
          modalidade?: string
          segundos_trabalhados?: number
          ultimo_inicio_em?: string | null
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "oricse_jornada_registros_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      oricse_mercadopago_conexoes: {
        Row: {
          access_token_cifrado: string
          clinica_id: string
          collector_id: string
          connected_at: string
          connected_by: string | null
          escopos: string[]
          refresh_token_cifrado: string | null
          status: string
          token_expira_em: string | null
          updated_at: string
        }
        Insert: {
          access_token_cifrado: string
          clinica_id: string
          collector_id: string
          connected_at?: string
          connected_by?: string | null
          escopos?: string[]
          refresh_token_cifrado?: string | null
          status?: string
          token_expira_em?: string | null
          updated_at?: string
        }
        Update: {
          access_token_cifrado?: string
          clinica_id?: string
          collector_id?: string
          connected_at?: string
          connected_by?: string | null
          escopos?: string[]
          refresh_token_cifrado?: string | null
          status?: string
          token_expira_em?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "oricse_mercadopago_conexoes_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: true
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      oricse_mp_oauth_sessoes: {
        Row: {
          clinica_id: string
          code_verifier_cifrado: string
          criado_em: string
          expira_em: string
          iniciado_por: string
          state_hash: string
        }
        Insert: {
          clinica_id: string
          code_verifier_cifrado: string
          criado_em?: string
          expira_em: string
          iniciado_por: string
          state_hash: string
        }
        Update: {
          clinica_id?: string
          code_verifier_cifrado?: string
          criado_em?: string
          expira_em?: string
          iniciado_por?: string
          state_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "oricse_mp_oauth_sessoes_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      oricse_pagamento_lancamentos: {
        Row: {
          catalogo_item_id: string | null
          clinica_id: string
          created_at: string
          criado_por: string
          data: string
          descricao: string
          funcionario_id: string
          hora_fim: string | null
          hora_inicio: string | null
          id: string
          quantidade: number
          tipo: string
          valor: number
        }
        Insert: {
          catalogo_item_id?: string | null
          clinica_id: string
          created_at?: string
          criado_por?: string
          data?: string
          descricao: string
          funcionario_id: string
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          quantidade?: number
          tipo: string
          valor: number
        }
        Update: {
          catalogo_item_id?: string | null
          clinica_id?: string
          created_at?: string
          criado_por?: string
          data?: string
          descricao?: string
          funcionario_id?: string
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          quantidade?: number
          tipo?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "oricse_pagamento_item_mesma_clinica_fkey"
            columns: ["clinica_id", "catalogo_item_id"]
            isOneToOne: false
            referencedRelation: "oricse_catalogo_itens"
            referencedColumns: ["clinica_id", "id"]
          },
          {
            foreignKeyName: "oricse_pagamento_lancamentos_catalogo_item_id_fkey"
            columns: ["catalogo_item_id"]
            isOneToOne: false
            referencedRelation: "oricse_catalogo_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oricse_pagamento_lancamentos_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      oricse_pagamentos: {
        Row: {
          bruto_centavos: number
          clinica_id: string | null
          created_at: string
          estimativa_clinica_centavos: number
          estimativa_mp_centavos: number
          estimativa_oricse_centavos: number
          id: string
          modalidade: string | null
          mp_payment_id: string | null
          origem_id: string | null
          recebido_clinica_centavos: number | null
          recebido_mp_centavos: number | null
          recebido_oricse_centavos: number | null
          status: string
          taxas_snapshot: Json
          tipo: string
          updated_at: string
        }
        Insert: {
          bruto_centavos: number
          clinica_id?: string | null
          created_at?: string
          estimativa_clinica_centavos?: number
          estimativa_mp_centavos?: number
          estimativa_oricse_centavos?: number
          id?: string
          modalidade?: string | null
          mp_payment_id?: string | null
          origem_id?: string | null
          recebido_clinica_centavos?: number | null
          recebido_mp_centavos?: number | null
          recebido_oricse_centavos?: number | null
          status?: string
          taxas_snapshot?: Json
          tipo: string
          updated_at?: string
        }
        Update: {
          bruto_centavos?: number
          clinica_id?: string | null
          created_at?: string
          estimativa_clinica_centavos?: number
          estimativa_mp_centavos?: number
          estimativa_oricse_centavos?: number
          id?: string
          modalidade?: string | null
          mp_payment_id?: string | null
          origem_id?: string | null
          recebido_clinica_centavos?: number | null
          recebido_mp_centavos?: number | null
          recebido_oricse_centavos?: number | null
          status?: string
          taxas_snapshot?: Json
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "oricse_pagamentos_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      oricse_permissoes: {
        Row: {
          ativo: boolean
          codigo: string
          descricao: string
          funcionalidade_codigo: string | null
          grupo: string
          nome: string
          ordem: number
        }
        Insert: {
          ativo?: boolean
          codigo: string
          descricao?: string
          funcionalidade_codigo?: string | null
          grupo: string
          nome: string
          ordem?: number
        }
        Update: {
          ativo?: boolean
          codigo?: string
          descricao?: string
          funcionalidade_codigo?: string | null
          grupo?: string
          nome?: string
          ordem?: number
        }
        Relationships: [
          {
            foreignKeyName: "oricse_permissoes_funcionalidade_codigo_fkey"
            columns: ["funcionalidade_codigo"]
            isOneToOne: false
            referencedRelation: "oricse_funcionalidades"
            referencedColumns: ["codigo"]
          },
        ]
      }
      oricse_permissoes_papel: {
        Row: {
          papel: string
          permissao_codigo: string
          permitido: boolean
        }
        Insert: {
          papel: string
          permissao_codigo: string
          permitido?: boolean
        }
        Update: {
          papel?: string
          permissao_codigo?: string
          permitido?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "oricse_permissoes_papel_permissao_codigo_fkey"
            columns: ["permissao_codigo"]
            isOneToOne: false
            referencedRelation: "oricse_permissoes"
            referencedColumns: ["codigo"]
          },
        ]
      }
      oricse_permissoes_usuario: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          clinica_id: string
          permissao_codigo: string
          permitido: boolean
          user_id: string
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          clinica_id: string
          permissao_codigo: string
          permitido: boolean
          user_id: string
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          clinica_id?: string
          permissao_codigo?: string
          permitido?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oricse_permissoes_usuario_clinica_id_user_id_fkey"
            columns: ["clinica_id", "user_id"]
            isOneToOne: false
            referencedRelation: "clinica_usuarios"
            referencedColumns: ["clinica_id", "user_id"]
          },
          {
            foreignKeyName: "oricse_permissoes_usuario_permissao_codigo_fkey"
            columns: ["permissao_codigo"]
            isOneToOne: false
            referencedRelation: "oricse_permissoes"
            referencedColumns: ["codigo"]
          },
        ]
      }
      oricse_plano_funcionalidades: {
        Row: {
          funcionalidade_codigo: string
          permitido: boolean
          plano_id: string
        }
        Insert: {
          funcionalidade_codigo: string
          permitido?: boolean
          plano_id: string
        }
        Update: {
          funcionalidade_codigo?: string
          permitido?: boolean
          plano_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oricse_plano_funcionalidades_funcionalidade_codigo_fkey"
            columns: ["funcionalidade_codigo"]
            isOneToOne: false
            referencedRelation: "oricse_funcionalidades"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "oricse_plano_funcionalidades_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "oricse_planos"
            referencedColumns: ["id"]
          },
        ]
      }
      oricse_planos: {
        Row: {
          ativo: boolean
          codigo: string
          created_at: string
          descricao: string
          dominio_incluso: boolean
          id: string
          itens: Json
          nome: string
          ordem: number
          preco: string
          preco_anual: string
          preco_mensal: string
          publico_alvo: string
          updated_at: string
          usuarios_inclusos: number
        }
        Insert: {
          ativo?: boolean
          codigo: string
          created_at?: string
          descricao?: string
          dominio_incluso?: boolean
          id?: string
          itens?: Json
          nome: string
          ordem?: number
          preco?: string
          preco_anual?: string
          preco_mensal?: string
          publico_alvo?: string
          updated_at?: string
          usuarios_inclusos?: number
        }
        Update: {
          ativo?: boolean
          codigo?: string
          created_at?: string
          descricao?: string
          dominio_incluso?: boolean
          id?: string
          itens?: Json
          nome?: string
          ordem?: number
          preco?: string
          preco_anual?: string
          preco_mensal?: string
          publico_alvo?: string
          updated_at?: string
          usuarios_inclusos?: number
        }
        Relationships: []
      }
      oricse_portal_comandas: {
        Row: {
          aberta_em: string
          animal_id: string
          clinica_id: string
          finalizada_em: string | null
          id: string
          itens: Json
          numero: number
          origem: string
          pagamentos: Json
          saldo: number
          status: string
          total: number
          total_pago: number
          tutor_id: string
          updated_at: string
          visivel_tutor: boolean
        }
        Insert: {
          aberta_em: string
          animal_id: string
          clinica_id: string
          finalizada_em?: string | null
          id: string
          itens?: Json
          numero: number
          origem?: string
          pagamentos?: Json
          saldo?: number
          status: string
          total?: number
          total_pago?: number
          tutor_id: string
          updated_at?: string
          visivel_tutor?: boolean
        }
        Update: {
          aberta_em?: string
          animal_id?: string
          clinica_id?: string
          finalizada_em?: string | null
          id?: string
          itens?: Json
          numero?: number
          origem?: string
          pagamentos?: Json
          saldo?: number
          status?: string
          total?: number
          total_pago?: number
          tutor_id?: string
          updated_at?: string
          visivel_tutor?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "oricse_portal_comanda_animal_mesma_clinica_fkey"
            columns: ["clinica_id", "animal_id"]
            isOneToOne: false
            referencedRelation: "oricse_animais"
            referencedColumns: ["clinica_id", "id"]
          },
          {
            foreignKeyName: "oricse_portal_comanda_tutor_mesma_clinica_fkey"
            columns: ["clinica_id", "tutor_id"]
            isOneToOne: false
            referencedRelation: "tutores"
            referencedColumns: ["clinica_id", "id"]
          },
          {
            foreignKeyName: "oricse_portal_comandas_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      oricse_portal_convites: {
        Row: {
          clinica_id: string
          created_at: string
          criado_por: string | null
          expira_em: string
          id: string
          token_hash: string
          tutor_id: string
          usado_em: string | null
          usuario: string
          usuario_chave: string
        }
        Insert: {
          clinica_id: string
          created_at?: string
          criado_por?: string | null
          expira_em: string
          id?: string
          token_hash: string
          tutor_id: string
          usado_em?: string | null
          usuario: string
          usuario_chave: string
        }
        Update: {
          clinica_id?: string
          created_at?: string
          criado_por?: string | null
          expira_em?: string
          id?: string
          token_hash?: string
          tutor_id?: string
          usado_em?: string | null
          usuario?: string
          usuario_chave?: string
        }
        Relationships: [
          {
            foreignKeyName: "oricse_portal_convite_tutor_mesma_clinica_fkey"
            columns: ["clinica_id", "tutor_id"]
            isOneToOne: false
            referencedRelation: "tutores"
            referencedColumns: ["clinica_id", "id"]
          },
          {
            foreignKeyName: "oricse_portal_convites_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      oricse_portal_documentos: {
        Row: {
          animal_id: string
          clinica_id: string
          created_at: string
          data_documento: string | null
          drive_arquivo_id: string | null
          id: string
          observacoes: string | null
          tipo: string
          titulo: string
          updated_at: string
          visivel_tutor: boolean
        }
        Insert: {
          animal_id: string
          clinica_id: string
          created_at?: string
          data_documento?: string | null
          drive_arquivo_id?: string | null
          id?: string
          observacoes?: string | null
          tipo?: string
          titulo: string
          updated_at?: string
          visivel_tutor?: boolean
        }
        Update: {
          animal_id?: string
          clinica_id?: string
          created_at?: string
          data_documento?: string | null
          drive_arquivo_id?: string | null
          id?: string
          observacoes?: string | null
          tipo?: string
          titulo?: string
          updated_at?: string
          visivel_tutor?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "oricse_portal_documento_animal_mesma_clinica_fkey"
            columns: ["clinica_id", "animal_id"]
            isOneToOne: false
            referencedRelation: "oricse_animais"
            referencedColumns: ["clinica_id", "id"]
          },
          {
            foreignKeyName: "oricse_portal_documentos_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oricse_portal_documentos_drive_arquivo_id_fkey"
            columns: ["drive_arquivo_id"]
            isOneToOne: false
            referencedRelation: "drive_arquivos"
            referencedColumns: ["id"]
          },
        ]
      }
      oricse_portal_exames: {
        Row: {
          animal_id: string
          clinica_id: string
          created_at: string
          drive_arquivo_id: string | null
          id: string
          realizado_em: string | null
          resultado_resumo: string | null
          tipo: string
          titulo: string
          updated_at: string
          visivel_tutor: boolean
        }
        Insert: {
          animal_id: string
          clinica_id: string
          created_at?: string
          drive_arquivo_id?: string | null
          id?: string
          realizado_em?: string | null
          resultado_resumo?: string | null
          tipo?: string
          titulo: string
          updated_at?: string
          visivel_tutor?: boolean
        }
        Update: {
          animal_id?: string
          clinica_id?: string
          created_at?: string
          drive_arquivo_id?: string | null
          id?: string
          realizado_em?: string | null
          resultado_resumo?: string | null
          tipo?: string
          titulo?: string
          updated_at?: string
          visivel_tutor?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "oricse_portal_exame_animal_mesma_clinica_fkey"
            columns: ["clinica_id", "animal_id"]
            isOneToOne: false
            referencedRelation: "oricse_animais"
            referencedColumns: ["clinica_id", "id"]
          },
          {
            foreignKeyName: "oricse_portal_exames_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oricse_portal_exames_drive_arquivo_id_fkey"
            columns: ["drive_arquivo_id"]
            isOneToOne: false
            referencedRelation: "drive_arquivos"
            referencedColumns: ["id"]
          },
        ]
      }
      oricse_portal_extras: {
        Row: {
          clinica_id: string
          opcoes: Json
          updated_at: string
        }
        Insert: {
          clinica_id: string
          opcoes?: Json
          updated_at?: string
        }
        Update: {
          clinica_id?: string
          opcoes?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "oricse_portal_extras_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: true
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      oricse_portal_promocoes: {
        Row: {
          ativo: boolean
          clinica_id: string
          created_at: string
          cupom: string
          desconto_percentual: number
          descricao: string
          fim: string | null
          id: string
          inicio: string | null
          titulo: string
        }
        Insert: {
          ativo?: boolean
          clinica_id: string
          created_at?: string
          cupom?: string
          desconto_percentual?: number
          descricao?: string
          fim?: string | null
          id?: string
          inicio?: string | null
          titulo: string
        }
        Update: {
          ativo?: boolean
          clinica_id?: string
          created_at?: string
          cupom?: string
          desconto_percentual?: number
          descricao?: string
          fim?: string | null
          id?: string
          inicio?: string | null
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "oricse_portal_promocoes_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      oricse_portal_receitas: {
        Row: {
          animal_id: string
          clinica_id: string
          created_at: string
          drive_arquivo_id: string | null
          emitida_em: string
          id: string
          motivo_ocultacao: string | null
          motivo_outro: string | null
          numero: string | null
          resumo: string | null
          tipo: string
          titulo: string
          tutor_id: string
          updated_at: string
          visivel_tutor: boolean
        }
        Insert: {
          animal_id: string
          clinica_id: string
          created_at?: string
          drive_arquivo_id?: string | null
          emitida_em?: string
          id?: string
          motivo_ocultacao?: string | null
          motivo_outro?: string | null
          numero?: string | null
          resumo?: string | null
          tipo?: string
          titulo?: string
          tutor_id: string
          updated_at?: string
          visivel_tutor?: boolean
        }
        Update: {
          animal_id?: string
          clinica_id?: string
          created_at?: string
          drive_arquivo_id?: string | null
          emitida_em?: string
          id?: string
          motivo_ocultacao?: string | null
          motivo_outro?: string | null
          numero?: string | null
          resumo?: string | null
          tipo?: string
          titulo?: string
          tutor_id?: string
          updated_at?: string
          visivel_tutor?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "oricse_portal_receita_animal_mesma_clinica_fkey"
            columns: ["clinica_id", "animal_id"]
            isOneToOne: false
            referencedRelation: "oricse_animais"
            referencedColumns: ["clinica_id", "id"]
          },
          {
            foreignKeyName: "oricse_portal_receita_tutor_mesma_clinica_fkey"
            columns: ["clinica_id", "tutor_id"]
            isOneToOne: false
            referencedRelation: "tutores"
            referencedColumns: ["clinica_id", "id"]
          },
          {
            foreignKeyName: "oricse_portal_receitas_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oricse_portal_receitas_drive_arquivo_id_fkey"
            columns: ["drive_arquivo_id"]
            isOneToOne: false
            referencedRelation: "drive_arquivos"
            referencedColumns: ["id"]
          },
        ]
      }
      oricse_portal_tutor_config: {
        Row: {
          clinica_id: string
          exibir_agendamento: boolean
          exibir_documentos: boolean
          instrucoes_agendamento: string
          mensagem_boas_vindas: string
          telefone_publico: string
          updated_at: string
          whatsapp_publico: string
        }
        Insert: {
          clinica_id: string
          exibir_agendamento?: boolean
          exibir_documentos?: boolean
          instrucoes_agendamento?: string
          mensagem_boas_vindas?: string
          telefone_publico?: string
          updated_at?: string
          whatsapp_publico?: string
        }
        Update: {
          clinica_id?: string
          exibir_agendamento?: boolean
          exibir_documentos?: boolean
          instrucoes_agendamento?: string
          mensagem_boas_vindas?: string
          telefone_publico?: string
          updated_at?: string
          whatsapp_publico?: string
        }
        Relationships: [
          {
            foreignKeyName: "oricse_portal_tutor_config_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: true
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      oricse_portal_tutores: {
        Row: {
          ativo: boolean
          auth_user_id: string | null
          clinica_id: string
          clinica_slug: string | null
          convite_expira_em: string | null
          convite_token_hash: string | null
          created_at: string
          id: string
          tutor_id: string
          ultimo_acesso_em: string | null
          updated_at: string
          usuario: string
          usuario_chave: string
        }
        Insert: {
          ativo?: boolean
          auth_user_id?: string | null
          clinica_id: string
          clinica_slug?: string | null
          convite_expira_em?: string | null
          convite_token_hash?: string | null
          created_at?: string
          id?: string
          tutor_id: string
          ultimo_acesso_em?: string | null
          updated_at?: string
          usuario: string
          usuario_chave: string
        }
        Update: {
          ativo?: boolean
          auth_user_id?: string | null
          clinica_id?: string
          clinica_slug?: string | null
          convite_expira_em?: string | null
          convite_token_hash?: string | null
          created_at?: string
          id?: string
          tutor_id?: string
          ultimo_acesso_em?: string | null
          updated_at?: string
          usuario?: string
          usuario_chave?: string
        }
        Relationships: []
      }
      oricse_portal_vacinas: {
        Row: {
          animal_id: string
          aplicada_em: string | null
          clinica_id: string
          created_at: string
          id: string
          lote: string | null
          nome: string
          observacoes: string | null
          reforco_em: string | null
          updated_at: string
          visivel_tutor: boolean
        }
        Insert: {
          animal_id: string
          aplicada_em?: string | null
          clinica_id: string
          created_at?: string
          id?: string
          lote?: string | null
          nome: string
          observacoes?: string | null
          reforco_em?: string | null
          updated_at?: string
          visivel_tutor?: boolean
        }
        Update: {
          animal_id?: string
          aplicada_em?: string | null
          clinica_id?: string
          created_at?: string
          id?: string
          lote?: string | null
          nome?: string
          observacoes?: string | null
          reforco_em?: string | null
          updated_at?: string
          visivel_tutor?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "oricse_portal_vacina_animal_mesma_clinica_fkey"
            columns: ["clinica_id", "animal_id"]
            isOneToOne: false
            referencedRelation: "oricse_animais"
            referencedColumns: ["clinica_id", "id"]
          },
          {
            foreignKeyName: "oricse_portal_vacinas_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      oricse_precos_portal: {
        Row: {
          area: string
          ativo: boolean
          catalogo_item_id: string | null
          clinica_id: string
          cobrar_portal: boolean
          id: string
          modo: string
          titulo: string
          updated_at: string
          valor_centavos: number
          valor_comanda_centavos: number | null
        }
        Insert: {
          area?: string
          ativo?: boolean
          catalogo_item_id?: string | null
          clinica_id: string
          cobrar_portal?: boolean
          id?: string
          modo: string
          titulo: string
          updated_at?: string
          valor_centavos: number
          valor_comanda_centavos?: number | null
        }
        Update: {
          area?: string
          ativo?: boolean
          catalogo_item_id?: string | null
          clinica_id?: string
          cobrar_portal?: boolean
          id?: string
          modo?: string
          titulo?: string
          updated_at?: string
          valor_centavos?: number
          valor_comanda_centavos?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "oricse_precos_portal_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      oricse_preferencias_usuario: {
        Row: {
          menu_lateral_fixo: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          menu_lateral_fixo?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          menu_lateral_fixo?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      oricse_receitas_controladas: {
        Row: {
          ano: number
          clinica_id: string
          criado_em: string
          dados: Json
          id: string
          numero: string
          sequencia: number
          usuario_id: string
        }
        Insert: {
          ano: number
          clinica_id: string
          criado_em?: string
          dados: Json
          id?: string
          numero: string
          sequencia: number
          usuario_id: string
        }
        Update: {
          ano?: number
          clinica_id?: string
          criado_em?: string
          dados?: Json
          id?: string
          numero?: string
          sequencia?: number
          usuario_id?: string
        }
        Relationships: []
      }
      oricse_regras_comissao: {
        Row: {
          clinica_id: string
          created_at: string
          criado_por: string | null
          dia_semana: number | null
          id: string
          item_id: string | null
          percentual: number
          updated_at: string
        }
        Insert: {
          clinica_id: string
          created_at?: string
          criado_por?: string | null
          dia_semana?: number | null
          id?: string
          item_id?: string | null
          percentual: number
          updated_at?: string
        }
        Update: {
          clinica_id?: string
          created_at?: string
          criado_por?: string | null
          dia_semana?: number | null
          id?: string
          item_id?: string | null
          percentual?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "oricse_regras_comissao_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oricse_regras_comissao_clinica_id_item_id_fkey"
            columns: ["clinica_id", "item_id"]
            isOneToOne: false
            referencedRelation: "oricse_catalogo_itens"
            referencedColumns: ["clinica_id", "id"]
          },
        ]
      }
      oricse_remuneracao_funcionario: {
        Row: {
          clinica_id: string
          created_at: string
          criado_por: string | null
          funcionario_id: string
          id: string
          percentual: number
          servico_id: string
          updated_at: string
        }
        Insert: {
          clinica_id: string
          created_at?: string
          criado_por?: string | null
          funcionario_id: string
          id?: string
          percentual: number
          servico_id: string
          updated_at?: string
        }
        Update: {
          clinica_id?: string
          created_at?: string
          criado_por?: string | null
          funcionario_id?: string
          id?: string
          percentual?: number
          servico_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "oricse_remuneracao_funcionario_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oricse_remuneracao_funcionario_clinica_id_funcionario_id_fkey"
            columns: ["clinica_id", "funcionario_id"]
            isOneToOne: false
            referencedRelation: "clinica_usuarios"
            referencedColumns: ["clinica_id", "user_id"]
          },
          {
            foreignKeyName: "oricse_remuneracao_funcionario_clinica_id_servico_id_fkey"
            columns: ["clinica_id", "servico_id"]
            isOneToOne: false
            referencedRelation: "oricse_catalogo_itens"
            referencedColumns: ["clinica_id", "id"]
          },
        ]
      }
      oricse_rotas_personalizadas: {
        Row: {
          atualizado_em: string
          atualizado_por: string
          rota_original: string
          rota_publica: string
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string
          rota_original: string
          rota_publica: string
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string
          rota_original?: string
          rota_publica?: string
        }
        Relationships: []
      }
      oricse_taxas_modalidade: {
        Row: {
          ativo: boolean
          clinica_id: string | null
          id: string
          modalidade: string
          mp_fixo_centavos: number
          mp_percentual: number
          oricse_percentual: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          clinica_id?: string | null
          id?: string
          modalidade: string
          mp_fixo_centavos?: number
          mp_percentual: number
          oricse_percentual: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          clinica_id?: string | null
          id?: string
          modalidade?: string
          mp_fixo_centavos?: number
          mp_percentual?: number
          oricse_percentual?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "oricse_taxas_modalidade_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      oricse_taxas_pagamento: {
        Row: {
          ativo: boolean
          clinica_id: string | null
          created_at: string
          id: string
          taxa_mercado_pago_fixa: number
          taxa_mercado_pago_percentual: number
          taxa_oricse_percentual: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          ativo?: boolean
          clinica_id?: string | null
          created_at?: string
          id?: string
          taxa_mercado_pago_fixa?: number
          taxa_mercado_pago_percentual?: number
          taxa_oricse_percentual?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          ativo?: boolean
          clinica_id?: string | null
          created_at?: string
          id?: string
          taxa_mercado_pago_fixa?: number
          taxa_mercado_pago_percentual?: number
          taxa_oricse_percentual?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "oricse_taxas_pagamento_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      oricse_termos: {
        Row: {
          ativo: boolean
          conteudo: string
          criado_em: string
          id: string
          obrigatorio: boolean
          titulo: string
          versao: string
        }
        Insert: {
          ativo?: boolean
          conteudo: string
          criado_em?: string
          id?: string
          obrigatorio?: boolean
          titulo: string
          versao: string
        }
        Update: {
          ativo?: boolean
          conteudo?: string
          criado_em?: string
          id?: string
          obrigatorio?: boolean
          titulo?: string
          versao?: string
        }
        Relationships: []
      }
      oricse_termos_aceites: {
        Row: {
          aceito_em: string
          clinica_id: string
          termo_id: string
          usuario_id: string
        }
        Insert: {
          aceito_em?: string
          clinica_id: string
          termo_id: string
          usuario_id: string
        }
        Update: {
          aceito_em?: string
          clinica_id?: string
          termo_id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oricse_termos_aceites_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oricse_termos_aceites_termo_id_fkey"
            columns: ["termo_id"]
            isOneToOne: false
            referencedRelation: "oricse_termos"
            referencedColumns: ["id"]
          },
        ]
      }
      page_editor_pages: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          published_at: string | null
          slug: string
          status: string
          structure: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          published_at?: string | null
          slug: string
          status?: string
          structure?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          published_at?: string | null
          slug?: string
          status?: string
          structure?: Json
          updated_at?: string
        }
        Relationships: []
      }
      sync_salas: {
        Row: {
          atualizado_em: string
          codigo_hash: string
          dados: Json
        }
        Insert: {
          atualizado_em?: string
          codigo_hash: string
          dados?: Json
        }
        Update: {
          atualizado_em?: string
          codigo_hash?: string
          dados?: Json
        }
        Relationships: []
      }
      transferencias: {
        Row: {
          codigo: string
          criado_em: string
          dados: Json
          expira_em: string
          id: string
        }
        Insert: {
          codigo: string
          criado_em?: string
          dados: Json
          expira_em?: string
          id?: string
        }
        Update: {
          codigo?: string
          criado_em?: string
          dados?: Json
          expira_em?: string
          id?: string
        }
        Relationships: []
      }
      tutores: {
        Row: {
          clinica_id: string
          codigo_numero: number
          codigo_publico: string
          cpf: string
          cpf_digitos: string
          created_at: string
          criado_por: string | null
          dados: Json
          email: string | null
          id: string
          nome: string
          nome_chave: string
          outro_telefone: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          clinica_id: string
          codigo_numero: number
          codigo_publico: string
          cpf: string
          cpf_digitos: string
          created_at?: string
          criado_por?: string | null
          dados?: Json
          email?: string | null
          id?: string
          nome: string
          nome_chave: string
          outro_telefone?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          clinica_id?: string
          codigo_numero?: number
          codigo_publico?: string
          cpf?: string
          cpf_digitos?: string
          created_at?: string
          criado_por?: string | null
          dados?: Json
          email?: string | null
          id?: string
          nome?: string
          nome_chave?: string
          outro_telefone?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutores_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_active_admin: { Args: { _user_id: string }; Returns: boolean }
      oricse_animal_cadastro_tela: {
        Args: { p_animal?: string; p_clinica: string; p_tutor?: string }
        Returns: Json
      }
      oricse_animal_historico: {
        Args: {
          p_animal: string
          p_data?: string
          p_detalhe?: string
          p_peso?: number
          p_tipo?: string
          p_titulo?: string
        }
        Returns: Json
      }
      oricse_animal_salvar_tela: {
        Args: {
          p_animal: string
          p_clinica: string
          p_dados: Json
          p_tutor: string
        }
        Returns: string
      }
      oricse_backup_ack: {
        Args: { p_error?: string; p_id: string; p_success: boolean }
        Returns: undefined
      }
      oricse_backup_claim: {
        Args: { p_limit?: number }
        Returns: {
          clinica_id: string | null
          copiado_em: string | null
          criado_em: string
          dados: Json | null
          erro_ultimo: string | null
          id: string
          lease_ate: string | null
          operacao: string
          origem_tabela: string
          proxima_tentativa_em: string
          registro_chave: string
          tentativas: number
        }[]
        SetofOptions: {
          from: "*"
          to: "oricse_drive_backup_outbox"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      oricse_clinica_ativa_definir: {
        Args: { p_clinica: string }
        Returns: string
      }
      oricse_clinica_ativa_obter: { Args: never; Returns: string }
      oricse_clinica_publica_portal: {
        Args: { p_host?: string; p_slug?: string }
        Returns: {
          clinica_id: string
          clinica_logo_url: string
          clinica_nome: string
          clinica_slug: string
        }[]
      }
      oricse_clinica_tem_funcionalidade: {
        Args: { p_clinica_id: string; p_codigo: string }
        Returns: boolean
      }
      oricse_configurar_pagamento_catalogo: {
        Args: {
          p_catalogo_item_id: string
          p_cobrar_portal: boolean
          p_modo: string
          p_titulo: string
          p_valor_online: number
          p_valor_referencia: number
        }
        Returns: string
      }
      oricse_configurar_site_clinica: {
        Args: { p_dominio?: string; p_slug: string }
        Returns: {
          clinica_dominio: string
          clinica_slug: string
        }[]
      }
      oricse_configurar_taxa_pagamento: {
        Args: {
          p_clinica_id: string
          p_modalidade: string
          p_mp_fixo_centavos: number
          p_mp_percentual: number
          p_oricse_percentual: number
        }
        Returns: undefined
      }
      oricse_contexto_clinica_atual: {
        Args: never
        Returns: {
          clinica_dominio: string
          clinica_id: string
          clinica_logo_url: string
          clinica_nome: string
          clinica_slug: string
        }[]
      }
      oricse_criar_agendamento_online: {
        Args: { p_agenda: string; p_animal: string; p_inicio: string }
        Returns: string
      }
      oricse_crm_criar_evento_interno: {
        Args: {
          p_agendado_para: string
          p_animal: string
          p_clinica_id: string
          p_data_referencia: string
          p_dedupe: string
          p_hora: string
          p_metadados?: Json
          p_servico: string
          p_tipo: string
          p_tutor: Json
        }
        Returns: number
      }
      oricse_crm_data_aniversario: {
        Args: { p_ano: number; p_nascimento: string }
        Returns: string
      }
      oricse_crm_parse_date: { Args: { p_text: string }; Returns: string }
      oricse_crm_preparar_fila_interno: {
        Args: { p_clinica_id: string }
        Returns: number
      }
      oricse_crm_processar_clinica: {
        Args: { p_clinica_id: string }
        Returns: number
      }
      oricse_crm_processar_clinica_interno: {
        Args: { p_clinica_id: string }
        Returns: number
      }
      oricse_crm_processar_todas: { Args: never; Returns: number }
      oricse_crm_template: {
        Args: { p_text: string; p_vars: Json }
        Returns: string
      }
      oricse_definir_permissao_usuario: {
        Args: {
          p_clinica_id: string
          p_codigo: string
          p_permitido: boolean
          p_user_id: string
        }
        Returns: undefined
      }
      oricse_emitir_receita_controlada: {
        Args: { p_dados: Json }
        Returns: string
      }
      oricse_fila_operar: {
        Args: {
          p_acao: string
          p_animal?: string
          p_chegada?: string
          p_clinica: string
          p_item?: string
          p_motivo?: string
          p_tutor?: string
        }
        Returns: string
      }
      oricse_fila_tela: { Args: { p_clinica: string }; Returns: Json }
      oricse_funcionalidades_efetivas: {
        Args: { p_clinica_id: string }
        Returns: {
          codigo: string
          grupo: string
          nome: string
          ordem: number
          origem: string
          permitido: boolean
          plano_codigo: string
          plano_nome: string
        }[]
      }
      oricse_identity_can_manage_clinic: {
        Args: { p_clinica: string }
        Returns: boolean
      }
      oricse_identity_is_platform_admin: { Args: never; Returns: boolean }
      oricse_identity_member_of: {
        Args: { p_clinica: string }
        Returns: boolean
      }
      oricse_identity_profile_visible: {
        Args: { p_user: string }
        Returns: boolean
      }
      oricse_iniciar_contratacao: { Args: { p_dados: Json }; Returns: Json }
      oricse_iniciar_teste_gratis: { Args: { p_dados: Json }; Returns: Json }
      oricse_is_platform_admin: { Args: never; Returns: boolean }
      oricse_limite_usuarios_clinica: {
        Args: { p_clinica_id: string }
        Returns: number
      }
      oricse_listar_cobrancas_integradas: {
        Args: never
        Returns: {
          ativo: boolean
          cobrar_portal: boolean
          id: string
          modo: string
          titulo: string
          valor_centavos: number
          valor_comanda_centavos: number
        }[]
      }
      oricse_listar_pagamentos_catalogo: {
        Args: never
        Returns: {
          catalogo_item_id: string
          cobrar_portal: boolean
          modo: string
          valor_centavos: number
        }[]
      }
      oricse_listar_precos_portal: {
        Args: never
        Returns: {
          area: string
          ativo: boolean
          id: string
          modo: string
          titulo: string
          valor_centavos: number
        }[]
      }
      oricse_listar_taxas_pagamento: {
        Args: never
        Returns: {
          clinica_id: string
          modalidade: string
          mp_fixo_centavos: number
          mp_percentual: number
          oricse_percentual: number
        }[]
      }
      oricse_meu_acesso: {
        Args: never
        Returns: {
          dias_restantes: number
          teste_ativo: boolean
          teste_expirado: boolean
        }[]
      }
      oricse_movimentar_estoque: {
        Args: { p_clinica_id: string; p_delta: number; p_item_id: string }
        Returns: number
      }
      oricse_my_clinic_context: {
        Args: never
        Returns: {
          clinica_id: string
          clinica_nome: string
        }[]
      }
      oricse_normalizar_nome: { Args: { valor: string }; Returns: string }
      oricse_normalizar_usuario_portal: {
        Args: { p_usuario: string }
        Returns: string
      }
      oricse_numero_seguro: { Args: { valor: string }; Returns: number }
      oricse_perfil_usuario_visivel: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      oricse_permissoes_efetivas: {
        Args: { p_clinica_id: string; p_user_id?: string }
        Returns: {
          codigo: string
          descricao: string
          grupo: string
          nome: string
          ordem: number
          origem: string
          permitido: boolean
        }[]
      }
      oricse_plano_permite: {
        Args: { p_clinica_id: string; p_codigo: string }
        Returns: boolean
      }
      oricse_pode_editar_configuracoes_clinica: {
        Args: { p_clinica_id: string }
        Returns: boolean
      }
      oricse_pode_excluir_tutor: {
        Args: { p_clinica_id: string }
        Returns: boolean
      }
      oricse_pode_gerenciar_pagamentos: {
        Args: { p_clinica: string }
        Returns: boolean
      }
      oricse_pode_gerenciar_permissoes: {
        Args: { p_clinica_id: string }
        Returns: boolean
      }
      oricse_pode_visualizar_pagamentos: {
        Args: { p_clinica: string }
        Returns: boolean
      }
      oricse_portal_agendas: {
        Args: never
        Returns: {
          antecedencia_horas: number
          cor: string
          dias_semana: number[]
          fim: string
          id: string
          inicio: string
          intervalo_min: number
          modalidade: string
          nome: string
          responsavel: string
          timezone: string
          tipo: string
        }[]
      }
      oricse_portal_atualizar_perfil: {
        Args: { p_email: string; p_telefone: string }
        Returns: undefined
      }
      oricse_portal_config_gerenciar: {
        Args: {
          p_agendamento?: boolean
          p_clinica_id: string
          p_documentos?: boolean
          p_instrucoes?: string
          p_mensagem?: string
          p_telefone?: string
          p_whatsapp?: string
        }
        Returns: Json
      }
      oricse_portal_config_publica: { Args: { p_slug: string }; Returns: Json }
      oricse_portal_criar_agendamento: {
        Args: {
          p_agenda_id: string
          p_animal_id: string
          p_inicio: string
          p_observacoes?: string
        }
        Returns: {
          agendamento_id: string
          estado: string
        }[]
      }
      oricse_portal_emitir_convite: {
        Args: { p_tutor_id: string; p_usuario: string }
        Returns: {
          clinica_slug: string
          expira_em: string
          token: string
          usuario: string
        }[]
      }
      oricse_portal_extras_publicas: { Args: { p_slug: string }; Returns: Json }
      oricse_portal_horarios_disponiveis: {
        Args: { p_agenda_id: string; p_data: string }
        Returns: {
          fim: string
          inicio: string
          rotulo: string
        }[]
      }
      oricse_portal_identidade_atual: {
        Args: never
        Returns: {
          clinica_id: string
          portal_id: string
          tutor_id: string
          usuario: string
        }[]
      }
      oricse_portal_meu_contexto: {
        Args: never
        Returns: {
          clinica_id: string
          clinica_logo_url: string
          clinica_nome: string
          clinica_slug: string
          tutor_email: string
          tutor_id: string
          tutor_nome: string
          tutor_telefone: string
          usuario: string
        }[]
      }
      oricse_portal_painel: {
        Args: {
          p_agenda_ativa?: boolean
          p_agenda_id?: string
          p_clinica: string
          p_opcoes?: Json
          p_promocao?: Json
        }
        Returns: Json
      }
      oricse_portal_pode_acessar_clinica: {
        Args: { p_clinica_id: string }
        Returns: boolean
      }
      oricse_portal_promocao_publicar: {
        Args: { p_clinica: string; p_promocao: string; p_publicar: boolean }
        Returns: undefined
      }
      oricse_portal_tutor_clinica: {
        Args: { p_slug: string }
        Returns: {
          logo_url: string
          nome: string
          slug: string
        }[]
      }
      oricse_previsualizar_cobranca: {
        Args: {
          p_modalidade?: string
          p_modo: string
          p_valor_centavos: number
        }
        Returns: {
          cobrado_tutor_centavos: number
          comissao_oricse_centavos: number
          desconto_mp_centavos: number
          liquido_clinica_centavos: number
        }[]
      }
      oricse_registrar_atividade: {
        Args: { p_acao: string; p_clinica: string }
        Returns: string
      }
      oricse_resolver_clinica_cadastro_animal: {
        Args: { p_animal?: string; p_tutor?: string }
        Returns: string
      }
      oricse_restaurar_permissao_usuario: {
        Args: { p_clinica_id: string; p_codigo: string; p_user_id: string }
        Returns: undefined
      }
      oricse_salvar_cobranca_integrada: {
        Args: {
          p_cobrar_portal: boolean
          p_id: string
          p_modo: string
          p_titulo: string
          p_valor_comanda: number
          p_valor_online: number
        }
        Returns: string
      }
      oricse_salvar_preco_portal: {
        Args: {
          p_area?: string
          p_id: string
          p_modo: string
          p_titulo: string
          p_valor_centavos: number
        }
        Returns: string
      }
      oricse_tem_funcionalidade: {
        Args: { p_clinica: string; p_funcionalidade: string }
        Returns: boolean
      }
      oricse_tutor_salvar_tela: {
        Args: { p_clinica: string; p_dados: Json; p_id?: string }
        Returns: string
      }
      oricse_tutores_tela: { Args: { p_clinica: string }; Returns: Json }
      oricse_usuario_na_clinica: {
        Args: { p_clinica_id: string }
        Returns: boolean
      }
      oricse_usuario_pode_acessar_portal: {
        Args: { p_clinica_id: string }
        Returns: boolean
      }
      oricse_usuario_pode_permissao: {
        Args: { p_clinica_id: string; p_codigo: string }
        Returns: boolean
      }
      oricse_validar_codigo_promocional: {
        Args: {
          p_codigo: string
          p_documento: string
          p_plano_codigo: string
          p_valor_base: number
        }
        Returns: Json
      }
      oricse_verificar_funcionalidade: {
        Args: { p_clinica: string; p_funcionalidade: string }
        Returns: undefined
      }
      set_my_clinic_agenda_settings: {
        Args: { p_durations: Json; p_interval_minutes: number }
        Returns: undefined
      }
      unaccent: { Args: { "": string }; Returns: string }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
