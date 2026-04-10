/**
 * POST /api/spellcheck 테스트
 *
 * 검증 항목:
 *  - 미인증 → 401
 *  - rate limit 초과 → 429
 *  - 빈 문자열 / text 누락 → 400
 *  - 50,000자 초과 → 400, 경계값(50,000자) → 200
 *  - 정상 응답 → { data: corrections }
 *  - corrections 빈 배열 → { data: [] }
 *  - 500자 이상 대용량 텍스트 처리 (청크 분할 시나리오)
 *  - checkSpelling throw → 502 (CLOVA API 실패 복원력)
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('@/lib/supabase-server', () => ({
  getCurrentUser: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  spellcheckRateLimit: { limit: vi.fn() },
}))

vi.mock('@/lib/spellcheck', () => ({
  checkSpelling: vi.fn(),
}))

import { POST } from '@/app/api/spellcheck/route'
import { getCurrentUser } from '@/lib/supabase-server'
import { spellcheckRateLimit } from '@/lib/rate-limit'
import { checkSpelling } from '@/lib/spellcheck'

// ── 헬퍼 ─────────────────────────────────────────────────────────

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/spellcheck', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const MOCK_CORRECTIONS = [
  { original: '안녕하세오', corrected: '안녕하세요', info: '맞춤법 오류' },
  { original: '됬습니다', corrected: '됐습니다', info: '맞춤법 오류' },
]

// ── 테스트 ────────────────────────────────────────────────────────

describe('POST /api/spellcheck', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-uuid-001' } as never)
    vi.mocked(spellcheckRateLimit.limit).mockResolvedValue({ success: true } as never)
    vi.mocked(checkSpelling).mockResolvedValue(MOCK_CORRECTIONS as never)
  })

  // ── 인증 ────────────────────────────────────────────────────────

  it('미인증 요청 → 401', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null as never)
    const res = await POST(makeRequest({ text: '안녕하세오' }))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toContain('로그인')
  })

  // ── Rate limit ────────────────────────────────────────────────

  it('rate limit 초과 → 429', async () => {
    vi.mocked(spellcheckRateLimit.limit).mockResolvedValue({ success: false } as never)
    const res = await POST(makeRequest({ text: '텍스트' }))
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error).toContain('요청이 너무 많습니다')
  })

  // ── 요청 형식 검증 ────────────────────────────────────────────

  it('text 필드 누락 → 400', async () => {
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('잘못된 요청')
  })

  it('빈 문자열(length=0) → 400 (min: 1)', async () => {
    const res = await POST(makeRequest({ text: '' }))
    expect(res.status).toBe(400)
  })

  it('50,001자 텍스트 → 400 (max: 50,000)', async () => {
    const res = await POST(makeRequest({ text: 'a'.repeat(50_001) }))
    expect(res.status).toBe(400)
  })

  it('50,000자 텍스트 → 200 (경계값 허용)', async () => {
    vi.mocked(checkSpelling).mockResolvedValue([] as never)
    const res = await POST(makeRequest({ text: 'a'.repeat(50_000) }))
    expect(res.status).toBe(200)
  })

  // ── 정상 응답 ─────────────────────────────────────────────────

  it('checkSpelling 결과를 { data: corrections } 형태로 반환한다', async () => {
    const res = await POST(makeRequest({ text: '안녕하세오. 됬습니다.' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual(MOCK_CORRECTIONS)
  })

  it('corrections가 빈 배열이면 { data: [] } 를 반환한다', async () => {
    vi.mocked(checkSpelling).mockResolvedValue([] as never)
    const res = await POST(makeRequest({ text: '완벽한 문장입니다.' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual([])
  })

  it('checkSpelling이 user.id로 호출되는지와 무관하게 text를 그대로 전달한다', async () => {
    const text = '테스트 텍스트'
    await POST(makeRequest({ text }))
    expect(checkSpelling).toHaveBeenCalledWith(text)
  })

  // ── 500자 청크 분할 시나리오 ──────────────────────────────────

  it('500자 이상 텍스트도 정상 처리한다 (내부 청크 분할)', async () => {
    const longText = '이것은 맞춤법 테스트를 위한 긴 문장입니다. '.repeat(20) // ~780자
    const multiChunkResult = [
      { original: '이것이', corrected: '이것은', info: '' },
      { original: '긴문장', corrected: '긴 문장', info: '띄어쓰기' },
    ]
    vi.mocked(checkSpelling).mockResolvedValue(multiChunkResult as never)

    const res = await POST(makeRequest({ text: longText }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(2)
    expect(checkSpelling).toHaveBeenCalledWith(longText)
  })

  it('1,500자 텍스트(3청크 분량)도 응답을 정상적으로 반환한다', async () => {
    vi.mocked(checkSpelling).mockResolvedValue(MOCK_CORRECTIONS as never)
    const res = await POST(makeRequest({ text: '가'.repeat(1_500) }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.data)).toBe(true)
  })

  // ── CLOVA API 실패 복원력 ─────────────────────────────────────

  it('checkSpelling throw 시 502를 반환한다', async () => {
    vi.mocked(checkSpelling).mockRejectedValue(new Error('CLOVA API 연결 실패'))
    const res = await POST(makeRequest({ text: '텍스트' }))
    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body.error).toContain('맞춤법 교정 중 오류')
  })

  it('CLOVA 타임아웃 에러도 502로 처리한다', async () => {
    vi.mocked(checkSpelling).mockRejectedValue(new Error('Request timeout after 5000ms'))
    const res = await POST(makeRequest({ text: '텍스트' }))
    expect(res.status).toBe(502)
  })

  it('CLOVA 서버 500 에러도 502로 처리하고 사용자에게 재시도 안내를 한다', async () => {
    vi.mocked(checkSpelling).mockRejectedValue(new Error('Internal Server Error'))
    const res = await POST(makeRequest({ text: '텍스트' }))
    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body.error).toContain('다시 시도')
  })
})
