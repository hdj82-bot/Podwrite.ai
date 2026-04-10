/**
 * inngest/translate.ts 테스트
 *
 * 검증 항목:
 *  - 모듈 임포트 시 createFunction 핸들러 등록
 *  - 챕터 없음 → { success: true, translated: 0 }
 *  - 프로젝트 접근 권한 없음 → Error throw
 *  - 정상 번역 → chapter_versions에 저장, translated count 반환
 *  - 번역 결과 저장 데이터 구조 검증 (translation_en / original_ko)
 *  - 번역 완료 이메일 발송
 *  - callClaude 오류 → Sentry.captureException + 실패 이메일 + re-throw
 *  - chapter_ids 지정 시 해당 챕터만 번역 (.in() 호출)
 *  - chapter_ids 빈 배열 시 전체 챕터 번역 (.in() 미호출)
 *
 * 모킹:
 *  - @/inngest/client → createFunction 핸들러를 vi.hoisted()로 캡처
 *  - @/lib/supabase-server → createServiceClient
 *  - @/lib/claude → callClaude
 *  - resend → Resend (이메일 발송)
 *  - @sentry/nextjs → captureException
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'

// ── vi.hoisted: createFunction 핸들러 캡처 ──────────────────────────────────

const handlerRef = vi.hoisted(() => ({
  fn: null as
    | ((ctx: {
        event: { data: Record<string, unknown> }
        step: unknown
      }) => Promise<unknown>)
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

vi.mock('@/lib/supabase-server', () => ({
  createServiceClient: vi.fn(),
}))

vi.mock('@/lib/claude', () => ({
  callClaude: vi.fn(),
}))

vi.mock('resend', () => ({
  Resend: vi.fn(),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}))

// 모킹 이후 임포트 (임포트 시 createFunction 호출 → handlerRef.fn 등록됨)
import '@/inngest/translate'
import { createServiceClient } from '@/lib/supabase-server'
import { callClaude } from '@/lib/claude'
import { Resend } from 'resend'
import * as Sentry from '@sentry/nextjs'

// ── 고정값 ─────────────────────────────────────────────────────────

const PROJECT_ID = 'proj-uuid-001'
const USER_ID = 'user-uuid-001'

const DEFAULT_PROJECT = { id: PROJECT_ID, title: '테스트 원고' }

const DEFAULT_CHAPTERS = [
  {
    id: 'chap-uuid-001',
    title: '1장 제목',
    content: {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: '본문 내용입니다.' }] }],
    },
    order_idx: 0,
  },
]

// ── 헬퍼 ─────────────────────────────────────────────────────────

function makeEvent(overrides: {
  project_id?: string
  user_id?: string
  chapter_ids?: string[]
} = {}) {
  return {
    data: {
      project_id: PROJECT_ID,
      user_id: USER_ID,
      chapter_ids: ['chap-uuid-001'],
      ...overrides,
    },
  }
}

/** step.run(name, fn) → fn() 즉시 실행 */
function makeStep() {
  return {
    run: vi.fn((_name: string, fn: () => Promise<unknown>) => fn()),
  }
}

interface SupabaseOptions {
  project?: typeof DEFAULT_PROJECT | null
  chapters?: typeof DEFAULT_CHAPTERS
  hasProjectAccess?: boolean
  userEmail?: string | null
}

function makeSupabase({
  project = DEFAULT_PROJECT,
  chapters = DEFAULT_CHAPTERS,
  hasProjectAccess = true,
  userEmail = 'writer@example.com',
}: SupabaseOptions = {}) {
  // projects: .select().eq('id',...).eq('user_id',...).single()
  const projSingle = vi.fn().mockResolvedValue(
    hasProjectAccess
      ? { data: project, error: null }
      : { data: null, error: { message: 'not found' } },
  )
  const projEq2 = vi.fn().mockReturnValue({ single: projSingle })
  const projEq1 = vi.fn().mockReturnValue({ eq: projEq2 })
  const projSelect = vi.fn().mockReturnValue({ eq: projEq1 })

  // chapters: .select().eq('project_id',...).order().in() or .order() (no in if ids empty)
  const chaptersResult = { data: chapters, error: null }
  const chaptersIn = vi.fn().mockResolvedValue(chaptersResult)
  // order()를 thenable + .in() 제공
  const chaptersOrder = Object.assign(
    new Promise<typeof chaptersResult>((resolve) => resolve(chaptersResult)),
    { in: chaptersIn },
  )
  const chaptersEq = vi.fn().mockReturnValue({ order: vi.fn().mockReturnValue(chaptersOrder) })
  const chaptersSelect = vi.fn().mockReturnValue({ eq: chaptersEq })

  // users: .select('email').eq('id',...).single()
  const userSingle = vi.fn().mockResolvedValue({
    data: userEmail ? { email: userEmail } : null,
    error: null,
  })
  const usersEq = vi.fn().mockReturnValue({ single: userSingle })
  const usersSelect = vi.fn().mockReturnValue({ eq: usersEq })

  // chapter_versions: .insert({...})
  const cvInsert = vi.fn().mockResolvedValue({ error: null })

  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'projects') return { select: projSelect }
      if (table === 'chapters') return { select: chaptersSelect }
      if (table === 'users') return { select: usersSelect }
      if (table === 'chapter_versions') return { insert: cvInsert }
      return {}
    }),
    _cvInsert: cvInsert,
    _chaptersIn: chaptersIn,
  }
}

const mockEmailSend = vi.fn().mockResolvedValue({ data: { id: 'email-id' }, error: null })

async function runHandler(
  eventOverrides: Parameters<typeof makeEvent>[0] = {},
  step = makeStep(),
) {
  return handlerRef.fn!({ event: makeEvent(eventOverrides), step })
}

// ── 테스트 ────────────────────────────────────────────────────────

describe('translateJob', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.SECRET_RESEND_API_KEY = 'test-resend-key'
    process.env.NEXT_PUBLIC_APP_URL = 'https://podwrite.ai'

    vi.mocked(createServiceClient).mockReturnValue(makeSupabase() as never)
    vi.mocked(callClaude)
      .mockResolvedValueOnce('Chapter 1 Title') // 제목 번역
      .mockResolvedValueOnce('Translated body text.') // 본문 번역
    vi.mocked(Resend).mockImplementation(
      () => ({ emails: { send: mockEmailSend } }) as unknown as Resend,
    )
  })

  // ── 핸들러 등록 ───────────────────────────────────────────────────

  it('모듈 임포트 시 createFunction 핸들러가 등록된다', () => {
    expect(handlerRef.fn).not.toBeNull()
    expect(typeof handlerRef.fn).toBe('function')
  })

  // ── 챕터 없음 ────────────────────────────────────────────────────

  it('번역할 챕터가 없으면 { success: true, translated: 0 }을 반환한다', async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      makeSupabase({ chapters: [] }) as never,
    )
    const result = await runHandler()
    expect(result).toMatchObject({ success: true, translated: 0 })
  })

  // ── 프로젝트 접근 권한 ────────────────────────────────────────

  it('프로젝트 소유권 없음 → Error throw', async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      makeSupabase({ hasProjectAccess: false }) as never,
    )
    await expect(runHandler()).rejects.toThrow('프로젝트 접근 권한')
  })

  it('프로젝트 접근 권한 없음 → Sentry.captureException 호출', async () => {
    vi.mocked(createServiceClient).mockReturnValue(
      makeSupabase({ hasProjectAccess: false }) as never,
    )
    await expect(runHandler()).rejects.toThrow()
    expect(Sentry.captureException).toHaveBeenCalled()
  })

  // ── 정상 번역 ────────────────────────────────────────────────

  it('정상 번역 → { success: true, translated: 1 } 반환', async () => {
    const result = await runHandler()
    expect(result).toMatchObject({ success: true, translated: 1 })
  })

  it('번역 결과를 chapter_versions에 저장한다', async () => {
    const sb = makeSupabase()
    vi.mocked(createServiceClient).mockReturnValue(sb as never)

    await runHandler()

    expect(sb._cvInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        chapter_id: 'chap-uuid-001',
        trigger: 'ai_edit',
      }),
    )
  })

  it('chapter_versions content에 translation_en과 original_ko가 포함된다', async () => {
    const sb = makeSupabase()
    vi.mocked(createServiceClient).mockReturnValue(sb as never)

    await runHandler()

    const insertArg = sb._cvInsert.mock.calls[0]?.[0] as {
      content: {
        translation_en: { title: string }
        original_ko: { title: string }
      }
    }
    expect(insertArg.content.translation_en).toBeDefined()
    expect(insertArg.content.original_ko).toBeDefined()
    expect(insertArg.content.translation_en.title).toBe('Chapter 1 Title')
    expect(insertArg.content.original_ko.title).toBe('1장 제목')
  })

  it('callClaude를 제목 번역과 본문 번역에 각각 1회씩 호출한다 (챕터 1개 기준)', async () => {
    await runHandler()
    expect(callClaude).toHaveBeenCalledTimes(2)
  })

  // ── 이메일 알림 ──────────────────────────────────────────────

  it('번역 완료 후 성공 이메일을 발송한다', async () => {
    await runHandler()
    expect(mockEmailSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Podwrite.ai <noreply@podwrite.ai>',
        to: 'writer@example.com',
        subject: expect.stringContaining('번역이 완료'),
      }),
    )
  })

  it('SECRET_RESEND_API_KEY 없으면 이메일을 발송하지 않는다', async () => {
    delete process.env.SECRET_RESEND_API_KEY
    await runHandler()
    expect(mockEmailSend).not.toHaveBeenCalled()
  })

  // ── chapter_ids 필터링 ────────────────────────────────────────

  it('chapter_ids가 지정되면 .in()으로 챕터를 필터링한다', async () => {
    const sb = makeSupabase()
    vi.mocked(createServiceClient).mockReturnValue(sb as never)

    await runHandler({ chapter_ids: ['chap-uuid-001'] })

    expect(sb._chaptersIn).toHaveBeenCalledWith('id', ['chap-uuid-001'])
  })

  it('chapter_ids가 빈 배열이면 .in()을 호출하지 않는다 (전체 챕터)', async () => {
    const sb = makeSupabase()
    vi.mocked(createServiceClient).mockReturnValue(sb as never)

    await runHandler({ chapter_ids: [] })

    expect(sb._chaptersIn).not.toHaveBeenCalled()
  })

  // ── callClaude 오류 처리 ──────────────────────────────────────

  it('callClaude 오류 → Sentry.captureException을 호출한다', async () => {
    const err = new Error('Claude API 타임아웃')
    // beforeEach에서 쌓인 mockResolvedValueOnce 큐를 제거하고 에러로 덮어씀
    vi.mocked(callClaude).mockReset().mockRejectedValue(err)

    await expect(runHandler()).rejects.toThrow('Claude API 타임아웃')

    expect(Sentry.captureException).toHaveBeenCalledWith(
      err,
      expect.objectContaining({
        extra: expect.objectContaining({ project_id: PROJECT_ID, user_id: USER_ID }),
        tags: { job: 'translate-manuscript' },
      }),
    )
  })

  it('callClaude 오류 → 실패 이메일을 발송한다', async () => {
    vi.mocked(callClaude).mockReset().mockRejectedValue(new Error('API 오류'))

    await expect(runHandler()).rejects.toThrow()

    expect(mockEmailSend).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: expect.stringContaining('번역에 실패'),
      }),
    )
  })

  it('callClaude 오류 → 에러가 re-throw된다 (Inngest retry 트리거)', async () => {
    vi.mocked(callClaude).mockReset().mockRejectedValue(new Error('네트워크 오류'))
    await expect(runHandler()).rejects.toThrow('네트워크 오류')
  })
})
