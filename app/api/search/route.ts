/**
 * POST /api/search
 *
 * Perplexity Sonar 기반 자료 검색 (2단계 플로우)
 * 1단계: Claude로 글쓰기 쿼리 → 학술 검색 최적화 키워드 추출
 * 2단계: Perplexity Sonar로 실제 검색, 신뢰도 도메인 우선 정렬
 *
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
import { callClaude } from '@/lib/claude'
import { searchRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { checkPlanAccess } from '@/lib/plan-guard'
import type { SearchResultItem } from '@/types'

// ── 신뢰도 도메인 화이트리스트 ─────────────────────────────────────
// 학술·공인 출판 도메인을 우선 정렬 (엄격 차단이 아닌 우선순위 정렬)

const TRUSTED_DOMAINS = [
  'riss.kr',
  'dbpia.co.kr',
  'kci.go.kr',
  'kiss.kstudy.com',
  'pubmed.ncbi.nlm.nih.gov',
  'ncbi.nlm.nih.gov',
  'arxiv.org',
  'sciencedirect.com',
  'springer.com',
  'nature.com',
  'ieee.org',
  'acm.org',
  'jstor.org',
  'semanticscholar.org',
  'tandfonline.com',
  'wiley.com',
  'apa.org',
  'scholar.google.com',
] as const

function isTrustedDomain(url: string): boolean {
  try {
    const { hostname } = new URL(url)
    const domain = hostname.replace(/^www\./, '')
    return TRUSTED_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`))
  } catch {
    return false
  }
}

/** 신뢰 도메인 출처를 앞으로, 나머지를 뒤로 정렬 */
function prioritizeSources(sources: SearchResultItem[]): SearchResultItem[] {
  const trusted = sources.filter((s) => isTrustedDomain(s.url))
  const others = sources.filter((s) => !isTrustedDomain(s.url))
  return [...trusted, ...others]
}

// ── Claude 키워드 추출 시스템 프롬프트 ─────────────────────────────

const KEYWORD_EXTRACTION_SYSTEM = `당신은 학술 자료 검색 전문가입니다.
입력된 글쓰기 쿼리를 학술 데이터베이스 검색에 최적화된 키워드로 변환하세요.

규칙:
- 핵심 키워드만 추출 (3~5개)
- 한국어와 영어 키워드를 병기
- 공백으로 구분하여 한 줄로만 출력
- 다른 설명·인사말 없이 키워드만 출력

예시 입력: 조선시대 여성 교육에 대해 알고 싶어
예시 출력: 조선시대 여성교육 women education Joseon dynasty

예시 입력: 기후변화가 식량안보에 미치는 영향
예시 출력: 기후변화 식량안보 climate change food security agriculture`

// ── 요청 스키마 ──────────────────────────────────────────────────

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
  const { success: rateLimitOk, reset } = await searchRateLimit.limit(authUser.id)
  if (!rateLimitOk) return rateLimitResponse(reset)

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

  // ── 24시간 캐시 확인 (원본 쿼리 키) ─────────────────────────
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

  // ── 1단계: Claude로 검색 최적화 키워드 추출 ──────────────────
  let optimizedQuery = body.query
  try {
    const extracted = await callClaude(body.query, KEYWORD_EXTRACTION_SYSTEM, 100)
    if (extracted.trim()) optimizedQuery = extracted.trim()
  } catch {
    // 키워드 추출 실패 시 원본 쿼리로 폴백 (검색 자체는 계속 진행)
    console.warn('[search] Claude 키워드 추출 실패, 원본 쿼리 사용:', body.query)
  }

  // ── 2단계: Perplexity 검색 ────────────────────────────────────
  let searchResult: Awaited<ReturnType<typeof searchWithPerplexity>>
  try {
    searchResult = await searchWithPerplexity(optimizedQuery)
  } catch {
    return NextResponse.json({ error: '검색 중 오류가 발생했습니다.' }, { status: 502 })
  }

  // ── 신뢰 도메인 우선 정렬 ─────────────────────────────────────
  const prioritizedSources = prioritizeSources(searchResult.sources)

  // ── 결과 캐시 저장 ────────────────────────────────────────────
  const { data: saved, error: saveError } = await supabase
    .from('search_results')
    .insert({
      project_id: body.project_id,
      query: body.query,           // 캐시 키: 사용자가 입력한 원본 쿼리
      results: {
        content: searchResult.content,
        sources: prioritizedSources,
        optimized_query: optimizedQuery, // 디버깅·분석용
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
