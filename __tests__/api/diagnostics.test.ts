/**
 * app/api/diagnostics/route.ts 테스트
 *
 * 검증 항목 (POST):
 *  - rate limit 성공 + 전체 플로우 → 200 + { data: { id, status: 'completed' } }
 *    ※ 현재 코드는 Claude를 동기 실행 후 completed 반환.
 *      Inngest 비동기 전환 후에는 201 + processing으로 변경 예정.
 *  - 파일 없음 → 400
 *  - 파일 크기 초과(5MB+) → 400
 *  - session_token 없음 → 400
 *  - rate limit 초과 → 429
 *
 * 검증 항목 (GET):
 *  - ?id + 유효한 x-session-token 헤더 → 200 + diagnostic 데이터
 *  - id / token 파라미터 없음 → 400
 *  - id + 잘못된 session_token → 403
 *
 * 모킹:
 *  - next/server → NextResponse 경량 구현체
 *  - @/lib/supabase-server → getCurrentUser, createServiceClient
 *  - @/lib/claude → callClaude, DIAGNOSTIC_SYSTEM_PROMPT
 *  - @/lib/rate-limit → diagnosticsRateLimit.limit (기본: success=true)
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

// ── 모킹 (호이스팅) ──────────────────────────────────────────────────────────

vi.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => data,
    }),
  },
}))

vi.mock('@/lib/supabase-server', () => ({
  getCurrentUser: vi.fn(),
  createServiceClient: vi.fn(),
}))

vi.mock('@/lib/claude', () => ({
  callClaude: vi.fn(),
  DIAGNOSTIC_SYSTEM_PROMPT: 'mock-system-prompt',
}))

vi.mock('@/lib/rate-limit', () => ({
  diagnosticsRateLimit: { limit: vi.fn() },
}))

// 모킹 이후 임포트
import { POST, GET } from '@/app/api/diagnostics/route'
import { getCurrentUser, createServiceClient } from '@/lib/supabase-server'
import { callClaude } from '@/lib/claude'
import { diagnosticsRateLimit } from '@/lib/rate-limit'

// ── 상수 ────────────────────────────────────────────────────────────────────

const DIAG_ID = 'diag-test-uuid-abc123'
const SESSION_TOKEN = 'session-token-valid-12345' // 10자 이상
const VALID_TEXT = '한국 독립 작가를 위한 테스트 원고입니다. '.repeat(5) // 100자 이상

// ── 헬퍼: File mock ──────────────────────────────────────────────────────────

interface FileMockOptions {
  name?: string
  size?: number
  type?: string
  content?: string
}

function makeFile(opts: FileMockOptions = {}): File {
  const content = opts.content ?? VALID_TEXT
  return {
    name: opts.name ?? 'manuscript.txt',
    size: opts.size ?? new TextEncoder().encode(content).length,
    type: opts.type ?? 'text/plain',
    arrayBuffer: async () => new TextEncoder().encode(content).buffer as ArrayBuffer,
  } as unknown as File
}

// ── 헬퍼: POST Request mock ──────────────────────────────────────────────────

function makePostRequest(
  file: File | null,
  sessionToken: string | null = SESSION_TOKEN,
  headers: Record<string, string> = {},
): NextRequest {
  const formData = {
    get: (key: string) => {
      if (key === 'file') return file
      if (key === 'session_token') return sessionToken
      return null
    },
  }
  return {
    headers: { get: (key: string) => headers[key] ?? null },
    formData: async () => formData,
    url: 'http://localhost/api/diagnostics',
  } as unknown as NextRequest
}

// ── 헬퍼: GET Request mock ───────────────────────────────────────────────────

function makeGetRequest(
  params: Record<string, string>,
  headers: Record<string, string> = {},
): NextRequest {
  const url = new URL('http://localhost/api/diagnostics')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return {
    url: url.toString(),
    headers: { get: (key: string) => headers[key] ?? null },
  } as unknown as NextRequest
}

// ── 헬퍼: POST 성공용 Supabase mock 생성 ─────────────────────────────────────

function makePostSupabaseMock() {
  const mockUpload = vi.fn().mockResolvedValue({ error: null })

  // insert().select('id').single() → { data: { id }, error: null }
  const mockSingle = vi.fn().mockResolvedValue({ data: { id: DIAG_ID }, error: null })
  const mockSelectAfterInsert = vi.fn().mockReturnValue({ single: mockSingle })
  const mockInsert = vi.fn().mockReturnValue({ select: mockSelectAfterInsert })

  // update().eq() → { error: null }
  const mockUpdateEq = vi.fn().mockResolvedValue({ error: null })
  const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEq })

  return {
    storage: { from: vi.fn().mockReturnValue({ upload: mockUpload }) },
    // from()는 insert용, update용 순서로 호출됨
    from: vi.fn()
      .mockReturnValueOnce({ insert: mockInsert })
      .mockReturnValueOnce({ update: mockUpdate }),
  }
}

// ── POST 테스트 ───────────────────────────────────────────────────────────────

describe('POST /api/diagnostics', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // 레이트 리밋: 기본 통과
    vi.mocked(diagnosticsRateLimit.limit).mockResolvedValue({ success: true } as never)

    // 비회원으로 기본 설정
    vi.mocked(getCurrentUser).mockResolvedValue(null)

    // Claude: 유효한 DiagnosticReport JSON 반환
    vi.mocked(callClaude).mockResolvedValue(
      JSON.stringify({
        strengths: ['명확한 주제의식'],
        weaknesses: ['결말이 약함'],
        suggestions: ['결말을 보강하세요'],
        platform_fit: { bookk: 80, kyobo: 75, kdp: 60 },
        overall_score: 75,
      }),
    )

    // Supabase: 성공 체인 기본 설정
    vi.mocked(createServiceClient).mockReturnValue(makePostSupabaseMock() as never)
  })

  // ── 정상 케이스 ────────────────────────────────────────────────────────────

  it('rate limit 성공 + 유효 파일 → 200 + { data.id, data.status }', async () => {
    const res = await POST(makePostRequest(makeFile()))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toMatchObject({ id: DIAG_ID, status: 'completed' })
  })

  it('응답에 error 필드가 없다', async () => {
    const res = await POST(makePostRequest(makeFile()))
    const body = await res.json()
    expect(body.error).toBeUndefined()
  })

  it('callClaude가 1회 호출된다', async () => {
    await POST(makePostRequest(makeFile()))
    expect(callClaude).toHaveBeenCalledOnce()
  })

  // ── 파일 없음 ──────────────────────────────────────────────────────────────

  it('파일 없음 → 400 + 에러 메시지', async () => {
    const res = await POST(makePostRequest(null))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it('파일 없을 때 callClaude가 호출되지 않는다', async () => {
    await POST(makePostRequest(null))
    expect(callClaude).not.toHaveBeenCalled()
  })

  // ── 파일 크기 초과 ─────────────────────────────────────────────────────────

  it('파일 크기 5MB 초과 → 400', async () => {
    const oversizedFile = makeFile({ size: 5 * 1024 * 1024 + 1 })
    const res = await POST(makePostRequest(oversizedFile))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('5MB')
  })

  it('파일 크기 초과 시 callClaude가 호출되지 않는다', async () => {
    const oversizedFile = makeFile({ size: 5 * 1024 * 1024 + 1 })
    await POST(makePostRequest(oversizedFile))
    expect(callClaude).not.toHaveBeenCalled()
  })

  // ── session_token 없음 ─────────────────────────────────────────────────────

  it('session_token 없음(null) → 400', async () => {
    const res = await POST(makePostRequest(makeFile(), null))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it('session_token 너무 짧음(9자) → 400', async () => {
    const res = await POST(makePostRequest(makeFile(), '123456789'))
    expect(res.status).toBe(400)
  })

  // ── 레이트 리밋 초과 ───────────────────────────────────────────────────────

  it('rate limit 초과 → 429', async () => {
    vi.mocked(diagnosticsRateLimit.limit).mockResolvedValue({ success: false } as never)
    const res = await POST(makePostRequest(makeFile()))
    expect(res.status).toBe(429)
  })

  it('rate limit 초과 시 callClaude가 호출되지 않는다', async () => {
    vi.mocked(diagnosticsRateLimit.limit).mockResolvedValue({ success: false } as never)
    await POST(makePostRequest(makeFile()))
    expect(callClaude).not.toHaveBeenCalled()
  })

  it('rate limit 초과 시 Supabase INSERT가 호출되지 않는다', async () => {
    vi.mocked(diagnosticsRateLimit.limit).mockResolvedValue({ success: false } as never)
    await POST(makePostRequest(makeFile()))
    expect(createServiceClient).not.toHaveBeenCalled()
  })
})

// ── GET 테스트 ────────────────────────────────────────────────────────────────

describe('GET /api/diagnostics', () => {
  const mockDiagnostic = {
    id: DIAG_ID,
    status: 'completed',
    report: { overall_score: 75 },
    user_id: null,
    session_token: SESSION_TOKEN,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentUser).mockResolvedValue(null)
  })

  // ── 모드 A: ?id=UUID ───────────────────────────────────────────────────────

  it('id + 유효한 x-session-token → 200 + diagnostic 데이터', async () => {
    // select().eq().single() → diagnostic
    const mockSingle = vi.fn().mockResolvedValue({ data: mockDiagnostic, error: null })
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })

    vi.mocked(createServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue({ select: mockSelect }),
    } as never)

    const res = await GET(
      makeGetRequest(
        { id: DIAG_ID },
        { 'x-session-token': SESSION_TOKEN },
      ),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toMatchObject({ id: DIAG_ID, status: 'completed' })
  })

  it('id + 잘못된 session_token (헤더 불일치) → 403', async () => {
    const mockSingle = vi.fn().mockResolvedValue({ data: mockDiagnostic, error: null })
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })

    vi.mocked(createServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue({ select: mockSelect }),
    } as never)

    const res = await GET(
      makeGetRequest(
        { id: DIAG_ID },
        { 'x-session-token': 'wrong-session-token-xxxx' },
      ),
    )
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it('id가 DB에 없음 → 404', async () => {
    const mockSingle = vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } })
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })

    vi.mocked(createServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue({ select: mockSelect }),
    } as never)

    const res = await GET(
      makeGetRequest({ id: 'nonexistent-id' }, { 'x-session-token': SESSION_TOKEN }),
    )
    expect(res.status).toBe(404)
  })

  // ── 모드 B: ?token=SESSION_TOKEN ──────────────────────────────────────────

  it('token 파라미터로 조회 → 200 + diagnostic 데이터', async () => {
    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: mockDiagnostic, error: null })
    const mockLimit = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle })
    const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit })
    const mockEq = vi.fn().mockReturnValue({ order: mockOrder })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })

    vi.mocked(createServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue({ select: mockSelect }),
    } as never)

    const res = await GET(makeGetRequest({ token: SESSION_TOKEN }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.id).toBe(DIAG_ID)
  })

  // ── 파라미터 없음 ──────────────────────────────────────────────────────────

  it('id와 token 모두 없음 → 400', async () => {
    vi.mocked(createServiceClient).mockReturnValue({ from: vi.fn() } as never)

    const res = await GET(makeGetRequest({}))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })
})
