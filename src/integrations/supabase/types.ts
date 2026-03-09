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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      app_likes: {
        Row: {
          id: number
          user_id: string
          created_at: string
        }
        Insert: {
          id?: number
          user_id: string
          created_at?: string
        }
        Update: {
          id?: number
          user_id?: string
          created_at?: string
        }
        Relationships: []
      }
      migration_confirmations: {
        Row: {
          id: number
          user_id: string
          created_at: string
        }
        Insert: {
          id?: number
          user_id: string
          created_at?: string
        }
        Update: {
          id?: number
          user_id?: string
          created_at?: string
        }
        Relationships: []
      }
      avisos_sistema: {
        Row: {
          id: number
          titulo: string
          mensaje: string
          tipo: string
          activo: boolean
          created_at: string
        }
        Insert: {
          id?: number
          titulo: string
          mensaje: string
          tipo?: string
          activo?: boolean
          created_at?: string
        }
        Update: {
          id?: number
          titulo?: string
          mensaje?: string
          tipo?: string
          activo?: boolean
          created_at?: string
        }
        Relationships: []
      }
      chat_conversations: {
        Row: {
          id: number
          user_1: string
          user_2: string
          last_message_at: string
          created_at: string
        }
        Insert: {
          id?: number
          user_1: string
          user_2: string
          last_message_at?: string
          created_at?: string
        }
        Update: {
          id?: number
          user_1?: string
          user_2?: string
          last_message_at?: string
          created_at?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          id: number
          conversation_id: number
          sender_id: string
          content: string
          created_at: string
          read_at: string | null
        }
        Insert: {
          id?: number
          conversation_id: number
          sender_id: string
          content: string
          created_at?: string
          read_at?: string | null
        }
        Update: {
          id?: number
          conversation_id?: number
          sender_id?: string
          content?: string
          created_at?: string
          read_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      caps: {
        Row: {
          created_at: string
          id: number
          nombre: string
          numero: number
        }
        Insert: {
          created_at?: string
          id?: number
          nombre: string
          numero: number
        }
        Update: {
          created_at?: string
          id?: number
          nombre?: string
          numero?: number
        }
        Relationships: []
      }
      pacientes: {
        Row: {
          apellido: string
          cap_id: number | null
          created_at: string
          dni: string
          edad: number
          id: number
          nombre: string
          updated_at: string
        }
        Insert: {
          apellido: string
          cap_id?: number | null
          created_at?: string
          dni: string
          edad: number
          id?: number
          nombre: string
          updated_at?: string
        }
        Update: {
          apellido?: string
          cap_id?: number | null
          created_at?: string
          dni?: string
          edad?: number
          id?: number
          nombre?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pacientes_cap_id_fkey"
            columns: ["cap_id"]
            isOneToOne: false
            referencedRelation: "caps"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          cap_number: number | null
          created_at: string
          email: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          cap_number?: number | null
          created_at?: string
          email: string
          id: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          cap_number?: number | null
          created_at?: string
          email?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: []
      }
      registros_anticonceptivos: {
        Row: {
          anio: number
          cantidad: number
          created_at: string
          created_by: string | null
          fecha_entrega: string
          id: number
          cap_id: number | null
          mes: number
          notas: string | null
          paciente_id: number | null
          tipo_anticonceptivo_id: number | null
        }
        Insert: {
          anio: number
          cantidad?: number
          created_at?: string
          created_by?: string | null
          fecha_entrega?: string
          id?: number
          cap_id?: number | null
          mes: number
          notas?: string | null
          paciente_id?: number | null
          tipo_anticonceptivo_id?: number | null
        }
        Update: {
          anio?: number
          cantidad?: number
          created_at?: string
          created_by?: string | null
          fecha_entrega?: string
          id?: number
          cap_id?: number | null
          mes?: number
          notas?: string | null
          paciente_id?: number | null
          tipo_anticonceptivo_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "registros_anticonceptivos_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registros_anticonceptivos_tipo_anticonceptivo_id_fkey"
            columns: ["tipo_anticonceptivo_id"]
            isOneToOne: false
            referencedRelation: "tipos_anticonceptivos"
            referencedColumns: ["id"]
          },
        ]
      }
      tipos_anticonceptivos: {
        Row: {
          created_at: string
          descripcion: string | null
          id: number
          codigo: string | null
          marca: string | null
          nombre: string
          stock: number
        }
        Insert: {
          created_at?: string
          descripcion?: string | null
          id?: number
          codigo?: string | null
          marca?: string | null
          nombre: string
          stock?: number
        }
        Update: {
          created_at?: string
          descripcion?: string | null
          id?: number
          codigo?: string | null
          marca?: string | null
          nombre?: string
          stock?: number
        }
        Relationships: []
      }
      inventario_caps: {
        Row: {
          cap_id: number
          created_at: string
          id: number
          tipo_anticonceptivo_id: number
          stock: number
        }
        Insert: {
          cap_id: number
          created_at?: string
          id?: number
          tipo_anticonceptivo_id: number
          stock?: number
        }
        Update: {
          cap_id?: number
          created_at?: string
          id?: number
          tipo_anticonceptivo_id?: number
          stock?: number
        }
        Relationships: []
      }
      inventario_movimientos: {
        Row: {
          cantidad: number
          created_at: string
          created_by: string | null
          id: number
          inventario_id: number
          paciente_id: number | null
          registro_id: number | null
          tipo: string
        }
        Insert: {
          cantidad: number
          created_at?: string
          created_by?: string | null
          id?: number
          inventario_id: number
          paciente_id?: number | null
          registro_id?: number | null
          tipo: string
        }
        Update: {
          cantidad?: number
          created_at?: string
          created_by?: string | null
          id?: number
          inventario_id?: number
          paciente_id?: number | null
          registro_id?: number | null
          tipo?: string
        }
        Relationships: []
      }
+      entregas_anticonceptivos: {
+        Row: {
+          cantidad: number
+          created_at: string
+          created_by: string | null
+          fecha_entrega: string
+          id: number
+          paciente_id: number | null
+          tipo_anticonceptivo_id: number | null
+          cap_id: number | null
+        }
+        Insert: {
+          cantidad?: number
+          created_at?: string
+          created_by?: string | null
+          fecha_entrega?: string
+          id?: number
+          paciente_id?: number | null
+          tipo_anticonceptivo_id?: number | null
+          cap_id?: number | null
+        }
+        Update: {
+          cantidad?: number
+          created_at?: string
+          created_by?: string | null
+          fecha_entrega?: string
+          id?: number
+          paciente_id?: number | null
+          tipo_anticonceptivo_id?: number | null
+          cap_id?: number | null
+        }
+        Relationships: [
+          {
+            foreignKeyName: "entregas_anticonceptivos_paciente_id_fkey"
+            columns: ["paciente_id"]
+            isOneToOne: false
+            referencedRelation: "pacientes"
+            referencedColumns: ["id"]
+          },
+          {
+            foreignKeyName: "entregas_anticonceptivos_tipo_anticonceptivo_id_fkey"
+            columns: ["tipo_anticonceptivo_id"]
+            isOneToOne: false
+            referencedRelation: "tipos_anticonceptivos"
+            referencedColumns: ["id"]
+          },
+        ]
+      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["user_role"]
      }
    }
    Enums: {
      user_role: "admin" | "cap_user"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      user_role: ["admin", "cap_user"],
    },
  },
} as const
