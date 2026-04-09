/**
 * inngest/analyze-diagnostic.ts 테스트
 *
 * 검증 항목:
 *  - 모듈 임포트 시 createFunction 핸들러가 등록됨
 *  - Claude 분석 성공 → status='completed', report 저장, { success: true } 반환
 *  - Claude 분석 실패(throw) → status='failed' 업데이트 + Sentry.captureException 호출 + re-throw
 *  - JSON 파싱 실패 → status='failed' 검증
 *  - extractJson 간접 검증:
 *    · ```json 코드블록 파싱
 *    · ``` 코드블록 (언어 없음)
 *    · 중괄호 포함 텍스트에서 JSON 추출
 *    · 순수 JSON 텍스트 폴백
 *  - DB 저장 실패 → throw + Sentry 호출
 *
 * 모킹:
 *  - @/inngest/client → createFunction 핸들러를 vi.hoisted()로 캡처
 *  - @/lib/claude → callClaude (반환값 제어), DIAGNOSTIC_SYSTEM_PROMPT
 *  - @/lib/supabase-server → createServiceClient (chainable update mock)
 *  - @sentry/nextjs → captureException
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'

// ── vi.hoisted: createFunction 핸들러 캡처 ──────────────────────────────────

const handlerRef = vi.hoisted(() => ({
  fn: null as
    | ((ctx: { event: { data: Record<string, unknown> }; step: unknown }) => Promise<unknown>)
    | null,
}))

// ── 모킹 (호이스팅) ──────────────────────────────────────────────────────────

vi.mock('@/inngest/client', () => ({
  inngest: {
    createFunction: (
      _opts: unknown,
      _trigger: unknown,
      handler: (ctx: {
        event: { data: Record<string, unknown> }
        step: unknown
      }) => Promise<unknown>,
    ) => {
      handlerRef.fn = handler
      return {}
    },
  },
}))

vi.mock('@/lib/claude', () => ({
  callClaude: vi.fn(),
  DIAGNOSTIC_SYSTEM_PROMPT: 'mock-system-prompt',
}))

vi.mock('@/lib/supabase-server', () => ({
  createServiceClient: vi.fn(),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}))

// 모킹 이후 임포트 (임포트 시 createFunction 호출 → handlerRef.fn 등록됨)
import '@/inngest/analyze-diagnostic'
import { callClaude } from '@/lib/claude'
import { createServiceClient } from '@/lib/supabase-server'
import * as Sentry from '@sentry/nextjs'

// ── 상수 ─────────────────────────────────────────────────────────────────────

const DIAG_ID = 'diag-inngest-test-uuid'

const BASE_REPORT = {
  strengths: ['명확한 주제의식'],
  weaknesses: ['결말이 약함'],
  suggestions: ['결말을 보강하세요'],
  platform_fit: { bookk: 80, kyobo: 75, kdp: 60 },
  overall_score: 75,
}

// ── 헬퍼 ─────────────────────────────────────────────────────────────────────

function makeEvent(
  overrides: Partial<{
    diagnosticId: string
    textContent: string
    wordCount: number
    fileName: string
  }> = {},
) {
  return {
    data: {
      diagnosticId: DIAG_ID,
      textContent: '테스트 원고입니다. '.repeat(30),
      wordCount: 90,
      fileName: 'test.txt',
      ...overrides,
    },
  }
}

/** step.run(name, fn) → fn() 즉시 실행 (동기 테스트용) */
function makeStep() {
  return {
    run: vi.fn((_name: string, fn: () => Promise<unknown>) => fn()),
  }
}

function makeSupabase(updateResult: { error: null | { message: string } } = { error: null }) {
  const mockEq = vi.fn().mockResolvedValue(updateResult)
  const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
  const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate })
  return {
    from: mockFrom,
    _update: mockUpdate,
    _eq: mockEq,
  }
}

async function runHandler(
  eventOverrides: Parameters<typeof makeEvent>[0] = {},
  step = makeStep(),
) {
  return handlerRef.fn!({ event: makeEvent(eventOverrides), step })
}

// ── 테스트 ────────────────────────────────────────────────────────────────────

describe('analyzeDiagnosticJob', () => {
  let mockSupabase: ReturnType<typeof makeSupabase>

  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase = makeSupabase()
    vi.mocked(createServiceClient).mockReturnValue(mockSupabase as never)
    vi.mocked(callClaude).mockResolvedValue(JSON.stringify(BASE_REPORT))
  })

  // ── 핸들러 등록 ───────────────────────────────────────────────────────────

  it('모듈 임포트 시 createFunction 핸들러가 등록된다', () => {
    expect(handlerRef.fn).not.toBeNull()
    expect(typeof handlerRef.fn).toBe('function')
  })

  // ── Claude 분석 성공 ─────────────────────────────────────────────────────

  it('성공 → { success: true, diagnosticId } 반환', async () => {
    const result = await runHandler()
    expect(result).toEqual({ success: true, diagnosticId: DIAG_ID })
  })

  it('성공 → status=completed로 업데이트됨', async () => {
    await runHandler()
    expect(mockSupabase._update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'completed' }),
    )
  })

  it('성공 → report가 포함되어 저장됨', async () => {
    await runHandler()
    const [updateArg] = mockSupabase._update.mock.calls[0] as [Record<string, unknown>]
    expect(updateArg.report).toMatchObject({
      strengths: BASE_REPORT.strengths,
      overall_score: BASE_REPORT.overall_score,
    })
  })

  it('report에 word_count, estimated_pages가 계산되어 포함됨', async () => {
    await runHandler({ wordCount: 500 })
    const [updateArg] = mockSupabase._update.mock.calls[0] as [Record<string, unknown>]
    const report = updateArg.report as Record<string, unknown>
    expect(report.word_count).toBe(500)
    expect(report.estimated_pages).toBe(2) // Math.ceil(500 / 250)
  })

  it('성공 시 Sentry.captureException이 호출되지 않는다', async () => {
    await runHandler()
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })

  // ── Claude 분석 실패 (throw) ──────────────────────────────────────────────

  it('callClaude throw → 에러가 re-throw됨 (Inngest retry 트리거)', async () => {
    vi.mocked(callClaude).mockRejectedValue(new Error('Claude API timeout'))
    await expect(runHandler()).rejects.toThrow('Claude API timeout')
  })

  it('callClaude throw → status=failed로 업데이트됨', async () => {
    vi.mocked(callClaude).mockRejectedValue(new Error('API error'))
    await expect(runHandler()).rejects.toThrow()
    expect(mockSupabase._update).toHaveBeenCalledWith({ status: 'failed' })
  })

  it('callClaude throw → Sentry.captureException이 호출됨', async () => {
    const err = new Error('Claude API timeout')
    vi.mocked(callClaude).mockRejectedValue(err)
    await expect(runHandler()).rejects.toThrow()
    expect(Sentry.captureException).toHaveBeenCalledWith(
      err,
      expect.objectContaining({
        extra: expect.objectContaining({ diagnosticId: DIAG_ID }),
        tags: { job: 'analyze-diagnostic' },
      }),
    )
  })

  // ── JSON 파싱 실패 ─────────────────────────────────────────────────────────

  it('JSON 파싱 불가 응답 → 에러가 throw됨', async () => {
    vi.mocked(callClaude).mockResolvedValue('no json here at all !!!')
    await expect(runHandler()).rejects.toThrow()
  })

  it('JSON 파싱 실패 → status=failed로 업데이트됨', async () => {
    vi.mocked(callClaude).mockResolvedValue('completely invalid response')
    await expect(runHandler()).rejects.toThrow()
    expect(mockSupabase._update).toHaveBeenCalledWith({ status: 'failed' })
  })

  // ── extractJson 간접 검증 ─────────────────────────────────────────────────

  it('```json 코드블록 → 내부 JSON 추출하여 파싱 성공', async () => {
    vi.mocked(callClaude).mockResolvedValue(
      `\`\`\`json\n${JSON.stringify(BASE_REPORT)}\n\`\`\``,
    )
    await runHandler()
    expect(mockSupabase._update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'completed' }),
    )
  })

  it('``` 코드블록 (언어 없음) → 내부 JSON 추출하여 파싱 성공', async () => {
    vi.mocked(callClaude).mockResolvedValue(
      `\`\`\`\n${JSON.stringify(BASE_REPORT)}\n\`\`\``,
    )
    await runHandler()
    expect(mockSupabase._update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'completed' }),
    )
  })

  it('중괄호 포함 텍스트 → JSON 블록 추출하여 파싱 성공', async () => {
    vi.mocked(callClaude).mockResolvedValue(
      `분석 완료:\n${JSON.stringify(BASE_REPORT)}\n이상입니다.`,
    )
    await runHandler()
    expect(mockSupabase._update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'completed' }),
    )
  })

  it('순수 JSON 텍스트 → 그대로 파싱 성공', async () => {
    vi.mocked(callClaude).mockResolvedValue(JSON.stringify(BASE_REPORT))
    await runHandler()
    expect(mockSupabase._update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'completed' }),
    )
  })

  // ── DB 저장 실패 ───────────────────────────────────────────────────────────

  it('DB 저장 실패 → 에러가 throw됨', async () => {
    const failSupabase = makeSupabase({ error: { message: 'connection lost' } })
    vi.mocked(createServiceClient).mockReturnValue(failSupabase as never)

    await expect(runHandler()).rejects.toThrow('진단 결과 저장 실패: connection lost')
  })

  it('DB 저장 실패 → Sentry.captureException이 호출됨', async () => {
    const failSupabase = makeSupabase({ error: { message: 'connection lost' } })
    vi.mocked(createServiceClient).mockReturnValue(failSupabase as never)

    await expect(runHandler()).rejects.toThrow()
    expect(Sentry.captureException).toHaveBeenCalled()
  })
})
