export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      academic_years: {
        Row: {
          ends_on: string | null
          id: string
          is_active: boolean | null
          name: string
          school_id: string
          starts_on: string | null
        }
        Insert: {
          ends_on?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          school_id: string
          starts_on?: string | null
        }
        Update: {
          ends_on?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          school_id?: string
          starts_on?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "academic_years_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_users: {
        Row: {
          auth_user_id: string | null
          full_name: string
          id: string
          is_active: boolean | null
          role: string
          school_id: string
        }
        Insert: {
          auth_user_id?: string | null
          full_name: string
          id?: string
          is_active?: boolean | null
          role: string
          school_id: string
        }
        Update: {
          auth_user_id?: string | null
          full_name?: string
          id?: string
          is_active?: boolean | null
          role?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_users_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          attachment_url: string | null
          audience: Json | null
          body: string | null
          created_at: string | null
          created_by: string | null
          expires_at: string | null
          id: string
          image_url: string | null
          publish_at: string | null
          school_id: string
          title: string
        }
        Insert: {
          attachment_url?: string | null
          audience?: Json | null
          body?: string | null
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          image_url?: string | null
          publish_at?: string | null
          school_id: string
          title: string
        }
        Update: {
          attachment_url?: string | null
          audience?: Json | null
          body?: string | null
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          image_url?: string | null
          publish_at?: string | null
          school_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: string | null
          after: Json | null
          before: Json | null
          created_at: string | null
          entity: string | null
          entity_id: string | null
          id: number
          ip: unknown
          school_id: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string | null
          entity?: string | null
          entity_id?: string | null
          id?: never
          ip?: unknown
          school_id: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string | null
          entity?: string | null
          entity_id?: string | null
          id?: never
          ip?: unknown
          school_id?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      bills: {
        Row: {
          academic_year_id: string
          amount: number
          amount_paid: number
          created_at: string | null
          due_date: string | null
          id: string
          payment_type_id: string
          period: string | null
          school_id: string
          status: string
          student_id: string
        }
        Insert: {
          academic_year_id: string
          amount: number
          amount_paid?: number
          created_at?: string | null
          due_date?: string | null
          id?: string
          payment_type_id: string
          period?: string | null
          school_id: string
          status?: string
          student_id: string
        }
        Update: {
          academic_year_id?: string
          amount?: number
          amount_paid?: number
          created_at?: string | null
          due_date?: string | null
          id?: string
          payment_type_id?: string
          period?: string | null
          school_id?: string
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bills_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_payment_type_id_fkey"
            columns: ["payment_type_id"]
            isOneToOne: false
            referencedRelation: "payment_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      class_enrollments: {
        Row: {
          class_id: string
          id: string
          student_id: string
        }
        Insert: {
          class_id: string
          id?: string
          student_id: string
        }
        Update: {
          class_id?: string
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_enrollments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          academic_year_id: string
          grade: number
          id: string
          label: string
          school_id: string
        }
        Insert: {
          academic_year_id: string
          grade: number
          id?: string
          label: string
          school_id: string
        }
        Update: {
          academic_year_id?: string
          grade?: number
          id?: string
          label?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      guardian_students: {
        Row: {
          guardian_id: string
          relation: string | null
          student_id: string
        }
        Insert: {
          guardian_id: string
          relation?: string | null
          student_id: string
        }
        Update: {
          guardian_id?: string
          relation?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guardian_students_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guardian_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      guardians: {
        Row: {
          auth_user_id: string | null
          email: string | null
          full_name: string
          id: string
          phone: string
          school_id: string
        }
        Insert: {
          auth_user_id?: string | null
          email?: string | null
          full_name: string
          id?: string
          phone: string
          school_id: string
        }
        Update: {
          auth_user_id?: string | null
          email?: string | null
          full_name?: string
          id?: string
          phone?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guardians_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_jobs: {
        Row: {
          attempts: number
          body: string
          channel: string
          created_at: string | null
          id: number
          last_error: string | null
          max_attempts: number
          next_attempt_at: string
          payload: Json
          recipient_guardian_id: string | null
          recipient_phone: string
          school_id: string
          sent_at: string | null
          status: string
          template: string
        }
        Insert: {
          attempts?: number
          body: string
          channel?: string
          created_at?: string | null
          id?: never
          last_error?: string | null
          max_attempts?: number
          next_attempt_at?: string
          payload?: Json
          recipient_guardian_id?: string | null
          recipient_phone: string
          school_id: string
          sent_at?: string | null
          status?: string
          template: string
        }
        Update: {
          attempts?: number
          body?: string
          channel?: string
          created_at?: string | null
          id?: never
          last_error?: string | null
          max_attempts?: number
          next_attempt_at?: string
          payload?: Json
          recipient_guardian_id?: string | null
          recipient_phone?: string
          school_id?: string
          sent_at?: string | null
          status?: string
          template?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_jobs_recipient_guardian_id_fkey"
            columns: ["recipient_guardian_id"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_jobs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_allocations: {
        Row: {
          amount: number
          bill_id: string
          id: string
          payment_id: string
        }
        Insert: {
          amount: number
          bill_id: string
          id?: string
          payment_id: string
        }
        Update: {
          amount?: number
          bill_id?: string
          id?: string
          payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_allocations_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_types: {
        Row: {
          default_amount: number | null
          id: string
          is_active: boolean | null
          is_recurring: boolean | null
          name: string
          school_id: string
        }
        Insert: {
          default_amount?: number | null
          id?: string
          is_active?: boolean | null
          is_recurring?: boolean | null
          name: string
          school_id: string
        }
        Update: {
          default_amount?: number | null
          id?: string
          is_active?: boolean | null
          is_recurring?: boolean | null
          name?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_types_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          bank_name: string | null
          created_at: string | null
          id: string
          method: string
          proof_path: string | null
          proof_sha256: string | null
          requested_bill_ids: string[] | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          revision_of: string | null
          school_id: string
          sender_name: string | null
          status: string
          student_id: string
          submitted_by: string | null
          transferred_at: string | null
        }
        Insert: {
          amount: number
          bank_name?: string | null
          created_at?: string | null
          id?: string
          method?: string
          proof_path?: string | null
          proof_sha256?: string | null
          requested_bill_ids?: string[] | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          revision_of?: string | null
          school_id: string
          sender_name?: string | null
          status?: string
          student_id: string
          submitted_by?: string | null
          transferred_at?: string | null
        }
        Update: {
          amount?: number
          bank_name?: string | null
          created_at?: string | null
          id?: string
          method?: string
          proof_path?: string | null
          proof_sha256?: string | null
          requested_bill_ids?: string[] | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          revision_of?: string | null
          school_id?: string
          sender_name?: string | null
          status?: string
          student_id?: string
          submitted_by?: string | null
          transferred_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_revision_of_fkey"
            columns: ["revision_of"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          bucket: string
          hit_at: string
          id: number
        }
        Insert: {
          bucket: string
          hit_at?: string
          id?: never
        }
        Update: {
          bucket?: string
          hit_at?: string
          id?: never
        }
        Relationships: []
      }
      schools: {
        Row: {
          address: string | null
          bank_accounts: Json | null
          created_at: string | null
          id: string
          logo_url: string | null
          name: string
          qris_url: string | null
          settings: Json | null
          slug: string
        }
        Insert: {
          address?: string | null
          bank_accounts?: Json | null
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name: string
          qris_url?: string | null
          settings?: Json | null
          slug: string
        }
        Update: {
          address?: string | null
          bank_accounts?: Json | null
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          qris_url?: string | null
          settings?: Json | null
          slug?: string
        }
        Relationships: []
      }
      students: {
        Row: {
          full_name: string
          id: string
          is_active: boolean | null
          nis: string
          school_id: string
        }
        Insert: {
          full_name: string
          id?: string
          is_active?: boolean | null
          nis: string
          school_id: string
        }
        Update: {
          full_name?: string
          id?: string
          is_active?: boolean | null
          nis?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_academic_year: {
        Args: { p_year_id: string }
        Returns: undefined
      }
      approve_payment: {
        Args: { p_allocations: Json; p_payment_id: string }
        Returns: undefined
      }
      broadcast_announcement: {
        Args: { p_announcement_id: string }
        Returns: number
      }
      check_rate_limit: {
        Args: { p_bucket: string; p_max: number; p_window_seconds: number }
        Returns: boolean
      }
      claim_guardian_account: { Args: never; Returns: string }
      claim_notification_jobs: {
        Args: { p_limit?: number }
        Returns: {
          attempts: number
          body: string
          channel: string
          created_at: string | null
          id: number
          last_error: string | null
          max_attempts: number
          next_attempt_at: string
          payload: Json
          recipient_guardian_id: string | null
          recipient_phone: string
          school_id: string
          sent_at: string | null
          status: string
          template: string
        }[]
        SetofOptions: {
          from: "*"
          to: "notification_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      class_label_suffix: {
        Args: { p_grade: number; p_label: string }
        Returns: string
      }
      complete_notification_job: {
        Args: { p_error?: string; p_id: number; p_ok: boolean }
        Returns: undefined
      }
      current_admin_role: { Args: never; Returns: string }
      current_admin_school_id: { Args: never; Returns: string }
      current_guardian_id: { Args: never; Returns: string }
      current_guardian_school_id: { Args: never; Returns: string }
      current_guardian_student_ids: { Args: never; Returns: string[] }
      enqueue_notification: {
        Args: {
          p_body: string
          p_guardian_id: string
          p_payload?: Json
          p_school_id: string
          p_template: string
        }
        Returns: number
      }
      find_duplicate_proof: {
        Args: {
          p_exclude_payment_id?: string
          p_school_id: string
          p_sha256: string
        }
        Returns: string
      }
      format_rupiah: { Args: { p: number }; Returns: string }
      generate_bills: {
        Args: {
          p_due_date?: string
          p_payment_type_id: string
          p_period?: string
        }
        Returns: number
      }
      log_audit: {
        Args: {
          p_action: string
          p_after?: Json
          p_before?: Json
          p_entity?: string
          p_entity_id?: string
        }
        Returns: undefined
      }
      preview_promotion: {
        Args: { p_from_year: string; p_to_year: string }
        Returns: {
          from_class_id: string
          from_grade: number
          from_label: string
          graduates: boolean
          student_count: number
          to_class_exists: boolean
          to_grade: number
          to_label: string
        }[]
      }
      promote_students: {
        Args: {
          p_deactivate_graduates?: boolean
          p_from_year: string
          p_to_year: string
        }
        Returns: Json
      }
      recompute_bill_amount_paid: {
        Args: { p_bill_id: string }
        Returns: undefined
      }
      record_cash_payment: {
        Args: {
          p_allocations: Json
          p_amount: number
          p_method?: string
          p_note?: string
          p_student_id: string
        }
        Returns: string
      }
      review_payment: {
        Args: { p_action: string; p_note: string; p_payment_id: string }
        Returns: undefined
      }
      submit_payment: {
        Args: {
          p_amount: number
          p_bank_name?: string
          p_bill_ids: string[]
          p_method?: string
          p_payment_id: string
          p_proof_path: string
          p_proof_sha256?: string
          p_revision_of?: string
          p_sender_name?: string
          p_student_id: string
          p_transferred_at?: string
        }
        Returns: string
      }
      unwaive_bill: { Args: { p_bill_id: string }; Returns: undefined }
      waive_bill: {
        Args: { p_bill_id: string; p_note: string }
        Returns: undefined
      }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

