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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agent_messages: {
        Row: {
          chips: Json
          created_at: string
          id: string
          role: string
          source: string
          text: string
          tool_calls: Json
          user_id: string
        }
        Insert: {
          chips?: Json
          created_at?: string
          id?: string
          role: string
          source: string
          text?: string
          tool_calls?: Json
          user_id: string
        }
        Update: {
          chips?: Json
          created_at?: string
          id?: string
          role?: string
          source?: string
          text?: string
          tool_calls?: Json
          user_id?: string
        }
        Relationships: []
      }
      calendar_events: {
        Row: {
          all_day: boolean
          created_at: string
          ends_at: string | null
          external_id: string | null
          id: string
          location: string
          source: string
          starts_at: string
          sub: string
          title: string
          user_id: string
        }
        Insert: {
          all_day?: boolean
          created_at?: string
          ends_at?: string | null
          external_id?: string | null
          id?: string
          location?: string
          source?: string
          starts_at: string
          sub?: string
          title: string
          user_id: string
        }
        Update: {
          all_day?: boolean
          created_at?: string
          ends_at?: string | null
          external_id?: string | null
          id?: string
          location?: string
          source?: string
          starts_at?: string
          sub?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      error_events: {
        Row: {
          context: Json
          created_at: string
          id: string
          message: string
          provider: string | null
          severity: string
          user_id: string
        }
        Insert: {
          context?: Json
          created_at?: string
          id?: string
          message: string
          provider?: string | null
          severity?: string
          user_id: string
        }
        Update: {
          context?: Json
          created_at?: string
          id?: string
          message?: string
          provider?: string | null
          severity?: string
          user_id?: string
        }
        Relationships: []
      }
      finance_accounts: {
        Row: {
          created_at: string
          current_value: number
          id: string
          name: string
          plaid_account_id: string | null
          source: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_value?: number
          id?: string
          name: string
          plaid_account_id?: string | null
          source?: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_value?: number
          id?: string
          name?: string
          plaid_account_id?: string | null
          source?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      finance_snapshots: {
        Row: {
          account_id: string
          created_at: string
          date: string
          id: string
          user_id: string
          value: number
        }
        Insert: {
          account_id: string
          created_at?: string
          date: string
          id?: string
          user_id: string
          value: number
        }
        Update: {
          account_id?: string
          created_at?: string
          date?: string
          id?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "finance_snapshots_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "finance_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      gmail_threads: {
        Row: {
          created_at: string
          gmail_id: string
          id: string
          is_important: boolean
          is_unread: boolean
          labels: string[]
          received_at: string
          sender_email: string
          sender_name: string
          snippet: string
          subject: string
          user_id: string
        }
        Insert: {
          created_at?: string
          gmail_id: string
          id?: string
          is_important?: boolean
          is_unread?: boolean
          labels?: string[]
          received_at: string
          sender_email?: string
          sender_name?: string
          snippet?: string
          subject?: string
          user_id: string
        }
        Update: {
          created_at?: string
          gmail_id?: string
          id?: string
          is_important?: boolean
          is_unread?: boolean
          labels?: string[]
          received_at?: string
          sender_email?: string
          sender_name?: string
          snippet?: string
          subject?: string
          user_id?: string
        }
        Relationships: []
      }
      habit_logs: {
        Row: {
          created_at: string
          date: string
          done: boolean
          habit_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          done?: boolean
          habit_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          done?: boolean
          habit_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habit_logs_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
        ]
      }
      habits: {
        Row: {
          archived: boolean
          created_at: string
          id: string
          name: string
          position: number
          sub_label: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          id?: string
          name: string
          position?: number
          sub_label?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          id?: string
          name?: string
          position?: number
          sub_label?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      health_snapshots: {
        Row: {
          created_at: string
          date: string
          hrv: number | null
          id: string
          recovery_score: number | null
          rhr: number | null
          sleep_hours: number | null
          sleep_score: number | null
          source: string
          steps: number | null
          strain: number | null
          user_id: string
          vo2_max: number | null
          weight: number | null
          weight_unit: string
        }
        Insert: {
          created_at?: string
          date: string
          hrv?: number | null
          id?: string
          recovery_score?: number | null
          rhr?: number | null
          sleep_hours?: number | null
          sleep_score?: number | null
          source?: string
          steps?: number | null
          strain?: number | null
          user_id: string
          vo2_max?: number | null
          weight?: number | null
          weight_unit?: string
        }
        Update: {
          created_at?: string
          date?: string
          hrv?: number | null
          id?: string
          recovery_score?: number | null
          rhr?: number | null
          sleep_hours?: number | null
          sleep_score?: number | null
          source?: string
          steps?: number | null
          strain?: number | null
          user_id?: string
          vo2_max?: number | null
          weight?: number | null
          weight_unit?: string
        }
        Relationships: []
      }
      integrations: {
        Row: {
          access_token: string | null
          created_at: string
          id: string
          last_error: string | null
          last_synced_at: string | null
          metadata: Json
          provider: string
          refresh_token: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          metadata?: Json
          provider: string
          refresh_token?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          metadata?: Json
          provider?: string
          refresh_token?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      journal_entries: {
        Row: {
          created_at: string
          id: string
          mentions: Json
          tags: string[]
          text: string
          updated_at: string
          user_id: string
          written_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          mentions?: Json
          tags?: string[]
          text: string
          updated_at?: string
          user_id: string
          written_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          mentions?: Json
          tags?: string[]
          text?: string
          updated_at?: string
          user_id?: string
          written_at?: string
        }
        Relationships: []
      }
      lifts: {
        Row: {
          created_at: string
          id: string
          is_pr: boolean
          name: string
          reps: number
          session_id: string
          sets: number
          user_id: string
          weight: number
          weight_unit: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_pr?: boolean
          name: string
          reps?: number
          session_id: string
          sets?: number
          user_id: string
          weight?: number
          weight_unit?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_pr?: boolean
          name?: string
          reps?: number
          session_id?: string
          sets?: number
          user_id?: string
          weight?: number
          weight_unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "lifts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "training_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrition_entries: {
        Row: {
          carbs_g: number
          created_at: string
          description: string
          eaten_at: string
          fat_g: number
          id: string
          kcal: number
          protein_g: number
          source: string
          user_id: string
        }
        Insert: {
          carbs_g?: number
          created_at?: string
          description: string
          eaten_at?: string
          fat_g?: number
          id?: string
          kcal?: number
          protein_g?: number
          source?: string
          user_id: string
        }
        Update: {
          carbs_g?: number
          created_at?: string
          description?: string
          eaten_at?: string
          fat_g?: number
          id?: string
          kcal?: number
          protein_g?: number
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          focus: string
          id: string
          initials: string
          location: string
          name: string
          role: string
          streak: number
          theme: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          focus?: string
          id: string
          initials?: string
          location?: string
          name?: string
          role?: string
          streak?: number
          theme?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          focus?: string
          id?: string
          initials?: string
          location?: string
          name?: string
          role?: string
          streak?: number
          theme?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      social_followers: {
        Row: {
          count: number
          created_at: string
          date: string
          id: string
          platform: string
          source: string
          user_id: string
        }
        Insert: {
          count?: number
          created_at?: string
          date: string
          id?: string
          platform: string
          source?: string
          user_id: string
        }
        Update: {
          count?: number
          created_at?: string
          date?: string
          id?: string
          platform?: string
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      sync_runs: {
        Row: {
          created_at: string
          error_message: string | null
          finished_at: string | null
          id: string
          provider: string
          rows_synced: number
          started_at: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          provider: string
          rows_synced?: number
          started_at?: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          provider?: string
          rows_synced?: number
          started_at?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          created_at: string
          done: boolean
          due_at: string | null
          id: string
          priority: string
          star: boolean
          tags: string[]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          done?: boolean
          due_at?: string | null
          id?: string
          priority?: string
          star?: boolean
          tags?: string[]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          done?: boolean
          due_at?: string | null
          id?: string
          priority?: string
          star?: boolean
          tags?: string[]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      training_sessions: {
        Row: {
          created_at: string
          id: string
          notes: string
          split_name: string
          started_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string
          split_name?: string
          started_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string
          split_name?: string
          started_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      workouts: {
        Row: {
          avg_hr: number | null
          created_at: string
          distance_m: number | null
          duration_sec: number | null
          ended_at: string | null
          energy_kj: number | null
          external_id: string | null
          id: string
          max_hr: number | null
          source: string
          source_metadata: Json
          sport: string
          started_at: string
          strain: number | null
          user_id: string
        }
        Insert: {
          avg_hr?: number | null
          created_at?: string
          distance_m?: number | null
          duration_sec?: number | null
          ended_at?: string | null
          energy_kj?: number | null
          external_id?: string | null
          id?: string
          max_hr?: number | null
          source?: string
          source_metadata?: Json
          sport?: string
          started_at: string
          strain?: number | null
          user_id: string
        }
        Update: {
          avg_hr?: number | null
          created_at?: string
          distance_m?: number | null
          duration_sec?: number | null
          ended_at?: string | null
          energy_kj?: number | null
          external_id?: string | null
          id?: string
          max_hr?: number | null
          source?: string
          source_metadata?: Json
          sport?: string
          started_at?: string
          strain?: number | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
