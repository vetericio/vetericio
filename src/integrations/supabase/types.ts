export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      sync_salas: {
        Row: {
          atualizado_em: string;
          codigo_hash: string;
          dados: Json;
        };
        Insert: {
          atualizado_em?: string;
          codigo_hash: string;
          dados?: Json;
        };
        Update: {
          atualizado_em?: string;
          codigo_hash?: string;
          dados?: Json;
        };
        Relationships: [];
      };
      transferencias: {
        Row: {
          codigo: string;
          criado_em: string;
          dados: Json;
          expira_em: string;
          id: string;
        };
        Insert: {
          codigo: string;
          criado_em?: string;
          dados: Json;
          expira_em?: string;
          id?: string;
        };
        Update: {
          codigo?: string;
          criado_em?: string;
          dados?: Json;
          expira_em?: string;
          id?: string;
        };
        Relationships: [];
      };
      clinica_usuarios: {
        Row: {
          clinica_id: string;
          user_id: string;
          papel: string;
          ativo: boolean;
          created_at: string;
        };
        Insert: {
          clinica_id: string;
          user_id: string;
          papel?: string;
          ativo?: boolean;
          created_at?: string;
        };
        Update: {
          clinica_id?: string;
          user_id?: string;
          papel?: string;
          ativo?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      app_users: {
        Row: {
          user_id: string;
          username: string | null;
          email: string | null;
          role: string | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          username?: string | null;
          email?: string | null;
          role?: string | null;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          username?: string | null;
          email?: string | null;
          role?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      oricse_catalogo_itens: {
        Row: {
          id: string;
          clinica_id: string;
          tipo: string;
          nome: string;
          categoria: string;
          valor: number;
          estoque_atual: number | null;
          estoque_minimo: number | null;
          ativo: boolean;
          criado_por: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          clinica_id: string;
          tipo: string;
          nome: string;
          categoria?: string;
          valor: number;
          estoque_atual?: number | null;
          estoque_minimo?: number | null;
          ativo?: boolean;
          criado_por?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          clinica_id?: string;
          tipo?: string;
          nome?: string;
          categoria?: string;
          valor?: number;
          estoque_atual?: number | null;
          estoque_minimo?: number | null;
          ativo?: boolean;
          criado_por?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      oricse_regras_comissao: {
        Row: {
          id: string;
          clinica_id: string;
          item_id: string | null;
          dia_semana: number | null;
          percentual: number;
          criado_por: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          clinica_id: string;
          item_id?: string | null;
          dia_semana?: number | null;
          percentual: number;
          criado_por?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          clinica_id?: string;
          item_id?: string | null;
          dia_semana?: number | null;
          percentual?: number;
          criado_por?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      oricse_remuneracao_funcionario: {
        Row: {
          id: string;
          clinica_id: string;
          funcionario_id: string;
          servico_id: string;
          percentual: number;
          criado_por: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          clinica_id: string;
          funcionario_id: string;
          servico_id: string;
          percentual: number;
          criado_por?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          clinica_id?: string;
          funcionario_id?: string;
          servico_id?: string;
          percentual?: number;
          criado_por?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      oricse_clinica_publica_portal: {
        Args: { p_host?: string | null; p_slug?: string | null };
        Returns: {
          clinica_id: string;
          clinica_nome: string;
          clinica_slug: string | null;
          clinica_logo_url: string | null;
        }[];
      };
      oricse_contexto_clinica_atual: {
        Args: Record<PropertyKey, never>;
        Returns: {
          clinica_id: string;
          clinica_nome: string;
          clinica_slug: string | null;
          clinica_dominio: string | null;
          clinica_logo_url: string | null;
        }[];
      };
      oricse_usuario_pode_acessar_portal: {
        Args: { p_clinica_id: string };
        Returns: boolean;
      };
      oricse_configurar_site_clinica: {
        Args: { p_slug: string; p_dominio?: string | null };
        Returns: { clinica_slug: string; clinica_dominio: string | null }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
