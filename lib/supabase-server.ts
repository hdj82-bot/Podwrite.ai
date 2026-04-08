/**
 * Supabase 클라이언트 — 서버 컴포넌트 / API Route / Server Action용
 *
 * 사용:
 *   import { createServerClient } from '@/lib/supabase-server'
 *   const supabase = await createServerClient()
 *
 * Service Role (RLS 우회, 서버 전용):
 *   import { createServiceClient } from '@/lib/supabase-server'
 *   const supabase = createServiceClient()
 */
import { cookies } from 'next/headers'
import { createServerClient as _createServerClient } from '@supabase/ssr'
import { createClient as _createServiceClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/** 일반 서버 클라이언트 — RLS 적용, 세션 쿠키 기반 */
export async function createServerClient() {
  const cookieStore = await cookies()

  return _createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // Server Component에서 호출된 경우 무시 (읽기 전용)
          }
        },
      },
    },
  )
}

/** Service Role 클라이언트 — RLS 우회, 서버 전용 (웹훅, 백그라운드 잡) */
export function createServiceClient() {
  return _createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  )
}

/** 현재 로그인 사용자 가져오기 (null이면 비로그인) */
export async function getCurrentUser() {
  const supabase = await createServerClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) return null
  return user
}

/** 현재 로그인 사용자 + DB users 행 가져오기 */
export async function getCurrentUserWithProfile() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { authUser: null, profile: null }

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  return { authUser: user, profile }
}
