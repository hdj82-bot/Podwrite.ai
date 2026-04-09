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

// ── 집필 통계 헬퍼 ────────────────────────────────────────────

/**
 * KST(UTC+9) 기준 날짜 문자열 반환 (YYYY-MM-DD)
 * @param daysAgo 0=오늘, 1=어제, ...
 */
export function getKSTDateString(daysAgo = 0): string {
  const ms = Date.now() + 9 * 60 * 60 * 1000 - daysAgo * 24 * 60 * 60 * 1000
  return new Date(ms).toISOString().slice(0, 10)
}

/**
 * 최근 30일 집필 로그 조회 (Service client — RLS 우회)
 * writing_logs 에 행이 없는 날짜는 결과에 포함되지 않음.
 * 호출 측에서 누락 날짜를 0으로 채울 것.
 */
export async function getWritingLogs30Days(
  userId: string,
): Promise<{ log_date: string; words: number }[]> {
  const supabase = createServiceClient()
  const since = getKSTDateString(29)

  const { data } = await supabase
    .from('writing_logs')
    .select('log_date, words')
    .eq('user_id', userId)
    .gte('log_date', since)
    .order('log_date', { ascending: true })

  return data ?? []
}

/**
 * 현재 글쓰기 연속 기록(스트릭) 계산
 * 스펙 4.8: 하루 100자 이상 작성 시 +1, KST 자정 리셋
 */
export async function getWritingStreak(userId: string): Promise<number> {
  const supabase = createServiceClient()
  const since = getKSTDateString(59) // 여유 있게 60일치 조회

  const { data } = await supabase
    .from('writing_logs')
    .select('log_date, words')
    .eq('user_id', userId)
    .gte('log_date', since)
    .order('log_date', { ascending: false })

  if (!data || data.length === 0) return 0

  const activeDates = new Set(
    data.filter((l) => l.words >= 100).map((l) => l.log_date),
  )

  let streak = 0
  // UTC ms에 +9h 적용하여 KST 기준 날짜 계산
  let cursor = Date.now() + 9 * 60 * 60 * 1000

  while (true) {
    const dateStr = new Date(cursor).toISOString().slice(0, 10)
    if (!activeDates.has(dateStr)) break
    streak++
    cursor -= 24 * 60 * 60 * 1000
  }

  return streak
}

/**
 * writing_logs에 오늘의 집필량 원자적으로 누적
 * increment_writing_log RPC를 사용하여 레이스 컨디션 방지
 */
export async function upsertWritingLog(
  userId: string,
  wordsAdded: number,
): Promise<void> {
  if (wordsAdded <= 0) return
  const supabase = createServiceClient()
  const today = getKSTDateString()

  await supabase.rpc('increment_writing_log', {
    p_user_id: userId,
    p_date: today,
    p_words: wordsAdded,
  })
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
