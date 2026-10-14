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
          username: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          role?: string
          user_id: string
          username: string
        }
        Update: {
          created_at?: string
          email?: string | null
          role?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      clinica_acesso_principal: {
        Row: {
          clinica_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          clinica_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          clinica_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clinica_acesso_principal_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: true
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "clinica_usuarios_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      clinicas: {
        Row: {
          acesso_ate: string | null
          ciclo_pagamento: string
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
          trial_ends_at: string | null
          trial_started_at: string | null
          ultimo_pagamento_em: string | null
          updated_at: string
        }
        Insert: {
          acesso_ate?: string | null
          ciclo_pagamento?: string
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
          trial_ends_at?: string | null
          trial_started_at?: string | null
          ultimo_pagamento_em?: string | null
          updated_at?: string
        }
        Update: {
          acesso_ate?: string | null
          ciclo_pagamento?: string
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
          trial_ends_at?: string | null
          trial_started_at?: string | null
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
      oricse_codigo_promocional_usos: {
        Row: {
          codigo_id: string
          contratacao_id: string | null
          created_at: string
          desconto_aplicado: number
          documento_hash: string | null
          id: string
        }
        Insert: {
          codigo_id: string
          contratacao_id?: string | null
          created_at?: string
          desconto_aplicado?: number
          documento_hash?: string | null
          id?: string
        }
        Update: {
          codigo_id?: string
          contratacao_id?: string | null
          created_at?: string
          desconto_aplicado?: number
          documento_hash?: string | null
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
          ciclo: string
          clinica_bairro: string
          clinica_cep: string
          clinica_cidade: string
          clinica_complemento: string | null
          clinica_email: string
          clinica_endereco: string
          clinica_nome: string
          clinica_numero: string
          clinica_telefone: string
          clinica_uf: string
          cnpj: string
          created_at: string
          dominio: string | null
          id: string
          observacoes: string | null
          pagamento_aprovado_em: string | null
          pagamento_id: string | null
          pagamento_provedor: string | null
          plano_codigo: string
          plano_nome: string
          promo_codigo: string | null
          promo_desconto: number | null
          promo_duracao: string | null
          promo_valor_final: number | null
          promo_valor_original: number | null
          public_token: string
          quantidade_usuarios: number
          razao_social: string | null
          responsavel_bairro: string
          responsavel_cep: string
          responsavel_cidade: string
          responsavel_complemento: string | null
          responsavel_cpf: string
          responsavel_crmv: string
          responsavel_crmv_uf: string
          responsavel_email: string
          responsavel_endereco: string
          responsavel_nome: string
          responsavel_numero: string
          responsavel_telefone: string
          responsavel_uf: string
          slug_desejado: string | null
          status: string
          tipo_operacao: string | null
          updated_at: string
          valor_exibido: string | null
        }
        Insert: {
          aceitou_privacidade?: boolean
          aceitou_termos?: boolean
          ciclo: string
          clinica_bairro: string
          clinica_cep: string
          clinica_cidade: string
          clinica_complemento?: string | null
          clinica_email: string
          clinica_endereco: string
          clinica_nome: string
          clinica_numero: string
          clinica_telefone: string
          clinica_uf: string
          cnpj: string
          created_at?: string
          dominio?: string | null
          id?: string
          observacoes?: string | null
          pagamento_aprovado_em?: string | null
          pagamento_id?: string | null
          pagamento_provedor?: string | null
          plano_codigo: string
          plano_nome: string
          promo_codigo?: string | null
          promo_desconto?: number | null
          promo_duracao?: string | null
          promo_valor_final?: number | null
          promo_valor_original?: number | null
          public_token?: string
          quantidade_usuarios?: number
          razao_social?: string | null
          responsavel_bairro: string
          responsavel_cep: string
          responsavel_cidade: string
          responsavel_complemento?: string | null
          responsavel_cpf: string
          responsavel_crmv: string
          responsavel_crmv_uf: string
          responsavel_email: string
          responsavel_endereco: string
          responsavel_nome: string
          responsavel_numero: string
          responsavel_telefone: string
          responsavel_uf: string
          slug_desejado?: string | null
          status?: string
          tipo_operacao?: string | null
          updated_at?: string
          valor_exibido?: string | null
        }
        Update: {
          aceitou_privacidade?: boolean
          aceitou_termos?: boolean
          ciclo?: string
          clinica_bairro?: string
          clinica_cep?: string
          clinica_cidade?: string
          clinica_complemento?: string | null
          clinica_email?: string
          clinica_endereco?: string
          clinica_nome?: string
          clinica_numero?: string
          clinica_telefone?: string
          clinica_uf?: string
          cnpj?: string
          created_at?: string
          dominio?: string | null
          id?: string
          observacoes?: string | null
          pagamento_aprovado_em?: string | null
          pagamento_id?: string | null
          pagamento_provedor?: string | null
          plano_codigo?: string
          plano_nome?: string
          promo_codigo?: string | null
          promo_desconto?: number | null
          promo_duracao?: string | null
          promo_valor_final?: number | null
          promo_valor_original?: number | null
          public_token?: string
          quantidade_usuarios?: number
          razao_social?: string | null
          responsavel_bairro?: string
          responsavel_cep?: string
          responsavel_cidade?: string
          responsavel_complemento?: string | null
          responsavel_cpf?: string
          responsavel_crmv?: string
          responsavel_crmv_uf?: string
          responsavel_email?: string
          responsavel_endereco?: string
          responsavel_nome?: string
          responsavel_numero?: string
          responsavel_telefone?: string
          responsavel_uf?: string
          slug_desejado?: string | null
          status?: string
          tipo_operacao?: string | null
          updated_at?: string
          valor_exibido?: string | null
        }
        Relationships: []
      }
      oricse_planos: {
        Row: {
          ativo: boolean
          cobranca_anual: boolean
          cobranca_mensal: boolean
          codigo: string
          descricao: string
          dominio_incluso: boolean
          id: string
          itens: Json
          nome: string
          ordem: number
          preco: string
          preco_anual: string | null
          preco_mensal: string | null
          publico_alvo: string
          updated_at: string
          usuarios_inclusos: number
        }
        Insert: {
          ativo?: boolean
          cobranca_anual?: boolean
          cobranca_mensal?: boolean
          codigo: string
          descricao?: string
          dominio_incluso?: boolean
          id?: string
          itens?: Json
          nome: string
          ordem?: number
          preco?: string
          preco_anual?: string | null
          preco_mensal?: string | null
          publico_alvo?: string
          updated_at?: string
          usuarios_inclusos?: number
        }
        Update: {
          ativo?: boolean
          cobranca_anual?: boolean
          cobranca_mensal?: boolean
          codigo?: string
          descricao?: string
          dominio_incluso?: boolean
          id?: string
          itens?: Json
          nome?: string
          ordem?: number
          preco?: string
          preco_anual?: string | null
          preco_mensal?: string | null
          publico_alvo?: string
          updated_at?: string
          usuarios_inclusos?: number
        }
        Relationships: []
      }
      oricse_trial_documentos: {
        Row: {
          contratacao_id: string | null
          documento_hash: string
          id: string
          ultimos4: string
          usado_em: string
        }
        Insert: {
          contratacao_id?: string | null
          documento_hash: string
          id?: string
          ultimos4: string
          usado_em?: string
        }
        Update: {
          contratacao_id?: string | null
          documento_hash?: string
          id?: string
          ultimos4?: string
          usado_em?: string
        }
        Relationships: [
          {
            foreignKeyName: "oricse_trial_documentos_contratacao_id_fkey"
            columns: ["contratacao_id"]
            isOneToOne: true
            referencedRelation: "oricse_contratacoes"
            referencedColumns: ["id"]
          },
        ]
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      oricse_iniciar_contratacao: {
        Args: { p_dados: Json }
        Returns: {
          id: string
          public_token: string
          status: string
        }[]
      }
      oricse_iniciar_teste_gratis: {
        Args: { p_dados: Json }
        Returns: {
          id: string
          public_token: string
          status: string
        }[]
      }
      oricse_meu_acesso: {
        Args: never
        Returns: {
          dias_restantes: number
          plano: string
          teste_ativo: boolean
          teste_expirado: boolean
          teste_fim_em: string
        }[]
      }
      oricse_registrar_uso_promocional: {
        Args: { p_codigo: string; p_contratacao_id: string }
        Returns: undefined
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
      set_my_clinic_agenda_settings: {
        Args: { p_durations: Json; p_interval_minutes: number }
        Returns: Json
      }
      set_my_clinic_appointment_duration: {
        Args: { p_minutes: number }
        Returns: number
      }
      vetericio_bootstrap_open: { Args: never; Returns: boolean }
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
