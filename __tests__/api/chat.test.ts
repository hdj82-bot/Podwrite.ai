/**
 * POST /api/chat/ai 테스트
 *
 * 검증 항목:
 *  - 미인증 → 401
 *  - rate limit 초과 → 429
 *  - 플랜별 일일 토큰 한도 초과 → 429
 *  - Pro 플랜 토큰 무제한
 *  - 잘못된 요청 형식 → 400
 *  - 정상 요청 → 200 + text/event-stream
 *  - streamClaudeChat 호출 인자 검증
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('@/lib/supabase-server', () => ({
  getCurrentUserWithProfile: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  chatRateLimit: { limit: vi.fn() },
  DAILY_TOKEN_LIMITS: { free: 10_000, basic: 100_000, pro: Infinity },
  getDailyTokensUsed: vi.fn(),
  incrementDailyTokens: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/claude', () => ({
  streamClaudeChat: vi.fn(),
}))

import { POST } from '@/app/api/chat/ai/route'
import { getCurrentUserWithProfile } from '@/lib/supabase-server'
import { chatRateLimit, getDailyTokensUsed } from '@/lib/rate-limit'
import { streamClaudeChat } from '@/lib/claude'

// ── 헬퍼 ─────────────────────────────────────────────────────────

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/chat/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const VALID_BODY = {
  messages: [{ role: 'user', content: '다음 단락을 써주세요.' }],
  mode: 'writing',
}

// ── 테스트 ────────────────────────────────────────────────────────

describe('POST /api/chat/ai', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentUserWithProfile).mockResolvedValue({
      authUser: { id: 'user-uuid-001' },
      profile: { plan: 'basic' },
    } as never)
    vi.mocked(chatRateLimit.limit).mockResolvedValue({ success: true } as never)
    vi.mocked(getDailyTokensUsed).mockResolvedValue(0)
    vi.mocked(streamClaudeChat).mockReturnValue(new ReadableStream())
  })

  // ── 인증 ────────────────────────────────────────────────────────

  it('authUser가 없으면 401을 반환한다', async () => {
    vi.mocked(getCurrentUserWithProfile).mockResolvedValue({
      authUser: null,
      profile: null,
    } as never)
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toContain('로그인')
  })

  it('profile이 없으면 401을 반환한다', async () => {
    vi.mocked(getCurrentUserWithProfile).mockResolvedValue({
      authUser: { id: 'user-uuid-001' },
      profile: null,
    } as never)
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(401)
  })

  // ── Rate limit ────────────────────────────────────────────────

  it('rate limit 초과 시 429를 반환한다', async () => {
    vi.mocked(chatRateLimit.limit).mockResolvedValue({ success: false } as never)
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error).toContain('요청이 너무 많습니다')
  })

  // ── 일일 토큰 한도 ────────────────────────────────────────────

  it('free 플랜에서 일일 토큰 한도(10,000) 도달 시 429를 반환한다', async () => {
    vi.mocked(getCurrentUserWithProfile).mockResolvedValue({
      authUser: { id: 'user-uuid-001' },
      profile: { plan: 'free' },
    } as never)
    vi.mocked(getDailyTokensUsed).mockResolvedValue(10_000)
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error).toContain('오늘의 AI 사용량')
  })

  it('basic 플랜에서 토큰 한도 미달 시 스트리밍 응답을 반환한다', async () => {
    vi.mocked(getDailyTokensUsed).mockResolvedValue(99_999)
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(200)
  })

  it('pro 플랜은 사용량이 많아도 토큰 한도 없이 스트리밍 응답을 반환한다', async () => {
    vi.mocked(getCurrentUserWithProfile).mockResolvedValue({
      authUser: { id: 'user-uuid-001' },
      profile: { plan: 'pro' },
    } as never)
    // pro는 Infinity라 getDailyTokensUsed 자체가 호출되지 않음
    vi.mocked(getDailyTokensUsed).mockResolvedValue(999_999)
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(200)
    expect(getDailyTokensUsed).not.toHaveBeenCalled()
  })

  // ── 요청 형식 검증 ────────────────────────────────────────────

  it('messages가 빈 배열이면 400을 반환한다', async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, messages: [] }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('잘못된 요청')
  })

  it('mode가 유효하지 않으면 400을 반환한다', async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, mode: 'invalid_mode' }))
    expect(res.status).toBe(400)
  })

  it('messages가 51개이면 400을 반환한다 (max: 50)', async () => {
    const messages = Array.from({ length: 51 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: '내용',
    }))
    const res = await POST(makeRequest({ ...VALID_BODY, messages }))
    expect(res.status).toBe(400)
  })

  // ── 스트리밍 응답 ─────────────────────────────────────────────

  it('정상 요청 시 200과 Content-Type: text/event-stream을 반환한다', async () => {
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('text/event-stream')
  })

  it('Cache-Control: no-cache 헤더가 포함된다', async () => {
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.headers.get('Cache-Control')).toContain('no-cache')
  })

  it('streamClaudeChat을 messages, mode, onUsage 콜백으로 호출한다', async () => {
    await POST(makeRequest(VALID_BODY))
    expect(streamClaudeChat).toHaveBeenCalledWith(
      VALID_BODY.messages,
      VALID_BODY.mode,
      expect.any(Function),
    )
  })

  it('outline 모드도 정상적으로 스트리밍 응답을 반환한다', async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, mode: 'outline' }))
    expect(res.status).toBe(200)
    expect(streamClaudeChat).toHaveBeenCalledWith(
      expect.any(Array),
      'outline',
      expect.any(Function),
    )
  })

  it('style 모드도 정상적으로 스트리밍 응답을 반환한다', async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, mode: 'style' }))
    expect(res.status).toBe(200)
  })
})
