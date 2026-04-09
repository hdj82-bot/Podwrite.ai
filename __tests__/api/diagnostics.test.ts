/**
 * app/api/diagnostics/route.ts 테스트 (Inngest 비동기 전환 후 버전)
 *
 * 검증 항목 (POST):
 *  - rate limit 성공 + 유효 파일 → 200 + { data: { id, status: 'processing' } }
 *  - inngest.send가 1회 호출됨 (diagnostic/analyze 이벤트)
 *  - 파일 없음 → 400, inngest.send 미호출
 *  - 파일 크기 5MB 초과 → 400, inngest.send 미호출
 *  - session_token 없음 / 너무 짧음 → 400
 *  - rate limit 초과 → 429, inngest.send 미호출
 *
 * 검증 항목 (GET):
 *  - ?id + 일치하는 x-session-token → 200 + diagnostic 데이터
 *  - ?id + 불일치 x-session-token → 403
 *  - ?id + DB에 없는 id → 404
 *  - ?token=SESSION_TOKEN → 200 + diagnostic 데이터 (모드 B)
 *  - id, token 모두 없음 → 400
 *
 * 모킹:
 *  - next/server → NextResponse 경량 구현체
 *  - @/lib/supabase-server → getCurrentUser, createServiceClient
 *  - @/lib/rate-limit → diagnosticsRateLimit.limit (기본: success=true)
 *  - @/inngest/client → inngest.send (기본: resolves undefined)
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

vi.mock('@/lib/rate-limit', () => ({
  diagnosticsRateLimit: { limit: vi.fn() },
}))

vi.mock('@/inngest/client', () => ({
  inngest: { send: vi.fn() },
}))

// 모킹 이후 임포트
import { POST, GET } from '@/app/api/diagnostics/route'
import { getCurrentUser, createServiceClient } from '@/lib/supabase-server'
import { diagnosticsRateLimit } from '@/lib/rate-limit'
import { inngest } from '@/inngest/client'

// ── 상수 ─────────────────────────────────────────────────────────────────────

const DIAG_ID = 'diag-test-uuid-abc123'
const SESSION_TOKEN = 'session-token-valid-12345' // 10자 이상
const VALID_TEXT = '한국 독립 작가를 위한 테스트 원고입니다. '.repeat(5) // 100자 이상

// ── 헬퍼: File mock ───────────────────────────────────────────────────────────

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

// ── 헬퍼: POST Request mock ───────────────────────────────────────────────────

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

// ── 헬퍼: GET Request mock ────────────────────────────────────────────────────

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

// ── 헬퍼: POST 성공용 Supabase mock (INSERT만, UPDATE 없음) ──────────────────

function makePostSupabaseMock() {
  const mockUpload = vi.fn().mockResolvedValue({ error: null })

  const mockSingle = vi.fn().mockResolvedValue({ data: { id: DIAG_ID }, error: null })
  const mockSelectAfterInsert = vi.fn().mockReturnValue({ single: mockSingle })
  const mockInsert = vi.fn().mockReturnValue({ select: mockSelectAfterInsert })

  return {
    storage: { from: vi.fn().mockReturnValue({ upload: mockUpload }) },
    from: vi.fn().mockReturnValue({ insert: mockInsert }),
  }
}

// ── POST 테스트 ───────────────────────────────────────────────────────────────

describe('POST /api/diagnostics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(diagnosticsRateLimit.limit).mockResolvedValue({ success: true } as never)
    vi.mocked(getCurrentUser).mockResolvedValue(null)
    vi.mocked(inngest.send).mockResolvedValue(undefined as never)
    vi.mocked(createServiceClient).mockReturnValue(makePostSupabaseMock() as never)
  })

  // ── 정상 케이스 ────────────────────────────────────────────────────────────

  it('rate limit 성공 + 유효 파일 → 200', async () => {
    const res = await POST(makePostRequest(makeFile()))
    expect(res.status).toBe(200)
  })

  it('응답 body에 { data: { id, status: processing } }이 포함됨', async () => {
    const res = await POST(makePostRequest(makeFile()))
    const body = await res.json()
    expect(body.data).toMatchObject({ id: DIAG_ID, status: 'processing' })
  })

  it('응답에 error 필드가 없다', async () => {
    const res = await POST(makePostRequest(makeFile()))
    const body = await res.json()
    expect(body.error).toBeUndefined()
  })

  it('inngest.send가 1회 호출된다', async () => {
    await POST(makePostRequest(makeFile()))
    expect(inngest.send).toHaveBeenCalledOnce()
  })

  it('inngest.send에 diagnostic/analyze 이벤트가 전달된다', async () => {
    await POST(makePostRequest(makeFile()))
    expect(inngest.send).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'diagnostic/analyze' }),
    )
  })

  it('inngest.send 페이로드에 diagnosticId가 포함된다', async () => {
    await POST(makePostRequest(makeFile()))
    expect(inngest.send).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ diagnosticId: DIAG_ID }),
      }),
    )
  })

  // ── 파일 없음 ──────────────────────────────────────────────────────────────

  it('파일 없음 → 400 + 에러 메시지', async () => {
    const res = await POST(makePostRequest(null))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it('파일 없을 때 inngest.send가 호출되지 않는다', async () => {
    await POST(makePostRequest(null))
    expect(inngest.send).not.toHaveBeenCalled()
  })

  // ── 파일 크기 초과 ─────────────────────────────────────────────────────────

  it('파일 크기 5MB 초과 → 400 + 에러 메시지에 5MB 포함', async () => {
    const oversizedFile = makeFile({ size: 5 * 1024 * 1024 + 1 })
    const res = await POST(makePostRequest(oversizedFile))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('5MB')
  })

  it('파일 크기 초과 시 inngest.send가 호출되지 않는다', async () => {
    const oversizedFile = makeFile({ size: 5 * 1024 * 1024 + 1 })
    await POST(makePostRequest(oversizedFile))
    expect(inngest.send).not.toHaveBeenCalled()
  })

  // ── session_token 없음 / 짧음 ──────────────────────────────────────────────

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

  // ── rate limit 초과 ───────────────────────────────────────────────────────

  it('rate limit 초과 → 429', async () => {
    vi.mocked(diagnosticsRateLimit.limit).mockResolvedValue({ success: false } as never)
    const res = await POST(makePostRequest(makeFile()))
    expect(res.status).toBe(429)
  })

  it('rate limit 초과 시 inngest.send가 호출되지 않는다', async () => {
    vi.mocked(diagnosticsRateLimit.limit).mockResolvedValue({ success: false } as never)
    await POST(makePostRequest(makeFile()))
    expect(inngest.send).not.toHaveBeenCalled()
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
    status: 'processing',
    report: null,
    user_id: null,
    session_token: SESSION_TOKEN,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentUser).mockResolvedValue(null)
  })

  // ── 모드 A: ?id=UUID ───────────────────────────────────────────────────────

  it('id + 일치하는 x-session-token → 200 + diagnostic 데이터', async () => {
    const mockSingle = vi.fn().mockResolvedValue({ data: mockDiagnostic, error: null })
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })

    vi.mocked(createServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue({ select: mockSelect }),
    } as never)

    const res = await GET(
      makeGetRequest({ id: DIAG_ID }, { 'x-session-token': SESSION_TOKEN }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toMatchObject({ id: DIAG_ID, status: 'processing' })
  })

  it('id + 불일치 x-session-token → 403', async () => {
    const mockSingle = vi.fn().mockResolvedValue({ data: mockDiagnostic, error: null })
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle })
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })

    vi.mocked(createServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue({ select: mockSelect }),
    } as never)

    const res = await GET(
      makeGetRequest({ id: DIAG_ID }, { 'x-session-token': 'wrong-token-xxxxx' }),
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
      makeGetRequest({ id: 'nonexistent-uuid' }, { 'x-session-token': SESSION_TOKEN }),
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

  it('id, token 모두 없음 → 400', async () => {
    vi.mocked(createServiceClient).mockReturnValue({ from: vi.fn() } as never)

    const res = await GET(makeGetRequest({}))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })
})
