/**
 * Supabase 클라이언트 싱글턴 — 브라우저(클라이언트 컴포넌트)용
 *
 * 사용:
 *   import { createClient } from '@/lib/supabase'
 *   const supabase = createClient()
 */
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
