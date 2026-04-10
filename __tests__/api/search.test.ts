/**
 * POST /api/search 테스트
 *
 * 검증 항목:
 *  - 미인증 → 401
 *  - rate limit 초과 → 429
 *  - 플랜 월 검색 한도 초과 → 403
 *  - 잘못된 요청 형식 → 400
 *  - 캐시 히트 → cached: true, Perplexity 미호출
 *  - 캐시 미스 → Perplexity 호출 후 저장, cached: false
 *  - Perplexity 오류 → 502
 *  - DB 저장 실패 → 500
 *  - 캐시 미스 시 search_usage 증가
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('@/lib/supabase-server', () => ({
  getCurrentUserWithProfile: vi.fn(),
  createServerClient: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  searchRateLimit: { limit: vi.fn() },
}))

vi.mock('@/lib/plan-guard', () => ({
  checkPlanAccess: vi.fn(),
}))

vi.mock('@/lib/perplexity', () => ({
  searchWithPerplexity: vi.fn(),
}))

import { POST } from '@/app/api/search/route'
import { getCurrentUserWithProfile, createServerClient } from '@/lib/supabase-server'
import { searchRateLimit } from '@/lib/rate-limit'
import { checkPlanAccess } from '@/lib/plan-guard'
import { searchWithPerplexity } from '@/lib/perplexity'

// ── 타입 ─────────────────────────────────────────────────────────

interface SearchResult {
  id: string
  project_id: string
  query: string
  results: { content: string; sources: unknown[] }
  created_at: string
}

// ── 고정값 ─────────────────────────────────────────────────────────

const VALID_PROJECT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
const VALID_BODY = { query: '조선시대 과거 제도', project_id: VALID_PROJECT_ID }

const CACHED_RESULT: SearchResult = {
  id: 'cache-uuid-001',
  project_id: VALID_PROJECT_ID,
  query: VALID_BODY.query,
  results: { content: '캐시된 검색 결과', sources: [] },
  created_at: new Date().toISOString(),
}

const PERPLEXITY_RESULT = {
  content: 'Perplexity 검색 결과입니다.',
  sources: [{ url: 'https://example.com', title: '참고 자료' }],
}

const SAVED_RESULT: SearchResult = {
  id: 'new-uuid-002',
  project_id: VALID_PROJECT_ID,
  query: VALID_BODY.query,
  results: PERPLEXITY_RESULT,
  created_at: new Date().toISOString(),
}

// ── Supabase 체이닝 mock ──────────────────────────────────────────

function makeSupabase({
  cachedData = null as SearchResult | null,
  savedData = SAVED_RESULT as SearchResult | null,
  saveError = null as { message: string } | null,
} = {}) {
  // search_results 캐시 조회: .select().eq().eq().gte().order().limit().maybeSingle()
  const cacheMaybeSingle = vi.fn().mockResolvedValue({ data: cachedData, error: null })
  const cacheLimit = vi.fn().mockReturnValue({ maybeSingle: cacheMaybeSingle })
  const cacheOrder = vi.fn().mockReturnValue({ limit: cacheLimit })
  const cacheGte = vi.fn().mockReturnValue({ order: cacheOrder })
  const cacheEqQuery = vi.fn().mockReturnValue({ gte: cacheGte })
  const cacheEqProject = vi.fn().mockReturnValue({ eq: cacheEqQuery })
  const cacheSelect = vi.fn().mockReturnValue({ eq: cacheEqProject })

  // search_results 저장: .insert().select().single()
  const saveSingle = vi.fn().mockResolvedValue({ data: savedData, error: saveError })
  const saveSelect = vi.fn().mockReturnValue({ single: saveSingle })
  const saveInsert = vi.fn().mockReturnValue({ select: saveSelect })

  // search_usage 조회: .select().eq().maybeSingle()
  const usageMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
  const usageSelectEq = vi.fn().mockReturnValue({ maybeSingle: usageMaybeSingle })
  const usageSelect = vi.fn().mockReturnValue({ eq: usageSelectEq })

  // search_usage upsert
  const usageUpsert = vi.fn().mockResolvedValue({ error: null })

  const from = vi.fn().mockImplementation((table: string) => {
    if (table === 'search_results') {
      return { select: cacheSelect, insert: saveInsert }
    }
    if (table === 'search_usage') {
      return { select: usageSelect, upsert: usageUpsert }
    }
    return {}
  })

  return { from, _saveInsert: saveInsert, _usageUpsert: usageUpsert }
}

// ── 테스트 ────────────────────────────────────────────────────────

describe('POST /api/search', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentUserWithProfile).mockResolvedValue({
      authUser: { id: 'user-uuid-001' },
      profile: { plan: 'basic' },
    } as never)
    vi.mocked(searchRateLimit.limit).mockResolvedValue({ success: true } as never)
    vi.mocked(checkPlanAccess).mockResolvedValue({ allowed: true } as never)
    vi.mocked(searchWithPerplexity).mockResolvedValue(PERPLEXITY_RESULT as never)
    vi.mocked(createServerClient).mockResolvedValue(makeSupabase() as never)
  })

  // ── 인증 ────────────────────────────────────────────────────────

  it('미인증 요청 → 401', async () => {
    vi.mocked(getCurrentUserWithProfile).mockResolvedValue({
      authUser: null,
      profile: null,
    } as never)
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toContain('로그인')
  })

  // ── Rate limit ────────────────────────────────────────────────

  it('rate limit 초과 → 429', async () => {
    vi.mocked(searchRateLimit.limit).mockResolvedValue({ success: false } as never)
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error).toContain('요청이 너무 많습니다')
  })

  // ── 플랜 월 검색 한도 ─────────────────────────────────────────

  it('월 검색 한도 초과 → 403', async () => {
    vi.mocked(checkPlanAccess).mockResolvedValue({
      allowed: false,
      reason: '이번 달 검색 횟수를 모두 사용했습니다.',
    } as never)
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toContain('검색 횟수')
  })

  // ── 요청 형식 검증 ────────────────────────────────────────────

  it('query 누락 → 400', async () => {
    const res = await POST(makeRequest({ project_id: VALID_PROJECT_ID }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('잘못된 요청')
  })

  it('project_id가 UUID 형식이 아니면 → 400', async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, project_id: 'not-a-uuid' }))
    expect(res.status).toBe(400)
  })

  it('query가 빈 문자열이면 → 400', async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, query: '' }))
    expect(res.status).toBe(400)
  })

  // ── 캐시 히트 ────────────────────────────────────────────────

  it('24시간 내 동일 쿼리 캐시 존재 시 cached: true를 반환한다', async () => {
    vi.mocked(createServerClient).mockResolvedValue(
      makeSupabase({ cachedData: CACHED_RESULT }) as never,
    )
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.cached).toBe(true)
    expect(body.data).toMatchObject({ query: VALID_BODY.query })
  })

  it('캐시 히트 시 Perplexity API를 호출하지 않는다', async () => {
    vi.mocked(createServerClient).mockResolvedValue(
      makeSupabase({ cachedData: CACHED_RESULT }) as never,
    )
    await POST(makeRequest(VALID_BODY))
    expect(searchWithPerplexity).not.toHaveBeenCalled()
  })

  it('캐시 히트 시 search_usage를 증가시키지 않는다', async () => {
    const sb = makeSupabase({ cachedData: CACHED_RESULT })
    vi.mocked(createServerClient).mockResolvedValue(sb as never)
    await POST(makeRequest(VALID_BODY))
    expect(sb._usageUpsert).not.toHaveBeenCalled()
  })

  // ── 캐시 미스 ────────────────────────────────────────────────

  it('캐시 없을 때 Perplexity를 호출하고 cached: false를 반환한다', async () => {
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(200)
    expect(searchWithPerplexity).toHaveBeenCalledWith(VALID_BODY.query)
    const body = await res.json()
    expect(body.cached).toBe(false)
  })

  it('캐시 미스 시 결과를 search_results에 저장한다', async () => {
    const sb = makeSupabase()
    vi.mocked(createServerClient).mockResolvedValue(sb as never)
    await POST(makeRequest(VALID_BODY))
    expect(sb._saveInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        project_id: VALID_PROJECT_ID,
        query: VALID_BODY.query,
      }),
    )
  })

  it('캐시 미스 시 search_usage를 증가시킨다', async () => {
    const sb = makeSupabase()
    vi.mocked(createServerClient).mockResolvedValue(sb as never)
    await POST(makeRequest(VALID_BODY))
    expect(sb._usageUpsert).toHaveBeenCalled()
  })

  // ── 오류 처리 ─────────────────────────────────────────────────

  it('Perplexity API 오류 → 502', async () => {
    vi.mocked(searchWithPerplexity).mockRejectedValue(new Error('Perplexity API 오류'))
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body.error).toContain('검색 중 오류')
  })

  it('DB 저장 실패 → 500', async () => {
    vi.mocked(createServerClient).mockResolvedValue(
      makeSupabase({ savedData: null, saveError: { message: 'DB 연결 실패' } }) as never,
    )
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toContain('저장 중 오류')
  })
})

// ── 요청 헬퍼 ──────────────────────────────────────────────────────

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}
