import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { PLAN_LIMITS } from '@/types'
import type { Plan } from '@/types'

// ── GET /api/user/usage ───────────────────────────────────────
// 검색 사용량 + 플랜 한도 반환

export async function GET() {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })

  // 사용자 플랜 조회
  const { data: profile } = await supabase
    .from('users')
    .select('plan')
    .eq('id', user.id)
    .single()

  const plan = (profile?.plan ?? 'free') as Plan
  const searchLimit = PLAN_LIMITS[plan].searchPerMonth

  // 검색 사용량 조회
  const { data: usage } = await supabase
    .from('search_usage')
    .select('count, reset_at')
    .eq('user_id', user.id)
    .single()

  // reset_at이 지났으면 count를 0으로 초기화
  if (usage && new Date(usage.reset_at) < new Date()) {
    // 만료된 usage 리셋
    const nextResetAt = new Date()
    nextResetAt.setDate(nextResetAt.getDate() + 30)

    await supabase
      .from('search_usage')
      .update({ count: 0, reset_at: nextResetAt.toISOString() })
      .eq('user_id', user.id)

    return NextResponse.json({
      data: {
        search_count: 0,
        search_limit: searchLimit === Infinity ? null : searchLimit,
        search_reset_at: nextResetAt.toISOString(),
        plan,
      },
    })
  }

  return NextResponse.json({
    data: {
      search_count: usage?.count ?? 0,
      search_limit: searchLimit === Infinity ? null : searchLimit,
      search_reset_at: usage?.reset_at ?? null,
      plan,
    },
  })
}
