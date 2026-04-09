/**
 * app/auth/callback/route.ts 테스트
 *
 * 검증 항목:
 *  - code 없음 → /login?error=auth_callback_failed 리다이렉트
 *  - exchangeCodeForSession 에러 → /login 리다이렉트
 *  - 신규 가입(created_at < 30초) → sendWelcomeEmail 호출됨
 *  - 기존 사용자(created_at > 30초) → sendWelcomeEmail 미호출
 *  - next=/reset-password → sendWelcomeEmail 스킵, reset-password 리다이렉트
 *
 * 모킹:
 *  - next/server → NextResponse.redirect (vi.fn 으로 호출 인자 검증)
 *  - next/headers → cookies (쿠키 스토어 stub)
 *  - @supabase/ssr → createServerClient (exchangeCodeForSession 제어)
 *  - @/lib/supabase-server → createServiceClient (users 테이블 조회)
 *  - @/lib/email → sendWelcomeEmail (호출 여부 검증)
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

// ── 모킹 (호이스팅) ──────────────────────────────────────────────────────────

vi.mock('next/server', () => ({
  NextResponse: {
    // redirect: 호출 인자 검증을 위해 vi.fn() 사용
    redirect: vi.fn((url: string) => ({ redirectedTo: url, status: 302 })),
    json: (data: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => data,
    }),
  },
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: vi.fn().mockReturnValue([]),
    set: vi.fn(),
  }),
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(),
}))

vi.mock('@/lib/supabase-server', () => ({
  createServiceClient: vi.fn(),
}))

vi.mock('@/lib/email', () => ({
  sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
}))

// 모킹 이후 임포트
import { GET } from '@/app/auth/callback/route'
import { NextResponse } from 'next/server'
import { createServerClient as createSSRClient } from '@supabase/ssr'
import { createServiceClient } from '@/lib/supabase-server'
import { sendWelcomeEmail } from '@/lib/email'

// ── 헬퍼 ────────────────────────────────────────────────────────────────────

/** auth/callback에 대한 최소 NextRequest mock */
function makeCallbackRequest(params: Record<string, string>): NextRequest {
  const url = new URL('http://localhost:3000/auth/callback')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return { url: url.toString() } as unknown as NextRequest
}

// ── 테스트 ──────────────────────────────────────────────────────────────────

describe('GET /auth/callback', () => {
  let mockExchangeCodeForSession: ReturnType<typeof vi.fn>
  let mockUserSingle: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()

    // SSR Supabase: 성공 + 신규 유저를 기본값으로 설정
    mockExchangeCodeForSession = vi.fn().mockResolvedValue({
      data: {
        user: {
          id: 'user-uuid-abc',
          email: 'newuser@example.com',
          user_metadata: { name: '홍길동' },
        },
      },
      error: null,
    })
    vi.mocked(createSSRClient).mockReturnValue({
      auth: { exchangeCodeForSession: mockExchangeCodeForSession },
    } as never)

    // Service client: 신규 유저 프로필 (10초 전 가입)을 기본값으로 설정
    mockUserSingle = vi.fn().mockResolvedValue({
      data: {
        created_at: new Date(Date.now() - 10_000).toISOString(),
        name: '홍길동',
      },
      error: null,
    })
    const mockUserEq = vi.fn().mockReturnValue({ single: mockUserSingle })
    const mockUserSelect = vi.fn().mockReturnValue({ eq: mockUserEq })
    vi.mocked(createServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue({ select: mockUserSelect }),
    } as never)
  })

  // ── code 없음 ─────────────────────────────────────────────────────────────

  it('code 파라미터 없음 → /login?error=auth_callback_failed 리다이렉트', async () => {
    await GET(makeCallbackRequest({}))
    expect(vi.mocked(NextResponse.redirect)).toHaveBeenCalledWith(
      expect.stringContaining('/login?error=auth_callback_failed'),
    )
  })

  it('code 없을 때 exchangeCodeForSession이 호출되지 않는다', async () => {
    await GET(makeCallbackRequest({}))
    expect(mockExchangeCodeForSession).not.toHaveBeenCalled()
  })

  it('code 없을 때 sendWelcomeEmail이 호출되지 않는다', async () => {
    await GET(makeCallbackRequest({}))
    expect(sendWelcomeEmail).not.toHaveBeenCalled()
  })

  // ── exchangeCodeForSession 에러 ──────────────────────────────────────────

  it('exchangeCodeForSession 에러 → /login?error=auth_callback_failed 리다이렉트', async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: null,
      error: { message: 'Invalid auth code', status: 400 },
    })

    await GET(makeCallbackRequest({ code: 'invalid-code' }))
    expect(vi.mocked(NextResponse.redirect)).toHaveBeenCalledWith(
      expect.stringContaining('/login?error=auth_callback_failed'),
    )
  })

  it('exchangeCodeForSession 에러 시 sendWelcomeEmail이 호출되지 않는다', async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: null,
      error: { message: 'Invalid auth code', status: 400 },
    })

    await GET(makeCallbackRequest({ code: 'invalid-code' }))
    expect(sendWelcomeEmail).not.toHaveBeenCalled()
  })

  // ── 신규 가입 (created_at < 30초) ─────────────────────────────────────────

  it('신규 가입(10초 전 created_at) → sendWelcomeEmail 호출됨', async () => {
    // beforeEach 기본값 사용 (10초 전 가입)
    await GET(makeCallbackRequest({ code: 'valid-code' }))
    expect(sendWelcomeEmail).toHaveBeenCalledOnce()
  })

  it('sendWelcomeEmail에 올바른 email과 name이 전달된다', async () => {
    await GET(makeCallbackRequest({ code: 'valid-code' }))
    expect(sendWelcomeEmail).toHaveBeenCalledWith('newuser@example.com', '홍길동')
  })

  it('profile.name이 없으면 user_metadata.name을 사용한다', async () => {
    mockUserSingle.mockResolvedValue({
      data: {
        created_at: new Date(Date.now() - 5_000).toISOString(),
        name: null, // profile.name 없음
      },
      error: null,
    })
    // user_metadata.name = '홍길동' (beforeEach 기본값)
    await GET(makeCallbackRequest({ code: 'valid-code' }))
    expect(sendWelcomeEmail).toHaveBeenCalledWith('newuser@example.com', '홍길동')
  })

  it('profile.name, user_metadata.name 모두 없으면 이메일 앞부분을 사용한다', async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: {
        user: {
          id: 'user-uuid-no-meta',
          email: 'noname@example.com',
          user_metadata: {}, // name 없음
        },
      },
      error: null,
    })
    mockUserSingle.mockResolvedValue({
      data: {
        created_at: new Date(Date.now() - 5_000).toISOString(),
        name: null, // profile.name도 없음
      },
      error: null,
    })

    await GET(makeCallbackRequest({ code: 'valid-code' }))
    expect(sendWelcomeEmail).toHaveBeenCalledWith('noname@example.com', 'noname')
  })

  it('성공 시 /dashboard로 리다이렉트한다 (next 기본값)', async () => {
    await GET(makeCallbackRequest({ code: 'valid-code' }))
    expect(vi.mocked(NextResponse.redirect)).toHaveBeenCalledWith(
      expect.stringContaining('/dashboard'),
    )
  })

  // ── 기존 사용자 (created_at > 30초) ──────────────────────────────────────

  it('기존 사용자(60초 전 created_at) → sendWelcomeEmail 미호출', async () => {
    mockUserSingle.mockResolvedValue({
      data: {
        created_at: new Date(Date.now() - 60_000).toISOString(), // 60초 전
        name: '기존유저',
      },
      error: null,
    })

    await GET(makeCallbackRequest({ code: 'valid-code' }))
    expect(sendWelcomeEmail).not.toHaveBeenCalled()
  })

  it('기존 사용자도 /dashboard로 리다이렉트된다', async () => {
    mockUserSingle.mockResolvedValue({
      data: {
        created_at: new Date(Date.now() - 60_000).toISOString(),
        name: '기존유저',
      },
      error: null,
    })

    await GET(makeCallbackRequest({ code: 'valid-code' }))
    expect(vi.mocked(NextResponse.redirect)).toHaveBeenCalledWith(
      expect.stringContaining('/dashboard'),
    )
  })

  // ── next=/reset-password ──────────────────────────────────────────────────

  it('next=/reset-password → sendWelcomeEmail 호출되지 않는다', async () => {
    await GET(makeCallbackRequest({ code: 'recovery-code', next: '/reset-password' }))
    expect(sendWelcomeEmail).not.toHaveBeenCalled()
  })

  it('next=/reset-password → /reset-password로 리다이렉트된다', async () => {
    await GET(makeCallbackRequest({ code: 'recovery-code', next: '/reset-password' }))
    expect(vi.mocked(NextResponse.redirect)).toHaveBeenCalledWith(
      expect.stringContaining('/reset-password'),
    )
  })

  it('next=/reset-password일 때 /login으로 리다이렉트되지 않는다', async () => {
    await GET(makeCallbackRequest({ code: 'recovery-code', next: '/reset-password' }))
    const callArg = vi.mocked(NextResponse.redirect).mock.calls[0][0] as string
    expect(callArg).not.toContain('auth_callback_failed')
  })

  // ── 커스텀 next 파라미터 ──────────────────────────────────────────────────

  it('커스텀 next=/settings → /settings로 리다이렉트된다', async () => {
    await GET(makeCallbackRequest({ code: 'valid-code', next: '/settings' }))
    expect(vi.mocked(NextResponse.redirect)).toHaveBeenCalledWith(
      expect.stringContaining('/settings'),
    )
  })

  it('커스텀 next=/settings → sendWelcomeEmail은 여전히 호출된다 (신규 유저)', async () => {
    await GET(makeCallbackRequest({ code: 'valid-code', next: '/settings' }))
    expect(sendWelcomeEmail).toHaveBeenCalledOnce()
  })
})
