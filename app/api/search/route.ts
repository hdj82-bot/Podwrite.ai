/**
 * POST /api/search
 *
 * Perplexity Sonar 기반 자료 검색
 * - 24시간 내 동일 쿼리 캐시 재사용 (search_results 테이블)
 * - 플랜별 월 검색 횟수 제한 (search_usage 테이블)
 * - 인증: 필수
 * - 제한: 분당 5회
 *
 * 플랜별 월 한도:
 *   free   10회
 *   basic  30회
 *   pro    무제한
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUserWithProfile, createServerClient } from '@/lib/supabase-server'
import { searchWithPerplexity } from '@/lib/perplexity'
import { searchRateLimit } from '@/lib/rate-limit'
import { checkPlanAccess } from '@/lib/plan-guard'

const bodySchema = z.object({
  query: z.string().min(1).max(500),
  project_id: z.string().uuid(),
})

export async function POST(req: Request) {
  // ── 인증 ────────────────────────────────────────────────────────
  const { authUser, profile } = await getCurrentUserWithProfile()
  if (!authUser || !profile) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  // ── 분당 요청 제한 ────────────────────────────────────────────
  const { success: rateLimitOk } = await searchRateLimit.limit(authUser.id)
  if (!rateLimitOk) {
    return NextResponse.json(
      { error: '요청이 너무 많습니다. 잠시 후 다시 시도하세요.' },
      { status: 429 },
    )
  }

  // ── 플랜별 월 검색 횟수 확인 (plan-guard 위임) ────────────────
  const guard = await checkPlanAccess(authUser.id, 'search')
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.reason }, { status: 403 })
  }

  // ── 요청 파싱 ────────────────────────────────────────────────
  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식입니다.' }, { status: 400 })
  }

  const supabase = await createServerClient()

  // ── 24시간 캐시 확인 ──────────────────────────────────────────
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: cached } = await supabase
    .from('search_results')
    .select('*')
    .eq('project_id', body.project_id)
    .eq('query', body.query)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (cached) {
    return NextResponse.json({ data: cached, cached: true })
  }

  // ── Perplexity 검색 ──────────────────────────────────────────
  let searchResult: Awaited<ReturnType<typeof searchWithPerplexity>>
  try {
    searchResult = await searchWithPerplexity(body.query)
  } catch {
    return NextResponse.json({ error: '검색 중 오류가 발생했습니다.' }, { status: 502 })
  }

  // ── 결과 캐시 저장 ────────────────────────────────────────────
  const { data: saved, error: saveError } = await supabase
    .from('search_results')
    .insert({
      project_id: body.project_id,
      query: body.query,
      results: {
        content: searchResult.content,
        sources: searchResult.sources,
      },
    })
    .select()
    .single()

  if (saveError || !saved) {
    return NextResponse.json({ error: '검색 결과 저장 중 오류가 발생했습니다.' }, { status: 500 })
  }

  // ── 월 사용 횟수 증가 ─────────────────────────────────────────
  await incrementSearchUsage(supabase, authUser.id)

  return NextResponse.json({ data: saved, cached: false })
}

// ── 헬퍼 ─────────────────────────────────────────────────────────

/**
 * 검색 사용 횟수 +1
 * - 유효한 주기 내 레코드 존재 → count + 1
 * - 레코드 없거나 reset_at 만료 → count = 1, reset_at = 지금 + 30일
 *
 * 캐시 히트 시에는 호출하지 않음 (실제 Perplexity 호출 후에만 실행)
 */
async function incrementSearchUsage(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  userId: string,
) {
  const now = new Date()
  const resetAt30d = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  const { data: existing } = await supabase
    .from('search_usage')
    .select('id, count, reset_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (existing && new Date(existing.reset_at) > now) {
    // 주기 유효 → count 증가
    await supabase
      .from('search_usage')
      .update({ count: existing.count + 1 })
      .eq('id', existing.id)
  } else {
    // 레코드 없거나 주기 만료 → 30일 주기로 새로 시작
    await supabase.from('search_usage').upsert(
      {
        user_id: userId,
        count: 1,
        reset_at: resetAt30d.toISOString(),
      },
      { onConflict: 'user_id' },
    )
  }
}
