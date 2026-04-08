/**
 * Supabase 자동 생성 타입 자리표시자
 *
 * 실제 프로젝트에서는:
 *   npx supabase gen types typescript --project-id YOUR_PROJECT_ID > types/database.ts
 * 명령으로 자동 생성하세요.
 *
 * 아래는 schema.sql 기반 수동 정의입니다.
 */

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          plan: 'free' | 'basic' | 'pro'
          plan_expires_at: string | null
          terms_agreed_at: string | null
          privacy_agreed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          plan?: 'free' | 'basic' | 'pro'
          plan_expires_at?: string | null
          terms_agreed_at?: string | null
          privacy_agreed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          email?: string
          plan?: 'free' | 'basic' | 'pro'
          plan_expires_at?: string | null
          terms_agreed_at?: string | null
          privacy_agreed_at?: string | null
          updated_at?: string
        }
      }
      projects: {
        Row: {
          id: string
          user_id: string
          title: string
          platform: 'bookk' | 'kyobo' | 'kdp'
          status: 'draft' | 'in_progress' | 'completed' | 'published'
          target_words: number
          current_words: number
          cover_image_url: string | null
          description: string | null
          genre: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          platform: 'bookk' | 'kyobo' | 'kdp'
          status?: 'draft' | 'in_progress' | 'completed' | 'published'
          target_words?: number
          current_words?: number
          cover_image_url?: string | null
          description?: string | null
          genre?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          title?: string
          platform?: 'bookk' | 'kyobo' | 'kdp'
          status?: 'draft' | 'in_progress' | 'completed' | 'published'
          target_words?: number
          current_words?: number
          cover_image_url?: string | null
          description?: string | null
          genre?: string | null
          updated_at?: string
        }
      }
      chapters: {
        Row: {
          id: string
          project_id: string
          order_idx: number
          title: string
          content: unknown | null
          word_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          order_idx: number
          title: string
          content?: unknown | null
          word_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          order_idx?: number
          title?: string
          content?: unknown | null
          word_count?: number
          updated_at?: string
        }
      }
      chapter_versions: {
        Row: {
          id: string
          chapter_id: string
          content: unknown
          trigger: 'ai_edit' | 'autosave' | 'manual'
          created_at: string
        }
        Insert: {
          id?: string
          chapter_id: string
          content: unknown
          trigger: 'ai_edit' | 'autosave' | 'manual'
          created_at?: string
        }
        Update: never
      }
      search_results: {
        Row: {
          id: string
          project_id: string
          query: string
          results: unknown
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          query: string
          results: unknown
          created_at?: string
        }
        Update: never
      }
      search_usage: {
        Row: {
          id: string
          user_id: string
          count: number
          reset_at: string
        }
        Insert: {
          id?: string
          user_id: string
          count?: number
          reset_at: string
        }
        Update: {
          count?: number
          reset_at?: string
        }
      }
      diagnostics: {
        Row: {
          id: string
          user_id: string | null
          session_token: string
          file_storage_path: string | null
          report: unknown | null
          status: 'pending' | 'processing' | 'completed' | 'failed'
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          session_token: string
          file_storage_path?: string | null
          report?: unknown | null
          status?: 'pending' | 'processing' | 'completed' | 'failed'
          created_at?: string
        }
        Update: {
          user_id?: string | null
          file_storage_path?: string | null
          report?: unknown | null
          status?: 'pending' | 'processing' | 'completed' | 'failed'
        }
      }
      subscriptions: {
        Row: {
          id: string
          user_id: string
          toss_billing_key: string
          plan: 'free' | 'basic' | 'pro'
          status: 'active' | 'cancelled' | 'expired' | 'pending'
          amount: number
          next_billing_at: string | null
          cancelled_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          toss_billing_key: string
          plan: 'free' | 'basic' | 'pro'
          status?: 'active' | 'cancelled' | 'expired' | 'pending'
          amount: number
          next_billing_at?: string | null
          cancelled_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          toss_billing_key?: string
          plan?: 'free' | 'basic' | 'pro'
          status?: 'active' | 'cancelled' | 'expired' | 'pending'
          amount?: number
          next_billing_at?: string | null
          cancelled_at?: string | null
          updated_at?: string
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      plan_type: 'free' | 'basic' | 'pro'
      platform_type: 'bookk' | 'kyobo' | 'kdp'
      project_status: 'draft' | 'in_progress' | 'completed' | 'published'
      version_trigger: 'ai_edit' | 'autosave' | 'manual'
      subscription_status: 'active' | 'cancelled' | 'expired' | 'pending'
      diagnostic_status: 'pending' | 'processing' | 'completed' | 'failed'
    }
  }
}
