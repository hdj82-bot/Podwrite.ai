/**
 * app/api/waitlist/route.ts 테스트
 *
 * 검증 항목:
 *  - 정상 이메일 → 200 + "등록되었습니다."
 *  - 중복 이메일(PG 23505) → 200 + "이미 등록된 이메일입니다."
 *  - 비정상 이메일 형식 → 400
 *  - 이메일 소문자 정규화 확인
 *
 * 모킹:
 *  - next/server       → NextResponse.json 단순 구현체
 *  - @/lib/supabase-server → createServiceClient
 *  - @/lib/rate-limit  → waitlistRateLimit.limit (기본: success=true)
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'

// ── 모킹 (호이스팅) ──────────────────────────────────────────────────────────

vi.mock('next/server', () => ({
  NextResponse: {
    // 실제 NextResponse.json과 동일한 시그니처 — status와 json() 제공
    json: (data: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => data,
    }),
  },
}))

vi.mock('@/lib/supabase-server', () => ({
  createServiceClient: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  waitlistRateLimit: { limit: vi.fn() },
}))

// 모킹 이후 임포트
import { POST } from '@/app/api/waitlist/route'
import { createServiceClient } from '@/lib/supabase-server'
import { waitlistRateLimit } from '@/lib/rate-limit'

// ── 헬퍼 ────────────────────────────────────────────────────────────────────

/** 최소한의 Request mock 생성 */
function makeRequest(
  body: unknown,
  headers: Record<string, string> = {},
): Request {
  return {
    headers: { get: (key: string) => headers[key] ?? null },
    json: () => Promise.resolve(body),
  } as unknown as Request
}

// ── 테스트 ──────────────────────────────────────────────────────────────────

describe('POST /api/waitlist', () => {
  let mockInsert: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()

    // 레이트 리밋: 기본적으로 통과
    vi.mocked(waitlistRateLimit.limit).mockResolvedValue({ success: true } as never)

    // Supabase: 기본적으로 INSERT 성공
    mockInsert = vi.fn().mockResolvedValue({ error: null })
    vi.mocked(createServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue({ insert: mockInsert }),
    } as never)
  })

  // ── 정상 케이스 ──────────────────────────────────────────────────────────

  it('정상 이메일 → 200 + 등록 메시지', async () => {
    const res = await POST(makeRequest({ email: 'user@example.com' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ message: '등록되었습니다.' })
  })

  it('이메일을 소문자로 정규화하여 INSERT한다', async () => {
    await POST(makeRequest({ email: 'User@EXAMPLE.COM' }))
    expect(mockInsert).toHaveBeenCalledWith({ email: 'user@example.com' })
  })

  it('앞뒤 공백을 제거하여 INSERT한다', async () => {
    await POST(makeRequest({ email: '  trim@example.com  ' }))
    expect(mockInsert).toHaveBeenCalledWith({ email: 'trim@example.com' })
  })

  // ── 중복 이메일 ──────────────────────────────────────────────────────────

  it('중복 이메일(23505) → 200 + 이미 등록 메시지', async () => {
    mockInsert.mockResolvedValue({
      error: { code: '23505', message: 'duplicate key value violates unique constraint' },
    })

    const res = await POST(makeRequest({ email: 'dup@example.com' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ message: '이미 등록된 이메일입니다.' })
  })

  it('23505 이외 DB 에러 → 500', async () => {
    mockInsert.mockResolvedValue({
      error: { code: '42501', message: 'permission denied' },
    })

    const res = await POST(makeRequest({ email: 'user@example.com' }))
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toBeDefined()
  })

  // ── 입력 검증 ─────────────────────────────────────────────────────────────

  it('이메일 미포함 body → 400', async () => {
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: '이메일 형식이 올바르지 않습니다.' })
  })

  it('비정상 이메일 형식(@ 없음) → 400', async () => {
    const res = await POST(makeRequest({ email: 'not-an-email' }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: '이메일 형식이 올바르지 않습니다.' })
  })

  it('비정상 이메일 형식(도메인 없음) → 400', async () => {
    const res = await POST(makeRequest({ email: 'user@' }))
    expect(res.status).toBe(400)
  })

  it('email이 문자열이 아닐 때 → 400', async () => {
    const res = await POST(makeRequest({ email: 12345 }))
    expect(res.status).toBe(400)
  })

  it('잘못된 JSON body → 400', async () => {
    const badReq = {
      headers: { get: () => null },
      json: () => Promise.reject(new SyntaxError('invalid json')),
    } as unknown as Request

    const res = await POST(badReq)
    expect(res.status).toBe(400)
  })

  // ── 레이트 리밋 ──────────────────────────────────────────────────────────

  it('레이트 리밋 초과 → 429', async () => {
    vi.mocked(waitlistRateLimit.limit).mockResolvedValue({ success: false } as never)

    const res = await POST(makeRequest({ email: 'user@example.com' }))
    expect(res.status).toBe(429)
    const data = await res.json()
    expect(data.error).toBeDefined()
  })

  it('레이트 리밋 초과 시 INSERT가 호출되지 않는다', async () => {
    vi.mocked(waitlistRateLimit.limit).mockResolvedValue({ success: false } as never)

    await POST(makeRequest({ email: 'user@example.com' }))
    expect(mockInsert).not.toHaveBeenCalled()
  })
})
